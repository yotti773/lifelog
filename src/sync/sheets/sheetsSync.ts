import { EXERCISE_BODY_PART_LABELS } from "@/lib/exerciseBodyParts";
import type {
  BloodPressureRecord,
  BodyMeasurementRecord,
  DiaryRecord,
  ExerciseMasterItem,
  FoodMasterItem,
  HabitMasterItem,
  HabitRecord,
  MealRecord,
  WaterRecord,
  WeightRecord,
  WorkoutRecord,
} from "@/types";
import type { WeeklyAdvice } from "@/types";
import type {
  PushableAdviceRecord,
  PushableMonthlyAdviceRecord,
  SyncPushPayload,
  SyncPushResult,
} from "../types";
import { DIARY_MOOD_LABELS, MEAL_TYPE_LABELS } from "./labels";

/**
 * スプレッドシートへの書き出し(Issue #3・#30。**Issue #215 で `worker/` からクライアント側へ移設**)。
 *
 * **Google Sheets API はブラウザから直接叩く。** access token は #214 で取得したユーザー自身の
 * 認可から得る(`src/api/googleOAuth.ts`)。これにより、他人の健康データが開発者のインフラを
 * 一切通らなくなる — プライバシーポリシー(#238)の「記録はお預かりしません」はこれで成立する。
 *
 * 移設前は Worker が src/ に依存しない独立ビルドだったため、レコードの形をこのファイルに複製していた。
 * **移設に伴いその複製は削除し、`src/types.ts` の実型を直接使う**(二重管理の解消)。
 */

/** 設定タブの1行(Issue #164)。key-value の形で書き出す */
type SettingsEntry = { key: string; value: string };

export interface SheetConfig {
  name: string;
  /** ID列の列記号(体重記録=F列、食事記録=H列) */
  idColumnLetter: string;
  /** データが入っている最後の列。ID列より後ろに列がある場合のみ指定する(省略時はID列が最後。Issue #104) */
  lastColumnLetter?: string;
}

// タブ名にスペースやアポストロフィが含まれる場合は `'${sheetName}'!A:Z` 形式(埋め込み`'`は`''`にエスケープ)に変更すること。
export const WEIGHT_CONFIG: SheetConfig = { name: "体重記録", idColumnLetter: "F" };
export const MEAL_CONFIG: SheetConfig = { name: "食事記録", idColumnLetter: "H" };
export const WATER_CONFIG: SheetConfig = { name: "水分記録", idColumnLetter: "C" };
export const WORKOUT_CONFIG: SheetConfig = { name: "筋トレ記録", idColumnLetter: "H" };
// 飲酒列(F)はID列(E)より後ろにある(後付けのIssue #112。既存シートのID列を動かさないため。種目マスタの部位列と同じ方針)
export const DIARY_CONFIG: SheetConfig = { name: "日記記録", idColumnLetter: "E", lastColumnLetter: "F" };
export const FOOD_MASTER_CONFIG: SheetConfig = { name: "食事マスタ", idColumnLetter: "H" };
// 部位列(D)はID列(C)より後ろにあるため(後付けのIssue #104。既存シートのID列を動かさないため)、
// 取り込みの読み取り範囲はID列ではなくlastColumnLetterまで広げる必要がある
export const EXERCISE_MASTER_CONFIG: SheetConfig = { name: "種目マスタ", idColumnLetter: "C", lastColumnLetter: "D" };
// 血圧・周囲径・習慣の各タブは後付け(Issue #117・#118・#113)のため既存スプレッドシートには存在しない。
// マスタ系と同様、同期時にタブが無ければWorkerがヘッダー行付きで自動作成する(下記の*_HEADERを渡す)
export const BLOOD_PRESSURE_CONFIG: SheetConfig = { name: "血圧記録", idColumnLetter: "G" };
export const BODY_MEASUREMENT_CONFIG: SheetConfig = { name: "周囲径記録", idColumnLetter: "G" };
export const HABIT_MASTER_CONFIG: SheetConfig = { name: "習慣マスタ", idColumnLetter: "F" };
export const HABIT_RECORD_CONFIG: SheetConfig = { name: "習慣記録", idColumnLetter: "E" };
// AIコメントの2タブも後付け(Issue #164)。ID列は週次=週開始日・月次=月そのもの(体重記録が日付をIDにしているのと同じ)
export const ADVICE_CONFIG: SheetConfig = { name: "週次AIコメント", idColumnLetter: "G" };
// 設定(Issue #164)。1設定=1行の key-value 形式にして、設定項目が増えても列構成を変えずに済ませる
export const SETTINGS_CONFIG: SheetConfig = { name: "設定", idColumnLetter: "C" };
export const MONTHLY_ADVICE_CONFIG: SheetConfig = { name: "月次AIコメント", idColumnLetter: "G" };

