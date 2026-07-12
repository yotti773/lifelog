import { getGoogleAccessToken } from "./googleSheetsAuth";
import { DIARY_MOOD_LABELS } from "./diaryMoodLabels";
import type { Env } from "./index";
import { MEAL_TYPE_LABELS } from "./mealTypeLabels";
import {
  DIARY_CONFIG,
  EXERCISE_MASTER_CONFIG,
  EXERCISE_MASTER_HEADER,
  FOOD_MASTER_CONFIG,
  MEAL_CONFIG,
  SHEETS_API_BASE,
  WATER_CONFIG,
  WEIGHT_CONFIG,
  WORKOUT_CONFIG,
  type SheetConfig,
} from "./sheetsSync";

// worker/tsconfig.json は src/ に依存しない独立ビルドのため、必要な形をここにローカルで複製している。
// src/sync/types.ts の Pulled*Record / SyncPullResult と手動で同期を保つこと。
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

export interface ImportedWaterRecordOutput {
  id: string;
  timestamp: string;
  amountMl: number;
}

export interface ImportedWorkoutRecordOutput {
  id: string;
  date: string;
  timestamp: string;
  exerciseName: string;
  exerciseOrder: number;
  setNumber: number;
  weightKg: number;
  reps: number;
}

export interface ImportedDiaryRecordOutput {
  id: string;
  date: string;
  timestamp: string;
  text: string;
  mood?: string;
}

export interface ImportedActivityRecordOutput {
  date: string;
  steps?: number;
  totalKcal?: number;
  activeKcal?: number;
  sleepMinutes?: number;
  sleepScore?: number;
  restingHeartRate?: number;
  moderateIntensityMinutes?: number;
  vigorousIntensityMinutes?: number;
}

export interface ImportedFoodMasterItemOutput {
  id: string;
  name: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  source?: string;
  createdAt: string;
}

export interface ImportedExerciseMasterItemOutput {
  id: string;
  name: string;
  createdAt: string;
}

interface SheetsImportResultOutput {
  weightRecords: ImportedWeightRecordOutput[];
  mealRecords: ImportedMealRecordOutput[];
  waterRecords: ImportedWaterRecordOutput[];
  workoutRecords: ImportedWorkoutRecordOutput[];
  diaryRecords: ImportedDiaryRecordOutput[];
  activityRecords: ImportedActivityRecordOutput[];
  foodMasterItems: ImportedFoodMasterItemOutput[];
  exerciseMasterItems: ImportedExerciseMasterItemOutput[];
  skippedWeightRows: number;
  skippedMealRows: number;
  skippedWaterRows: number;
  skippedWorkoutRows: number;
  skippedDiaryRows: number;
  skippedActivityRows: number;
  skippedFoodMasterRows: number;
  skippedExerciseMasterRows: number;
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

const DIARY_MOOD_BY_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(DIARY_MOOD_LABELS).map(([mood, label]) => [label, mood]),
);

