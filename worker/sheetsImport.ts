import { getGoogleAccessToken } from "./googleSheetsAuth";
import type { Env } from "./index";
import { MEAL_TYPE_LABELS } from "./mealTypeLabels";
import { MEAL_CONFIG, SHEETS_API_BASE, WEIGHT_CONFIG, type SheetConfig } from "./sheetsSync";

// worker/tsconfig.json は src/ に依存しない独立ビルドのため、必要な形をここにローカルで複製している。
// src/sync/types.ts の PulledWeightRecord / PulledMealRecord / SyncPullResult と手動で同期を保つこと。
export interface ImportedWeightRecordOutput {
  id: string;
  date: string;
  timestamp: string;
  weightKg: number;
  bodyFatPercent?: number;
  note?: string;
}

export interface ImportedMealRecordOutput {
  id: string;
  timestamp: string;
  mealType: string;
  confirmedName: string;
  confirmedKcal: number;
  confirmedProteinG: number;
  confirmedFatG: number;
  confirmedCarbsG: number;
}

interface SheetsImportResultOutput {
  weightRecords: ImportedWeightRecordOutput[];
  mealRecords: ImportedMealRecordOutput[];
  skippedWeightRows: number;
  skippedMealRows: number;
}

/** Sheets APIのvalues.get(FORMATTED_VALUE)が返しうるセル値 */
export type CellValue = string | number | undefined;

// ===== 純粋なパース関数(ネットワークに依存せずテスト可能) =====
// 書き出し側(sheetsSync.ts の formatCalendarDate / formatJstDateTime)の逆変換。
// Sheetsは書き込んだ文字列を日付値として解釈しロケール依存の表示("2026/07/05"等)に
// 変えることがあるため、複数の表記を許容するトレラントなパースにしている。

const CALENDAR_DATE_PATTERNS = [
  /^(\d{4})年(\d{1,2})月(\d{1,2})日$/,
  /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
  /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
];

/** "yyyy年mm月dd日"・"yyyy/m/d"・"yyyy-m-d" を "YYYY-MM-DD" に変換する。解釈できなければnull */
export function parseCalendarDate(value: CellValue): string | null {
  const s = String(value ?? "").trim();
  for (const pattern of CALENDAR_DATE_PATTERNS) {
    const match = s.match(pattern);
    if (!match) continue;
    const [, year, month, day] = match;
    const m = Number(month);
    const d = Number(day);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

/**
 * JST表記の日時("yyyy年mm月dd日 hh:mm" 等)をUTCのISO8601に変換する。解釈できなければnull。
 * 時刻部分は省略可(過去データの手入力を想定)。省略時はJSTの00:00として扱う。
 */
export function parseJstDateTime(value: CellValue): string | null {
  const s = String(value ?? "").trim();
  if (s === "") return null;
  const parts = s.split(/\s+/);
  if (parts.length > 2) return null;
  const date = parseCalendarDate(parts[0]);
  if (date === null) return null;

  let hour = 0;
  let minute = 0;
  let second = 0;
  if (parts.length === 2) {
    const timeMatch = parts[1].match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!timeMatch) return null;
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2]);
    second = Number(timeMatch[3] ?? "0");
    if (hour > 23 || minute > 59 || second > 59) return null;
  }

  const [year, month, day] = date.split("-").map(Number);
  // JST(UTC+9)の時刻をUTCへ戻す。Date.UTCは時が負でも前日へ正しく繰り下がる
  return new Date(Date.UTC(year, month - 1, day, hour - 9, minute, second)).toISOString();
}

/** セル値を数値に変換する。桁区切りカンマ("1,200")を許容し、空・非数値はnull */
export function parseCellNumber(value: CellValue): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const s = String(value ?? "").trim().replace(/,/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const MEAL_TYPE_BY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(MEAL_TYPE_LABELS).map(([type, label]) => [label, type]),
);

/** 食事区分セル(日本語ラベル or 英語キー)をMealTypeキーに変換する。未知の値はnull */
export function parseMealTypeCell(value: CellValue): string | null {
  const s = String(value ?? "").trim();
  if (MEAL_TYPE_BY_LABEL[s]) return MEAL_TYPE_BY_LABEL[s];
  if (s in MEAL_TYPE_LABELS) return s;
  return null;
}

export interface IdBackfill {
  /** 1始まりの行番号 */
  rowNumber: number;
  id: string;
}

export interface SheetImportPlan<T> {
  records: T[];
  /** ID列が空だった行への採番の書き戻し。以後の同期(ID列キーのupsert・削除)との整合性のために必須 */
  idBackfills: IdBackfill[];
  /** 解釈できずスキップした行数(1行目は見出し行とみなして数えない) */
  skippedRowCount: number;
}

/**
 * 体重記録タブの全行をレコードに逆変換する(Issue #54)。
 * 日付・体重が読み取れない行はスキップ。ID列が空の行はID=日付を採番して書き戻し対象にする。
 * 同じIDの2行目以降は重複としてスキップする(upsertと同じ「最初の行が正」の方針)。
 */