// マスタ系タブは記録系と違い後付けのため(Issue #96)、既存スプレッドシートには存在しない。
// 同期時にタブが無ければWorkerがこのヘッダー行付きで自動作成する(記録系タブは手動作成が前提のまま)
/** Sheets APIを叩くのに要る2つ。access tokenは #214 のユーザー認可、シートIDは Settings が持つ(#216) */
export interface SheetsApiContext {
  accessToken: string;
  spreadsheetId: string;
}

// 記録5タブのヘッダー(Issue #216)。**移設前は手動作成が前提でヘッダー定数が無かった** —
// 配布版では他人のDriveにアプリがシートを作るため、5タブも自動作成の対象になった。
// 列の並びは *ToRow と1対1で対応する(取り込みは位置で読むため、並べ替えないこと)
export const WEIGHT_HEADER = ["日付", "体重(kg)", "体脂肪率(%)", "メモ", "記録日時", "ID"];
export const MEAL_HEADER = ["記録日時", "区分", "品目", "カロリー(kcal)", "たんぱく質(g)", "脂質(g)", "炭水化物(g)", "ID"];
export const WATER_HEADER = ["記録日時", "量(ml)", "ID"];
export const WORKOUT_HEADER = ["日付", "種目", "種目順", "セット", "重量(kg)", "回数", "記録日時", "ID"];
export const DIARY_HEADER = ["日付", "気分", "本文", "記録日時", "ID", "飲酒"];

export const FOOD_MASTER_HEADER = ["品目名", "カロリー(kcal)", "たんぱく質(g)", "脂質(g)", "炭水化物(g)", "出典", "登録日時", "ID"];
export const EXERCISE_MASTER_HEADER = ["種目名", "登録日時", "ID", "部位"];
export const BLOOD_PRESSURE_HEADER = ["日付", "最高血圧(mmHg)", "最低血圧(mmHg)", "脈拍(bpm)", "メモ", "記録日時", "ID"];
export const BODY_MEASUREMENT_HEADER = ["日付", "腹囲(cm)", "胸囲(cm)", "太もも(cm)", "メモ", "記録日時", "ID"];
export const HABIT_MASTER_HEADER = ["習慣名", "目標頻度(週)", "アーカイブ", "並び順", "登録日時", "ID"];
export const HABIT_RECORD_HEADER = ["日付", "習慣名", "習慣ID", "記録日時", "ID"];
export const ADVICE_HEADER = ["週開始日", "判定", "総評", "良かった点", "来週のアクション", "生成日時", "ID"];
export const SETTINGS_HEADER = ["項目", "値", "ID"];

/**
 * シート同期する設定項目(Issue #164)。ID列にはこのkeyをそのまま書く。
 *
 * **`apiToken` は載せない。** 取り込みAPIの呼び出し自体に `Authorization: Bearer` としてこの値が要るため、
 * 入力済みでなければ取り込みが始まらない=シートからは原理的に復元できない。認証情報をシートに置かない
 * という判断(#164の論点)とも一致する。
 * **`lastSyncedAt` も載せない。** 端末ごとの同期状態であって利用者の設定ではない。
 *
 * 値の書き方は Sheets の USER_ENTERED による解釈し直しを避ける形にそろえる:
 * 日付は「2026年10月31日」、真偽は「はい/いいえ」。数値はそのまま書いてよい。
 */
export const SETTINGS_FIELDS: {
  key: string;
  label: string;
  type: "number" | "date" | "text" | "boolean";
  /** text型で値を固定候補に縛る場合に指定(シートの手編集で不正値が混ざるのを取り込み時に弾く) */
  allowedValues?: string[];
}[] = [
  { key: "goalWeightKg", label: "目標体重(kg)", type: "number" },
  { key: "goalDate", label: "目標日", type: "date" },
  { key: "baselineDate", label: "進捗バーの起点日", type: "date" },
  { key: "dailyCalorieTarget", label: "目標カロリー(kcal)", type: "number" },
  { key: "dailyWaterTargetMl", label: "目標水分量(ml)", type: "number" },
  { key: "dailyProteinTargetG", label: "目標たんぱく質(g)", type: "number" },
  { key: "dailyFatTargetG", label: "目標脂質(g)", type: "number" },
  { key: "dailyCarbsTargetG", label: "目標炭水化物(g)", type: "number" },
  { key: "heightCm", label: "身長(cm)", type: "number" },
  { key: "birthYear", label: "生年", type: "number" },
  // 判定(verdict)と同じく、候補外の値は取り込み時にスキップする。「男性」等に手で書き換えられると
  // Settings.sexのunion型に任意文字列が入り、BMR計算のsex === "male"比較が黙って女性側の式になるため
  { key: "sex", label: "性別", type: "text", allowedValues: ["male", "female"] },
  { key: "activityLevel", label: "活動係数", type: "number" },
  { key: "sendDiaryTextToAi", label: "日記本文をAIに送る", type: "boolean" },
];