/** 気分タグセル(日本語ラベル or 英語キー)をDiaryMoodキーに変換する。空・未知の値はundefined */
export function parseMoodCell(value: CellValue): string | undefined {
  const s = String(value ?? "").trim();
  if (s === "") return undefined;
  if (DIARY_MOOD_BY_LABEL[s]) return DIARY_MOOD_BY_LABEL[s];
  if (s in DIARY_MOOD_LABELS) return s;
  return undefined;
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

/**
 * 水分記録タブの全行をレコードに逆変換する(Issue #72)。
 * 記録日時・摂取量が読み取れない行はスキップ。ID列が空の行はUUIDを採番して書き戻し対象にする。
 */
export function planWaterImport(
  rows: CellValue[][],
  generateId: () => string,
): SheetImportPlan<ImportedWaterRecordOutput> {
  const records: ImportedWaterRecordOutput[] = [];
  const idBackfills: IdBackfill[] = [];
  let skippedRowCount = 0;
  const seenIds = new Set<string>();

  rows.forEach((cells, index) => {
    const rowNumber = index + 1;
    const timestamp = parseJstDateTime(cells?.[0]);
    const amountMl = parseCellNumber(cells?.[1]);
    if (timestamp === null || amountMl === null) {
      if (rowNumber !== 1) skippedRowCount++;
      return;
    }

    const rawId = String(cells?.[2] ?? "").trim();
    const id = rawId === "" ? generateId() : rawId;
    if (seenIds.has(id)) {
      skippedRowCount++;
      return;
    }
    seenIds.add(id);
    if (rawId === "") {
      idBackfills.push({ rowNumber, id });
    }

    records.push({ id, timestamp, amountMl });
  });

  return { records, idBackfills, skippedRowCount };
}

/**
 * 筋トレ記録タブの全行をレコードに逆変換する(Issue #72)。
 * 日付・種目名・種目順・セット番号・重量・回数が読み取れない行はスキップ。
 * ID列が空の行はUUIDを採番して書き戻し対象にする。
 */
export function planWorkoutImport(
  rows: CellValue[][],
  generateId: () => string,
): SheetImportPlan<ImportedWorkoutRecordOutput> {
  const records: ImportedWorkoutRecordOutput[] = [];
  const idBackfills: IdBackfill[] = [];
  let skippedRowCount = 0;
  const seenIds = new Set<string>();

  rows.forEach((cells, index) => {
    const rowNumber = index + 1;
    const date = parseCalendarDate(cells?.[0]);
    const exerciseName = String(cells?.[1] ?? "").trim();
    const exerciseOrder = parseCellNumber(cells?.[2]);
    const setNumber = parseCellNumber(cells?.[3]);
    const weightKg = parseCellNumber(cells?.[4]);
    const reps = parseCellNumber(cells?.[5]);
    if (
      date === null ||
      exerciseName === "" ||
      exerciseOrder === null ||
      setNumber === null ||
      weightKg === null ||
      reps === null
    ) {
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

    // タイムスタンプ列が無い/読めない手入力行は、その日のJST 00:00として扱う
    const timestamp = parseJstDateTime(cells?.[6]) ?? parseJstDateTime(date)!;

    records.push({ id, date, timestamp, exerciseName, exerciseOrder, setNumber, weightKg, reps });
  });

  return { records, idBackfills, skippedRowCount };
}

/**
 * 日記記録タブの全行をレコードに逆変換する(Issue #72)。
 * 日付が読み取れない行はスキップ。本文・気分タグは空(手入力時の欠落)を許容する。
 * 日記記録のIDは常に日付(saveDiaryRecordの不変条件)。ID列が空の行はID=日付を採番して書き戻し対象にする。
 */
export function planDiaryImport(rows: CellValue[][]): SheetImportPlan<ImportedDiaryRecordOutput> {
  const records: ImportedDiaryRecordOutput[] = [];
  const idBackfills: IdBackfill[] = [];
  let skippedRowCount = 0;
  const seenIds = new Set<string>();

  rows.forEach((cells, index) => {
    const rowNumber = index + 1;
    const date = parseCalendarDate(cells?.[0]);
    if (date === null) {
      if (rowNumber !== 1) skippedRowCount++;
      return;
    }
    if (seenIds.has(date)) {
      skippedRowCount++;
      return;
    }
    seenIds.add(date);

    const mood = parseMoodCell(cells?.[1]);
    const text = String(cells?.[2] ?? "").trim();
    // タイムスタンプ列が無い/読めない手入力行は、その日のJST 00:00として扱う
    const timestamp = parseJstDateTime(cells?.[3]) ?? parseJstDateTime(date)!;
    if (String(cells?.[4] ?? "").trim() === "") {
      idBackfills.push({ rowNumber, id: date });
    }

    records.push({ id: date, date, timestamp, text, ...(mood !== undefined && { mood }) });
  });

  return { records, idBackfills, skippedRowCount };
}

/**
 * 活動記録タブ(Garmin連携が書き込む。scripts/garmin/README.md 参照)の全行をレコードに
 * 逆変換する(Issue #81)。列構成は「日付・歩数・総消費・活動消費・睡眠分・睡眠スコア・
 * 安静時心拍・中強度分・高強度分」。日付が読めない行と、数値が1つも無い行はスキップする。
 * 日付が主キーのためID列・採番は無い。同じ日付の2行目以降は重複としてスキップする。
 */
export function planActivityImport(rows: CellValue[][]): SheetImportPlan<ImportedActivityRecordOutput> {
  const records: ImportedActivityRecordOutput[] = [];
  let skippedRowCount = 0;
  const seenDates = new Set<string>();

  rows.forEach((cells, index) => {
    const rowNumber = index + 1;
    const date = parseCalendarDate(cells?.[0]);
    if (date === null) {
      if (rowNumber !== 1) skippedRowCount++;
      return;
    }
    if (seenDates.has(date)) {
      skippedRowCount++;
      return;
    }

    const steps = parseCellNumber(cells?.[1]) ?? undefined;
    const totalKcal = parseCellNumber(cells?.[2]) ?? undefined;
    const activeKcal = parseCellNumber(cells?.[3]) ?? undefined;
    const sleepMinutes = parseCellNumber(cells?.[4]) ?? undefined;
    const sleepScore = parseCellNumber(cells?.[5]) ?? undefined;
    const restingHeartRate = parseCellNumber(cells?.[6]) ?? undefined;
    const moderateIntensityMinutes = parseCellNumber(cells?.[7]) ?? undefined;
    const vigorousIntensityMinutes = parseCellNumber(cells?.[8]) ?? undefined;

    const values = {
      ...(steps !== undefined && { steps }),
      ...(totalKcal !== undefined && { totalKcal }),
      ...(activeKcal !== undefined && { activeKcal }),
      ...(sleepMinutes !== undefined && { sleepMinutes }),
      ...(sleepScore !== undefined && { sleepScore }),
      ...(restingHeartRate !== undefined && { restingHeartRate }),
      ...(moderateIntensityMinutes !== undefined && { moderateIntensityMinutes }),
      ...(vigorousIntensityMinutes !== undefined && { vigorousIntensityMinutes }),
    };
    if (Object.keys(values).length === 0) {
      skippedRowCount++;
      return;
    }

    seenDates.add(date);
    records.push({ date, ...values });
  });

  return { records, idBackfills: [], skippedRowCount };
}

/**
 * 食事マスタタブの全行を品目に逆変換する(Issue #96)。
 * 品目名・カロリーが読み取れない行はスキップ。PFCは手入力を考慮し省略時0、出典は任意とする。
 * 登録日時が無い/読めない手入力行は取り込み時刻(nowIso)を使う(マスタに日付キーが無いため)。
 * ID列が空の行はUUIDを採番して書き戻し対象にする。同名(前後空白無視)の2行目以降は、
 * アプリ側の名前重複スキップと整合するよう重複としてスキップする。
 */
export function planFoodMasterImport(
  rows: CellValue[][],
  generateId: () => string,
  nowIso: string,
): SheetImportPlan<ImportedFoodMasterItemOutput> {
  const records: ImportedFoodMasterItemOutput[] = [];
  const idBackfills: IdBackfill[] = [];
  let skippedRowCount = 0;
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  rows.forEach((cells, index) => {
    const rowNumber = index + 1;
    const name = String(cells?.[0] ?? "").trim();
    const kcal = parseCellNumber(cells?.[1]);
    if (name === "" || kcal === null) {
      if (rowNumber !== 1) skippedRowCount++;
      return;
    }

    const rawId = String(cells?.[7] ?? "").trim();
    const id = rawId === "" ? generateId() : rawId;
    if (seenIds.has(id) || seenNames.has(name)) {
      skippedRowCount++;
      return;
    }
    seenIds.add(id);
    seenNames.add(name);
    if (rawId === "") {
      idBackfills.push({ rowNumber, id });
    }

    const source = String(cells?.[5] ?? "").trim();
    records.push({
      id,
      name,
      kcal,
      proteinG: parseCellNumber(cells?.[2]) ?? 0,
      fatG: parseCellNumber(cells?.[3]) ?? 0,
      carbsG: parseCellNumber(cells?.[4]) ?? 0,
      ...(source !== "" && { source }),
      createdAt: parseJstDateTime(cells?.[6]) ?? nowIso,
    });
  });

  return { records, idBackfills, skippedRowCount };
}

/**
 * 種目マスタタブの全行を種目に逆変換する(Issue #96)。
 * 種目名が読み取れない行はスキップ。登録日時が無い/読めない手入力行は取り込み時刻(nowIso)を使う。
 * ID列が空の行はUUIDを採番して書き戻し対象にする。同名(前後空白無視)の2行目以降は、
 * アプリ側の名前ユニーク制約(サジェストのキーが名前)と整合するよう重複としてスキップする。
 */
export function planExerciseMasterImport(
  rows: CellValue[][],
  generateId: () => string,
  nowIso: string,
): SheetImportPlan<ImportedExerciseMasterItemOutput> {
  const records: ImportedExerciseMasterItemOutput[] = [];
  const idBackfills: IdBackfill[] = [];
  let skippedRowCount = 0;
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  rows.forEach((cells, index) => {
    const rowNumber = index + 1;
    const name = String(cells?.[0] ?? "").trim();
    // 種目マスタは必須項目が種目名だけのため、他タブのように「数値・日付のパース失敗」では
    // 見出し行を自然に弾けない。自動作成ヘッダーの先頭ラベルと一致する1行目を見出しとみなす
    if (rowNumber === 1 && name === EXERCISE_MASTER_HEADER[0]) {
      return;
    }
    if (name === "") {
      if (rowNumber !== 1) skippedRowCount++;
      return;
    }

    const rawId = String(cells?.[2] ?? "").trim();
    const id = rawId === "" ? generateId() : rawId;
    if (seenIds.has(id) || seenNames.has(name)) {
      skippedRowCount++;
      return;
    }
    seenIds.add(id);
    seenNames.add(name);
    if (rawId === "") {
      idBackfills.push({ rowNumber, id });
    }

    records.push({ id, name, createdAt: parseJstDateTime(cells?.[1]) ?? nowIso });
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
 * 指定タブのA列〜ID列を全行読み取る。タブ自体が無い場合は空を返す —
 * マスタ系タブは初回同期時にWorkerが自動作成するもので(sheetsSync.ts参照)、
 * まだ一度も同期していないシートには存在しないのが正常のため、欠如を取り込み全体の失敗にしない。
 * (範囲文字列は固定で正しいため、400はタブ名を解決できない=タブ欠如とみなせる)
 */
async function readSheetRowsIfPresent(
  accessToken: string,
  spreadsheetId: string,
  config: SheetConfig,
): Promise<CellValue[][]> {
  const range = encodeURIComponent(`${config.name}!A:${config.idColumnLetter}`);
  const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${range}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 400) {
    return [];
  }
  if (!res.ok) {
    throw new Error(`Sheets APIエラー (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { values?: CellValue[][] };
  return data.values ?? [];
}

// 活動記録タブの読み取り範囲。列I(高強度運動時間)まで。ID列は無い(日付が主キー)ため
// SheetConfigは使わず、タブ名と終端列だけをローカルに持つ
const ACTIVITY_SHEET_NAME = "活動記録";
const ACTIVITY_END_COLUMN = "I";

/**
 * 活動記録タブの全行を読み取る。タブ自体が無い場合は空を返す —
 * このタブはGarmin連携(scripts/garmin/)が初回実行時に作るもので、連携未セットアップの
 * ユーザーには存在しないのが正常のため、他タブと違い欠如を取り込み全体の失敗にしない。
 * (範囲文字列は固定で正しいため、400はタブ名を解決できない=タブ欠如とみなせる)
 */
async function readActivityRowsIfPresent(
  accessToken: string,
  spreadsheetId: string,
): Promise<CellValue[][]> {
  const range = encodeURIComponent(`${ACTIVITY_SHEET_NAME}!A:${ACTIVITY_END_COLUMN}`);
  const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${range}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 400) {
    return [];
  }
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
 * スプレッドシートの全タブ(記録5タブ+活動記録+食事マスタ・種目マスタ)を読み取り、
 * アプリのレコード形式で返す(Issue #54・#72・#96)。
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
    const [weightRows, mealRows, waterRows, workoutRows, diaryRows, activityRows, foodMasterRows, exerciseMasterRows] =
      await Promise.all([
        readSheetRows(accessToken, spreadsheetId, WEIGHT_CONFIG),
        readSheetRows(accessToken, spreadsheetId, MEAL_CONFIG),
        readSheetRows(accessToken, spreadsheetId, WATER_CONFIG),
        readSheetRows(accessToken, spreadsheetId, WORKOUT_CONFIG),
        readSheetRows(accessToken, spreadsheetId, DIARY_CONFIG),
        readActivityRowsIfPresent(accessToken, spreadsheetId),
        readSheetRowsIfPresent(accessToken, spreadsheetId, FOOD_MASTER_CONFIG),
        readSheetRowsIfPresent(accessToken, spreadsheetId, EXERCISE_MASTER_CONFIG),
      ]);

    const nowIso = new Date().toISOString();
    const weightPlan = planWeightImport(weightRows);
    const mealPlan = planMealImport(mealRows, () => crypto.randomUUID());
    const waterPlan = planWaterImport(waterRows, () => crypto.randomUUID());
    const workoutPlan = planWorkoutImport(workoutRows, () => crypto.randomUUID());
    const diaryPlan = planDiaryImport(diaryRows);
    const activityPlan = planActivityImport(activityRows);
    const foodMasterPlan = planFoodMasterImport(foodMasterRows, () => crypto.randomUUID(), nowIso);
    const exerciseMasterPlan = planExerciseMasterImport(exerciseMasterRows, () => crypto.randomUUID(), nowIso);

    // 書き戻しに失敗したら取り込み全体を失敗させる。IDがシートに無いままレコードだけ
    // クライアントへ返すと、以後の編集同期が既存行を見つけられず重複行を生むため
    await Promise.all([
      writeBackIds(accessToken, spreadsheetId, WEIGHT_CONFIG, weightPlan.idBackfills),
      writeBackIds(accessToken, spreadsheetId, MEAL_CONFIG, mealPlan.idBackfills),
      writeBackIds(accessToken, spreadsheetId, WATER_CONFIG, waterPlan.idBackfills),
      writeBackIds(accessToken, spreadsheetId, WORKOUT_CONFIG, workoutPlan.idBackfills),
      writeBackIds(accessToken, spreadsheetId, DIARY_CONFIG, diaryPlan.idBackfills),
      writeBackIds(accessToken, spreadsheetId, FOOD_MASTER_CONFIG, foodMasterPlan.idBackfills),
      writeBackIds(accessToken, spreadsheetId, EXERCISE_MASTER_CONFIG, exerciseMasterPlan.idBackfills),
    ]);

    return Response.json({
      weightRecords: weightPlan.records,
      mealRecords: mealPlan.records,
      waterRecords: waterPlan.records,
      workoutRecords: workoutPlan.records,
      diaryRecords: diaryPlan.records,
      activityRecords: activityPlan.records,
      foodMasterItems: foodMasterPlan.records,
      exerciseMasterItems: exerciseMasterPlan.records,
      skippedWeightRows: weightPlan.skippedRowCount,
      skippedMealRows: mealPlan.skippedRowCount,
      skippedWaterRows: waterPlan.skippedRowCount,
      skippedWorkoutRows: workoutPlan.skippedRowCount,
      skippedDiaryRows: diaryPlan.skippedRowCount,
      skippedActivityRows: activityPlan.skippedRowCount,
      skippedFoodMasterRows: foodMasterPlan.skippedRowCount,
      skippedExerciseMasterRows: exerciseMasterPlan.skippedRowCount,
    } satisfies SheetsImportResultOutput);
  } catch (error) {
    const message = error instanceof Error ? error.message : "スプレッドシートの読み取りに失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }
}