export function planWeightImport(rows: CellValue[][]): SheetImportPlan<ImportedWeightRecordOutput> {
  const records: ImportedWeightRecordOutput[] = [];
  const idBackfills: IdBackfill[] = [];
  let skippedRowCount = 0;
  const seenIds = new Set<string>();

  rows.forEach((cells, index) => {
    const rowNumber = index + 1;
    const date = parseCalendarDate(cells?.[0]);
    const weightKg = parseCellNumber(cells?.[1]);
    if (date === null || weightKg === null) {
      if (rowNumber !== 1) skippedRowCount++;
      return;
    }
    // 体重記録のIDは常に日付(saveWeightRecordの不変条件)。手入力行のID列は空を想定
    if (seenIds.has(date)) {
      skippedRowCount++;
      return;
    }
    seenIds.add(date);

    const bodyFatPercent = parseCellNumber(cells?.[2]) ?? undefined;
    const note = String(cells?.[3] ?? "").trim();
    // タイムスタンプ列が無い/読めない手入力行は、その日のJST 00:00として扱う
    const timestamp = parseJstDateTime(cells?.[4]) ?? parseJstDateTime(date)!;
    if (String(cells?.[5] ?? "").trim() === "") {
      idBackfills.push({ rowNumber, id: date });
    }

    records.push({
      id: date,
      date,
      timestamp,
      weightKg,
      ...(bodyFatPercent !== undefined && { bodyFatPercent }),
      ...(note !== "" && { note }),
    });
  });

  return { records, idBackfills, skippedRowCount };
}

/**
 * 食事記録タブの全行をレコードに逆変換する(Issue #54)。
 * 日時・区分・品名・カロリーが読み取れない行はスキップ。PFCは手入力を考慮し省略時0とする。
 * ID列が空の行はUUIDを採番して書き戻し対象にする。
 */
export function planMealImport(
  rows: CellValue[][],
  generateId: () => string,
): SheetImportPlan<ImportedMealRecordOutput> {
  const records: ImportedMealRecordOutput[] = [];
  const idBackfills: IdBackfill[] = [];
  let skippedRowCount = 0;
  const seenIds = new Set<string>();

  rows.forEach((cells, index) => {
    const rowNumber = index + 1;
    const timestamp = parseJstDateTime(cells?.[0]);
    const mealType = parseMealTypeCell(cells?.[1]);
    const confirmedName = String(cells?.[2] ?? "").trim();
    const confirmedKcal = parseCellNumber(cells?.[3]);
    if (timestamp === null || mealType === null || confirmedName === "" || confirmedKcal === null) {
      if (rowNumber !== 1) skippedRowCount++;
      return;
    }

    const rawId = String(cells?.[7] ?? "").trim();
    const id = rawId === "" ? generateId() : rawId;
    if (seenIds.has(id)) {
      skippedRowCount++;
      return;
    }
    seenIds.add(id);
    if (rawId === "") {
      idBackfills.push({ rowNumber, id });
    }

    records.push({
      id,
      timestamp,
      mealType,
      confirmedName,
      confirmedKcal,
      confirmedProteinG: parseCellNumber(cells?.[4]) ?? 0,
      confirmedFatG: parseCellNumber(cells?.[5]) ?? 0,
      confirmedCarbsG: parseCellNumber(cells?.[6]) ?? 0,
    });
  });

  return { records, idBackfills, skippedRowCount };
}

// ===== Google Sheets API 呼び出し =====

/** 指定タブのA列〜ID列を全行読み取る */
async function readSheetRows(
  accessToken: string,
  spreadsheetId: string,
  config: SheetConfig,
): Promise<CellValue[][]> {
  const range = encodeURIComponent(`${config.name}!A:${config.idColumnLetter}`);
  const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${range}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Sheets APIエラー (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { values?: CellValue[][] };
  return data.values ?? [];
}

/**
 * ID列が空だった行へ採番したIDを書き戻す。
 * valueInputOptionはRAW固定 — USER_ENTEREDだと日付形式のID("2026-07-07")がSheetsに
 * 日付値として解釈され、以後のID列読み取り(upsert・削除のキー照合)と一致しなくなるため。
 */
async function writeBackIds(
  accessToken: string,
  spreadsheetId: string,
  config: SheetConfig,
  backfills: IdBackfill[],
): Promise<void> {
  if (backfills.length === 0) return;
  const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      valueInputOption: "RAW",
      data: backfills.map((b) => ({
        range: `${config.name}!${config.idColumnLetter}${b.rowNumber}`,
        values: [[b.id]],
      })),
    }),
  });
  if (!res.ok) {
    throw new Error(`Sheets APIエラー (${res.status}): ${await res.text()}`);
  }
}

/**
 * スプレッドシート2タブの全記録を読み取り、アプリのレコード形式で返す(Issue #54)。
 * push(handleSyncSheets)と違い部分成功は返さない — 読み取りは副作用がなく、失敗したら
 * クライアント側は何も取り込まず再試行すればよいため、全体を成功/失敗の2値にしている。
 */
export async function handleImportSheets(env: Env): Promise<Response> {
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    return Response.json({ error: "Google Sheets連携が未設定です(環境変数を確認してください)" }, { status: 500 });
  }

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(env);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google認証に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }

  const spreadsheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID;
  try {
    const [weightRows, mealRows] = await Promise.all([
      readSheetRows(accessToken, spreadsheetId, WEIGHT_CONFIG),
      readSheetRows(accessToken, spreadsheetId, MEAL_CONFIG),
    ]);

    const weightPlan = planWeightImport(weightRows);
    const mealPlan = planMealImport(mealRows, () => crypto.randomUUID());

    // 書き戻しに失敗したら取り込み全体を失敗させる。IDがシートに無いままレコードだけ
    // クライアントへ返すと、以後の編集同期が既存行を見つけられず重複行を生むため
    await Promise.all([
      writeBackIds(accessToken, spreadsheetId, WEIGHT_CONFIG, weightPlan.idBackfills),
      writeBackIds(accessToken, spreadsheetId, MEAL_CONFIG, mealPlan.idBackfills),
    ]);

    return Response.json({
      weightRecords: weightPlan.records,
      mealRecords: mealPlan.records,
      skippedWeightRows: weightPlan.skippedRowCount,
      skippedMealRows: mealPlan.skippedRowCount,
    } satisfies SheetsImportResultOutput);
  } catch (error) {
    const message = error instanceof Error ? error.message : "スプレッドシートの読み取りに失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }
}