export const BOOLEAN_TRUE_LABEL = "はい";
export const BOOLEAN_FALSE_LABEL = "いいえ";
export const MONTHLY_ADVICE_HEADER = ["月", "判定", "総評", "良かった変化", "来月の重点", "生成日時", "ID"];

/**
 * `WeeklyAdvice.verdict` とシート表示の対応(Issue #164)。
 * シートは人間が読む写しなので日本語で書き、取り込み時に逆引きする(画面のラベルと同じ語)。
 */
export const VERDICT_LABELS: Record<string, string> = {
  on_track: "順調",
  slightly_behind: "やや遅れ",
  behind: "遅れ",
  needs_attention: "要注意",
};
/** 表示ラベル→判定値の逆引き(取り込み用)。値は判定の実型に確定するので、そう型付けする */
export const VERDICT_FROM_LABEL = Object.fromEntries(
  Object.entries(VERDICT_LABELS).map(([value, label]) => [label, value]),
) as Record<string, WeeklyAdvice["verdict"]>;

export const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

/** Sheets APIレスポンスの失敗を共通形式のエラーにして投げる(sheetsImport.tsとも共用) */
export async function ensureSheetsOk(res: Response): Promise<void> {
  if (!res.ok) {
    throw new Error(`Sheets APIエラー (${res.status}): ${await res.text()}`);
  }
}

const JST_TIME_ZONE = "Asia/Tokyo";

// Cloudflare WorkersはUTCで動くため、Dateのgetters(getHours()等)をそのまま使うと9時間ズレる。
// Intl.DateTimeFormatにtimeZoneを明示することで、実行環境の時刻に依存せず正しくJST表示に変換する。
function getJstParts(date: Date): { year: string; month: string; day: string; hour: string; minute: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** "YYYY-MM-DD" の日付キーを "yyyy年mm月dd日" に変換する。既にカレンダー日付なのでタイムゾーン変換は不要。 */
export function formatCalendarDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${year}年${month}月${day}日`;
}

/** ISO8601タイムスタンプをJSTの "yyyy年mm月dd日 hh:mm" に変換する。 */
export function formatJstDateTime(isoTimestamp: string): string {
  const { year, month, day, hour, minute } = getJstParts(new Date(isoTimestamp));
  return `${year}年${month}月${day}日 ${hour}:${minute}`;
}

function weightRecordToRow(r: WeightRecord): (string | number)[] {
  return [
    formatCalendarDate(r.date),
    r.weightKg,
    r.bodyFatPercent ?? "",
    r.note ?? "",
    formatJstDateTime(r.timestamp),
    r.id,
  ];
}

function mealRecordToRow(r: MealRecord): (string | number)[] {
  return [
    formatJstDateTime(r.timestamp),
    MEAL_TYPE_LABELS[r.mealType] ?? r.mealType,
    r.confirmedName,
    r.confirmedKcal,
    r.confirmedProteinG,
    r.confirmedFatG,
    r.confirmedCarbsG,
    r.id,
  ];
}

function waterRecordToRow(r: WaterRecord): (string | number)[] {
  return [formatJstDateTime(r.timestamp), r.amountMl, r.id];
}

function workoutRecordToRow(r: WorkoutRecord): (string | number)[] {
  return [
    formatCalendarDate(r.date),
    r.exerciseName,
    r.exerciseOrder,
    r.setNumber,
    r.weightKg,
    r.reps,
    formatJstDateTime(r.timestamp),
    r.id,
  ];
}

function diaryRecordToRow(r: DiaryRecord): (string | number)[] {
  return [
    formatCalendarDate(r.date),
    (r.mood && DIARY_MOOD_LABELS[r.mood]) ?? r.mood ?? "",
    r.text,
    formatJstDateTime(r.timestamp),
    r.id,
    r.alcohol ? "あり" : "",
  ];
}

function foodMasterItemToRow(r: FoodMasterItem): (string | number)[] {
  return [
    r.name,
    r.kcal,
    r.proteinG,
    r.fatG,
    r.carbsG,
    r.source ?? "",
    formatJstDateTime(r.createdAt),
    r.id,
  ];
}

function exerciseMasterItemToRow(r: ExerciseMasterItem): (string | number)[] {
  return [r.name, formatJstDateTime(r.createdAt), r.id, (r.bodyPart && EXERCISE_BODY_PART_LABELS[r.bodyPart]) ?? r.bodyPart ?? ""];
}

// wins/actionsは配列。1セル内改行で並べると、シート上でも1行=1項目として読める
function settingsEntryToRow(e: SettingsEntry): (string | number)[] {
  const field = SETTINGS_FIELDS.find((f) => f.key === e.key);
  return [field?.label ?? e.key, e.value, e.key];
}

function adviceRecordToRow(r: PushableAdviceRecord): (string | number)[] {
  return [
    formatCalendarDate(r.weekStart),
    VERDICT_LABELS[r.advice.verdict] ?? r.advice.verdict,
    r.advice.summary,
    r.advice.wins.join("\n"),
    r.advice.actions.join("\n"),
    formatJstDateTime(r.createdAt),
    r.weekStart,
  ];
}

/**
 * 月キー(YYYY-MM)はそのままセルに書くと、USER_ENTERED でSheetsが日付(月初)へ解釈し直してしまう。
 * 表示列は漢字入りにして解釈させず、ID列は体重記録と同じ「フル日付」の形(実績のある形)に寄せる。
 */
export function monthToSheetId(month: string): string {
  return `${month}-01`;
}

export function monthToSheetLabel(month: string): string {
  const [year, mm] = month.split("-");
  return `${year}年${mm}月`;
}

function monthlyAdviceRecordToRow(r: PushableMonthlyAdviceRecord): (string | number)[] {
  return [
    monthToSheetLabel(r.month),
    VERDICT_LABELS[r.advice.verdict] ?? r.advice.verdict,
    r.advice.summary,
    r.advice.wins.join("\n"),
    r.advice.actions.join("\n"),
    formatJstDateTime(r.createdAt),
    monthToSheetId(r.month),
  ];
}

function bloodPressureRecordToRow(r: BloodPressureRecord): (string | number)[] {
  return [
    formatCalendarDate(r.date),
    r.systolic,
    r.diastolic,
    r.pulse ?? "",
    r.note ?? "",
    formatJstDateTime(r.timestamp),
    r.id,
  ];
}

function bodyMeasurementRecordToRow(r: BodyMeasurementRecord): (string | number)[] {
  return [
    formatCalendarDate(r.date),
    r.waistCm,
    r.chestCm ?? "",
    r.thighCm ?? "",
    r.note ?? "",
    formatJstDateTime(r.timestamp),
    r.id,
  ];
}

function habitMasterItemToRow(r: HabitMasterItem): (string | number)[] {
  return [r.name, r.targetWeeklyFrequency ?? "", r.archived ? "アーカイブ" : "", r.order, formatJstDateTime(r.createdAt), r.id];
}

function habitRecordToRow(r: HabitRecord): (string | number)[] {
  return [formatCalendarDate(r.date), r.habitName, r.habitId, formatJstDateTime(r.timestamp), r.id];
}

// ===== 純粋なプランニング関数(ネットワークに依存せずテスト可能) =====

export interface RowWrite {
  id: string;
  cells: (string | number)[];
}

export interface UpsertPlan {
  /** 既存行の上書き。rowNumberは1始まり */
  updates: { rowNumber: number; cells: (string | number)[] }[];
  /** 新規行の末尾追記 */
  appends: (string | number)[][];
}

/**
 * ID→既存行番号(1始まり)のマップを使い、各行を「既存行の更新」と「新規追記」に振り分ける(Issue #30)。
 * 同じIDが複数行に存在する場合(過去の追記のみ設計で生じた重複)は最初の行を更新対象にする。
 */
export function planUpserts(rows: RowWrite[], idToRows: Map<string, number[]>): UpsertPlan {
  const updates: { rowNumber: number; cells: (string | number)[] }[] = [];
  const appends: (string | number)[][] = [];
  for (const row of rows) {
    const existing = idToRows.get(row.id);
    if (existing && existing.length > 0) {
      updates.push({ rowNumber: existing[0], cells: row.cells });
    } else {
      appends.push(row.cells);
    }
  }
  return { updates, appends };
}

/**
 * 削除対象IDに一致する既存行の行番号を、降順(下の行から先に削除)で返す(Issue #30)。
 * 上の行を先に消すと下の行番号がずれるため、削除は必ず降順で行う。同一IDが重複している行はすべて対象にする。
 */
export function planRowDeletions(ids: string[], idToRows: Map<string, number[]>): number[] {
  const rowNumbers = new Set<number>();
  for (const id of ids) {
    for (const rowNumber of idToRows.get(id) ?? []) {
      rowNumbers.add(rowNumber);
    }
  }
  return [...rowNumbers].sort((a, b) => b - a);
}

// ===== Google Sheets API 呼び出し =====

/**
 * 指定タブのID列を読み、ID値→存在する行番号(1始まり)の一覧マップを返す。
 * allowMissing時はタブ欠如(範囲文字列は固定で正しいため、400=タブ名を解決できない)をnullで返す。
 */
async function readIdRows(
  accessToken: string,
  spreadsheetId: string,
  config: SheetConfig,
  allowMissing: false,
): Promise<Map<string, number[]>>;
async function readIdRows(
  accessToken: string,
  spreadsheetId: string,
  config: SheetConfig,
  allowMissing: true,
): Promise<Map<string, number[]> | null>;
async function readIdRows(
  accessToken: string,
  spreadsheetId: string,
  config: SheetConfig,
  allowMissing: boolean,
): Promise<Map<string, number[]> | null> {
  const range = encodeURIComponent(`${config.name}!${config.idColumnLetter}:${config.idColumnLetter}`);
  const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${range}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 400 && allowMissing) {
    return null;
  }
  await ensureSheetsOk(res);
  const data = (await res.json()) as { values?: (string | undefined)[][] };
  const map = new Map<string, number[]>();
  (data.values ?? []).forEach((cells, index) => {
    const raw = cells?.[0];
    if (raw === undefined || raw === "") return;
    const id = String(raw);
    const list = map.get(id) ?? [];
    list.push(index + 1); // 1始まりの行番号
    map.set(id, list);
  });
  return map;
}

/** 既存行を一括上書きする(values:batchUpdate)。範囲の先頭列はA固定で、cellsの列数分だけ書き込まれる。 */
async function batchUpdateRows(
  accessToken: string,
  spreadsheetId: string,
  config: SheetConfig,
  updates: { rowNumber: number; cells: (string | number)[] }[],
): Promise<void> {
  if (updates.length === 0) return;
  const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data: updates.map((u) => ({ range: `${config.name}!A${u.rowNumber}`, values: [u.cells] })),
    }),
  });
  await ensureSheetsOk(res);
}

/** 新規行を末尾に追記する(values.append) */
async function appendRows(
  accessToken: string,
  spreadsheetId: string,
  config: SheetConfig,
  rows: (string | number)[][],
): Promise<void> {
  if (rows.length === 0) return;
  const range = encodeURIComponent(`${config.name}!A:Z`);
  const res = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ values: rows }),
    },
  );
  await ensureSheetsOk(res);
}

/** タブ名から数値のsheetId(行削除のbatchUpdateで必要)を解決する */
async function resolveSheetId(accessToken: string, spreadsheetId: string, sheetName: string): Promise<number> {
  const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}?fields=sheets.properties(sheetId,title)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await ensureSheetsOk(res);
  const data = (await res.json()) as { sheets?: { properties?: { sheetId?: number; title?: string } }[] };
  const found = data.sheets?.find((s) => s.properties?.title === sheetName);
  if (!found?.properties || found.properties.sheetId === undefined) {
    throw new Error(`シート「${sheetName}」が見つかりません`);
  }
  return found.properties.sheetId;
}

/**
 * タブを新規作成し、1行目にヘッダーを書き込む(マスタ系タブの自動作成用。Issue #96)。
 * ヘッダーはRAWで書き込む — USER_ENTEREDだと「カロリー(kcal)」等が数式・日付として誤解釈されうるため。
 */
async function createSheetWithHeader(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  header: string[],
): Promise<void> {
  const addRes = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] }),
  });
  await ensureSheetsOk(addRes);
  const headerRes = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1`)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ values: [header] }),
    },
  );
  await ensureSheetsOk(headerRes);
}

/** 指定行(降順・1始まり)を物理削除する(batchUpdate deleteDimension)。下の行から順に削除するため行番号ズレは起きない。 */
async function deleteRows(
  accessToken: string,
  spreadsheetId: string,
  sheetId: number,
  rowNumbersDesc: number[],
): Promise<void> {
  if (rowNumbersDesc.length === 0) return;
  const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      requests: rowNumbersDesc.map((rowNumber) => ({
        deleteDimension: {
          range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber },
        },
      })),
    }),
  });
  await ensureSheetsOk(res);
}

/**
 * 1つのタブについて、更新/追記(upsert)と削除をまとめて反映する。
 * 成功時に「送信を確定したID」と「削除を確定したID」を返す。削除IDがシートに存在しなくても確定扱いにする(冪等)。
 * createHeaderIfMissingを渡すと、タブが無い場合にヘッダー行付きで自動作成して続行する(マスタ系タブ用。Issue #96)。
 */
async function syncOneSheet(
  accessToken: string,
  spreadsheetId: string,
  config: SheetConfig,
  rows: RowWrite[],
  deletionIds: string[],
  createHeaderIfMissing?: string[],
): Promise<{ syncedIds: string[]; deletedIds: string[] }> {
  if (rows.length === 0 && deletionIds.length === 0) {
    return { syncedIds: [], deletedIds: [] };
  }

  let idToRows: Map<string, number[]>;
  if (createHeaderIfMissing) {
    const existing = await readIdRows(accessToken, spreadsheetId, config, true);
    if (existing === null) {
      await createSheetWithHeader(accessToken, spreadsheetId, config.name, createHeaderIfMissing);
      idToRows = new Map();
    } else {
      idToRows = existing;
    }
  } else {
    idToRows = await readIdRows(accessToken, spreadsheetId, config, false);
  }

  // 更新→追記の順で書き込む。追記は末尾に増えるだけで既存の行番号をずらさないため、
  // 削除は追記前に読んだidToRowsの行番号をそのまま使える。
  const { updates, appends } = planUpserts(rows, idToRows);
  await batchUpdateRows(accessToken, spreadsheetId, config, updates);
  await appendRows(accessToken, spreadsheetId, config, appends);

  const deleteRowNumbers = planRowDeletions(deletionIds, idToRows);
  if (deleteRowNumbers.length > 0) {
    const sheetId = await resolveSheetId(accessToken, spreadsheetId, config.name);
    await deleteRows(accessToken, spreadsheetId, sheetId, deleteRowNumbers);
  }

  return { syncedIds: rows.map((r) => r.id), deletedIds: deletionIds };
}

/**
 * 未同期のレコードと削除トゥームストーンをスプレッドシートへ反映する。
 *
 * **タブごとに独立して処理し、部分的な成功をそのまま返す**(`Promise.allSettled`)。
 * 1タブが失敗しても他タブの同期は確定させる — 呼び出し元(`runSync`)は返ってきたIDだけを
 * 同期済みにするため、失敗分は次回の同期で再送信される。
 * **全タブが失敗したときだけ例外を投げる**(何も進んでいないため、呼び出し元にエラーを見せる)。
 */
export async function pushToSheets(
  payload: SyncPushPayload,
  { accessToken, spreadsheetId }: SheetsApiContext,
): Promise<SyncPushResult> {
  const weightRecords = payload.weightRecords ?? [];
  const mealRecords = payload.mealRecords ?? [];
  const waterRecords = payload.waterRecords ?? [];
  const workoutRecords = payload.workoutRecords ?? [];
  const diaryRecords = payload.diaryRecords ?? [];
  const foodMasterItems = payload.foodMasterItems ?? [];
  const exerciseMasterItems = payload.exerciseMasterItems ?? [];
  const settingsEntries = payload.settingsEntries ?? [];
  const adviceRecords = payload.adviceRecords ?? [];
  const monthlyAdviceRecords = payload.monthlyAdviceRecords ?? [];
  const bloodPressureRecords = payload.bloodPressureRecords ?? [];
  const bodyMeasurementRecords = payload.bodyMeasurementRecords ?? [];
  const habitMasterItems = payload.habitMasterItems ?? [];
  const habitRecords = payload.habitRecords ?? [];
  const deletedWeightIds = payload.deletedWeightIds ?? [];
  const deletedMealIds = payload.deletedMealIds ?? [];
  const deletedWaterIds = payload.deletedWaterIds ?? [];
  const deletedWorkoutIds = payload.deletedWorkoutIds ?? [];
  const deletedDiaryIds = payload.deletedDiaryIds ?? [];
  const deletedFoodMasterIds = payload.deletedFoodMasterIds ?? [];
  const deletedExerciseMasterIds = payload.deletedExerciseMasterIds ?? [];
  const deletedBloodPressureIds = payload.deletedBloodPressureIds ?? [];
  const deletedBodyMeasurementIds = payload.deletedBodyMeasurementIds ?? [];
  const deletedHabitMasterIds = payload.deletedHabitMasterIds ?? [];
  const deletedHabitRecordIds = payload.deletedHabitRecordIds ?? [];

  const [
    weightResult,
    mealResult,
    waterResult,
    workoutResult,
    diaryResult,
    foodMasterResult,
    exerciseMasterResult,
    bloodPressureResult,
    bodyMeasurementResult,
    habitMasterResult,
    habitRecordResult,
    adviceResult,
    monthlyAdviceResult,
    settingsResult,
  ] = await Promise.allSettled([
    syncOneSheet(
      accessToken,
      spreadsheetId,
      WEIGHT_CONFIG,
      weightRecords.map((r) => ({ id: r.id, cells: weightRecordToRow(r) })),
      deletedWeightIds,
      WEIGHT_HEADER,
    ),
    syncOneSheet(
      accessToken,
      spreadsheetId,
      MEAL_CONFIG,
      mealRecords.map((r) => ({ id: r.id, cells: mealRecordToRow(r) })),
      deletedMealIds,
      MEAL_HEADER,
    ),
    syncOneSheet(
      accessToken,
      spreadsheetId,
      WATER_CONFIG,
      waterRecords.map((r) => ({ id: r.id, cells: waterRecordToRow(r) })),
      deletedWaterIds,
      WATER_HEADER,
    ),
    syncOneSheet(
      accessToken,
      spreadsheetId,
      WORKOUT_CONFIG,
      workoutRecords.map((r) => ({ id: r.id, cells: workoutRecordToRow(r) })),
      deletedWorkoutIds,
      WORKOUT_HEADER,
    ),
    syncOneSheet(
      accessToken,
      spreadsheetId,
      DIARY_CONFIG,
      diaryRecords.map((r) => ({ id: r.id, cells: diaryRecordToRow(r) })),
      deletedDiaryIds,
      DIARY_HEADER,
    ),
    syncOneSheet(
      accessToken,
      spreadsheetId,
      FOOD_MASTER_CONFIG,
      foodMasterItems.map((r) => ({ id: r.id, cells: foodMasterItemToRow(r) })),
      deletedFoodMasterIds,
      FOOD_MASTER_HEADER,
    ),
    syncOneSheet(
      accessToken,
      spreadsheetId,
      EXERCISE_MASTER_CONFIG,
      exerciseMasterItems.map((r) => ({ id: r.id, cells: exerciseMasterItemToRow(r) })),
      deletedExerciseMasterIds,
      EXERCISE_MASTER_HEADER,
    ),
    syncOneSheet(
      accessToken,
      spreadsheetId,
      BLOOD_PRESSURE_CONFIG,
      bloodPressureRecords.map((r) => ({ id: r.id, cells: bloodPressureRecordToRow(r) })),
      deletedBloodPressureIds,
      BLOOD_PRESSURE_HEADER,
    ),
    syncOneSheet(
      accessToken,
      spreadsheetId,
      BODY_MEASUREMENT_CONFIG,
      bodyMeasurementRecords.map((r) => ({ id: r.id, cells: bodyMeasurementRecordToRow(r) })),
      deletedBodyMeasurementIds,
      BODY_MEASUREMENT_HEADER,
    ),
    syncOneSheet(
      accessToken,
      spreadsheetId,
      HABIT_MASTER_CONFIG,
      habitMasterItems.map((r) => ({ id: r.id, cells: habitMasterItemToRow(r) })),
      deletedHabitMasterIds,
      HABIT_MASTER_HEADER,
    ),
    syncOneSheet(
      accessToken,
      spreadsheetId,
      HABIT_RECORD_CONFIG,
      habitRecords.map((r) => ({ id: r.id, cells: habitRecordToRow(r) })),
      deletedHabitRecordIds,
      HABIT_RECORD_HEADER,
    ),
    // AIコメントは削除UIが無い(再生成は同じキーへの上書き)ため、削除IDは常に空
    syncOneSheet(
      accessToken,
      spreadsheetId,
      ADVICE_CONFIG,
      adviceRecords.map((r) => ({ id: r.weekStart, cells: adviceRecordToRow(r) })),
      [],
      ADVICE_HEADER,
    ),
    syncOneSheet(
      accessToken,
      spreadsheetId,
      MONTHLY_ADVICE_CONFIG,
      monthlyAdviceRecords.map((r) => ({ id: monthToSheetId(r.month), cells: monthlyAdviceRecordToRow(r) })),
      [],
      MONTHLY_ADVICE_HEADER,
    ),
    // 設定も削除の概念が無いので削除IDは常に空
    syncOneSheet(
      accessToken,
      spreadsheetId,
      SETTINGS_CONFIG,
      settingsEntries.map((e) => ({ id: e.key, cells: settingsEntryToRow(e) })),
      [],
      SETTINGS_HEADER,
    ),
  ]);

  // 失敗したタブは「何も確定しなかった」として空で返す(部分成功のハンドリングはクライアントのrunSyncが行う)
  const ok = (result: PromiseSettledResult<{ syncedIds: string[]; deletedIds: string[] }>) =>
    result.status === "fulfilled" ? result.value : { syncedIds: [], deletedIds: [] };

  const weight = ok(weightResult);
  const meal = ok(mealResult);
  const water = ok(waterResult);
  const workout = ok(workoutResult);
  const diary = ok(diaryResult);
  const foodMaster = ok(foodMasterResult);
  const exerciseMaster = ok(exerciseMasterResult);
  const bloodPressure = ok(bloodPressureResult);
  const bodyMeasurement = ok(bodyMeasurementResult);
  const habitMaster = ok(habitMasterResult);
  const habitRecord = ok(habitRecordResult);
  const advice = ok(adviceResult);
  const monthlyAdvice = ok(monthlyAdviceResult);
  const settings = ok(settingsResult);

  const labeledResults: [string, PromiseSettledResult<{ syncedIds: string[]; deletedIds: string[] }>][] = [
    ["体重記録", weightResult],
    ["食事記録", mealResult],
    ["水分記録", waterResult],
    ["筋トレ記録", workoutResult],
    ["日記記録", diaryResult],
    ["食事マスタ", foodMasterResult],
    ["種目マスタ", exerciseMasterResult],
    ["血圧記録", bloodPressureResult],
    ["周囲径記録", bodyMeasurementResult],
    ["習慣マスタ", habitMasterResult],
    ["習慣記録", habitRecordResult],
    ["週次AIコメント", adviceResult],
    ["月次AIコメント", monthlyAdviceResult],
    ["設定", settingsResult],
  ];
  for (const [label, result] of labeledResults) {
    if (result.status === "rejected") console.error(`${label}の同期に失敗:`, result.reason);
  }

  const attempted = [
    weightRecords,
    mealRecords,
    waterRecords,
    workoutRecords,
    diaryRecords,
    foodMasterItems,
    exerciseMasterItems,
    bloodPressureRecords,
    bodyMeasurementRecords,
    habitMasterItems,
    habitRecords,
    adviceRecords,
    monthlyAdviceRecords,
    settingsEntries,
    deletedWeightIds,
    deletedMealIds,
    deletedWaterIds,
    deletedWorkoutIds,
    deletedDiaryIds,
    deletedFoodMasterIds,
    deletedExerciseMasterIds,
    deletedBloodPressureIds,
    deletedBodyMeasurementIds,
    deletedHabitMasterIds,
    deletedHabitRecordIds,
  ].some((list) => list.length > 0);
  const nothingSynced = labeledResults.every(([, result]) => {
    const { syncedIds, deletedIds } = ok(result);
    return syncedIds.length === 0 && deletedIds.length === 0;
  });
  const anyFailure = labeledResults.some(([, result]) => result.status === "rejected");

  // 1件も進まずに全滅したときだけエラーにする(部分成功は正常系として返す)
  if (attempted && nothingSynced && anyFailure) {
    const messages = labeledResults
      .map(([, result]) => result)
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
    throw new Error(messages.join(" / "));
  }

  return {
    syncedWeightDates: weight.syncedIds,
    syncedMealIds: meal.syncedIds,
    syncedWaterIds: water.syncedIds,
    syncedWorkoutIds: workout.syncedIds,
    syncedDiaryDates: diary.syncedIds,
    syncedFoodMasterIds: foodMaster.syncedIds,
    syncedExerciseMasterIds: exerciseMaster.syncedIds,
    syncedBloodPressureDates: bloodPressure.syncedIds,
    syncedBodyMeasurementDates: bodyMeasurement.syncedIds,
    syncedHabitMasterIds: habitMaster.syncedIds,
    syncedHabitRecordIds: habitRecord.syncedIds,
    syncedAdviceWeekStarts: advice.syncedIds,
    // syncOneSheetはシート上のID(YYYY-MM-01)を返すので、クライアント契約の月キーへ戻す
    syncedMonthlyAdviceMonths: monthlyAdvice.syncedIds.map((id) => id.slice(0, 7)),
    syncedSettingsKeys: settings.syncedIds,
    deletedWeightIds: weight.deletedIds,
    deletedMealIds: meal.deletedIds,
    deletedWaterIds: water.deletedIds,
    deletedWorkoutIds: workout.deletedIds,
    deletedDiaryIds: diary.deletedIds,
    deletedFoodMasterIds: foodMaster.deletedIds,
    deletedExerciseMasterIds: exerciseMaster.deletedIds,
    deletedBloodPressureIds: bloodPressure.deletedIds,
    deletedBodyMeasurementIds: bodyMeasurement.deletedIds,
    deletedHabitMasterIds: habitMaster.deletedIds,
    deletedHabitRecordIds: habitRecord.deletedIds,
  };
}
