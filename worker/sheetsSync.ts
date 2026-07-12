import { getGoogleAccessToken } from "./googleSheetsAuth";
import type { Env } from "./index";
import { DIARY_MOOD_LABELS } from "./diaryMoodLabels";
import { EXERCISE_BODY_PART_LABELS } from "./exerciseBodyPartLabels";
import { MEAL_TYPE_LABELS } from "./mealTypeLabels";

// worker/tsconfig.json は src/ に依存しない独立ビルドのため、必要な形をここにローカルで複製している。
// src/types.ts・src/sync/types.ts と手動で同期を保つこと。
interface WeightRecordInput {
  id: string;
  date: string;
  timestamp: string;
  weightKg: number;
  bodyFatPercent?: number;
  note?: string;
}

interface MealRecordInput {
  id: string;
  timestamp: string;
  mealType: string;
  confirmedName: string;
  confirmedKcal: number;
  confirmedProteinG: number;
  confirmedFatG: number;
  confirmedCarbsG: number;
}

interface WaterRecordInput {
  id: string;
  timestamp: string;
  amountMl: number;
}

interface WorkoutRecordInput {
  id: string;
  date: string;
  timestamp: string;
  exerciseName: string;
  exerciseOrder: number;
  setNumber: number;
  weightKg: number;
  reps: number;
}

interface DiaryRecordInput {
  id: string;
  date: string;
  timestamp: string;
  text: string;
  mood?: string;
}

interface FoodMasterItemInput {
  id: string;
  name: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  source?: string;
  createdAt: string;
}

interface ExerciseMasterItemInput {
  id: string;
  name: string;
  bodyPart?: string; // 部位分類のキー(chest/back/...。Issue #104)。シートには日本語ラベルで書く
  createdAt: string;
}

interface SyncPushPayloadInput {
  weightRecords?: WeightRecordInput[];
  mealRecords?: MealRecordInput[];
  waterRecords?: WaterRecordInput[];
  workoutRecords?: WorkoutRecordInput[];
  diaryRecords?: DiaryRecordInput[];
  foodMasterItems?: FoodMasterItemInput[];
  exerciseMasterItems?: ExerciseMasterItemInput[];
  deletedWeightIds?: string[];
  deletedMealIds?: string[];
  deletedWaterIds?: string[];
  deletedWorkoutIds?: string[];
  deletedDiaryIds?: string[];
  deletedFoodMasterIds?: string[];
  deletedExerciseMasterIds?: string[];
}

interface SyncPushResultOutput {
  syncedWeightDates: string[];
  syncedMealIds: string[];
  syncedWaterIds: string[];
  syncedWorkoutIds: string[];
  syncedDiaryDates: string[];
  syncedFoodMasterIds: string[];
  syncedExerciseMasterIds: string[];
  deletedWeightIds: string[];
  deletedMealIds: string[];
  deletedWaterIds: string[];
  deletedWorkoutIds: string[];
  deletedDiaryIds: string[];
  deletedFoodMasterIds: string[];
  deletedExerciseMasterIds: string[];
}

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
export const DIARY_CONFIG: SheetConfig = { name: "日記記録", idColumnLetter: "E" };
export const FOOD_MASTER_CONFIG: SheetConfig = { name: "食事マスタ", idColumnLetter: "H" };
// 部位列(D)はID列(C)より後ろにあるため(後付けのIssue #104。既存シートのID列を動かさないため)、
// 取り込みの読み取り範囲はID列ではなくlastColumnLetterまで広げる必要がある
export const EXERCISE_MASTER_CONFIG: SheetConfig = { name: "種目マスタ", idColumnLetter: "C", lastColumnLetter: "D" };

// マスタ系タブは記録系と違い後付けのため(Issue #96)、既存スプレッドシートには存在しない。
// 同期時にタブが無ければWorkerがこのヘッダー行付きで自動作成する(記録系タブは手動作成が前提のまま)
export const FOOD_MASTER_HEADER = ["品目名", "カロリー(kcal)", "たんぱく質(g)", "脂質(g)", "炭水化物(g)", "出典", "登録日時", "ID"];
export const EXERCISE_MASTER_HEADER = ["種目名", "登録日時", "ID", "部位"];

export const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

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

function weightRecordToRow(r: WeightRecordInput): (string | number)[] {
  return [
    formatCalendarDate(r.date),
    r.weightKg,
    r.bodyFatPercent ?? "",
    r.note ?? "",
    formatJstDateTime(r.timestamp),
    r.id,
  ];
}

function mealRecordToRow(r: MealRecordInput): (string | number)[] {
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

function waterRecordToRow(r: WaterRecordInput): (string | number)[] {
  return [formatJstDateTime(r.timestamp), r.amountMl, r.id];
}

function workoutRecordToRow(r: WorkoutRecordInput): (string | number)[] {
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

function diaryRecordToRow(r: DiaryRecordInput): (string | number)[] {
  return [
    formatCalendarDate(r.date),
    (r.mood && DIARY_MOOD_LABELS[r.mood]) ?? r.mood ?? "",
    r.text,
    formatJstDateTime(r.timestamp),
    r.id,
  ];
}

function foodMasterItemToRow(r: FoodMasterItemInput): (string | number)[] {
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

function exerciseMasterItemToRow(r: ExerciseMasterItemInput): (string | number)[] {
  return [r.name, formatJstDateTime(r.createdAt), r.id, (r.bodyPart && EXERCISE_BODY_PART_LABELS[r.bodyPart]) ?? r.bodyPart ?? ""];
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
  if (!res.ok) {
    throw new Error(`Sheets APIエラー (${res.status}): ${await res.text()}`);
  }
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
  if (!res.ok) {
    throw new Error(`Sheets APIエラー (${res.status}): ${await res.text()}`);
  }
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
  if (!res.ok) {
    throw new Error(`Sheets APIエラー (${res.status}): ${await res.text()}`);
  }
}

/** タブ名から数値のsheetId(行削除のbatchUpdateで必要)を解決する */
async function resolveSheetId(accessToken: string, spreadsheetId: string, sheetName: string): Promise<number> {
  const res = await fetch(`${SHEETS_API_BASE}/${spreadsheetId}?fields=sheets.properties(sheetId,title)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Sheets APIエラー (${res.status}): ${await res.text()}`);
  }
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
  if (!addRes.ok) {
    throw new Error(`Sheets APIエラー (${addRes.status}): ${await addRes.text()}`);
  }
  const headerRes = await fetch(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A1`)}?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ values: [header] }),
    },
  );
  if (!headerRes.ok) {
    throw new Error(`Sheets APIエラー (${headerRes.status}): ${await headerRes.text()}`);
  }
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
  if (!res.ok) {
    throw new Error(`Sheets APIエラー (${res.status}): ${await res.text()}`);
  }
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

export async function handleSyncSheets(request: Request, env: Env): Promise<Response> {
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || !env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    return Response.json({ error: "Google Sheets連携が未設定です(環境変数を確認してください)" }, { status: 500 });
  }

  let payload: SyncPushPayloadInput;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "リクエストボディの解析に失敗しました" }, { status: 400 });
  }
  const weightRecords = payload.weightRecords ?? [];
  const mealRecords = payload.mealRecords ?? [];
  const waterRecords = payload.waterRecords ?? [];
  const workoutRecords = payload.workoutRecords ?? [];
  const diaryRecords = payload.diaryRecords ?? [];
  const foodMasterItems = payload.foodMasterItems ?? [];
  const exerciseMasterItems = payload.exerciseMasterItems ?? [];
  const deletedWeightIds = payload.deletedWeightIds ?? [];
  const deletedMealIds = payload.deletedMealIds ?? [];
  const deletedWaterIds = payload.deletedWaterIds ?? [];
  const deletedWorkoutIds = payload.deletedWorkoutIds ?? [];
  const deletedDiaryIds = payload.deletedDiaryIds ?? [];
  const deletedFoodMasterIds = payload.deletedFoodMasterIds ?? [];
  const deletedExerciseMasterIds = payload.deletedExerciseMasterIds ?? [];

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(env);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google認証に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }

  const spreadsheetId = env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const [weightResult, mealResult, waterResult, workoutResult, diaryResult, foodMasterResult, exerciseMasterResult] = await Promise.allSettled([
    syncOneSheet(
      accessToken,
      spreadsheetId,
      WEIGHT_CONFIG,
      weightRecords.map((r) => ({ id: r.id, cells: weightRecordToRow(r) })),
      deletedWeightIds,
    ),
    syncOneSheet(
      accessToken,
      spreadsheetId,
      MEAL_CONFIG,
      mealRecords.map((r) => ({ id: r.id, cells: mealRecordToRow(r) })),
      deletedMealIds,
    ),
    syncOneSheet(
      accessToken,
      spreadsheetId,
      WATER_CONFIG,
      waterRecords.map((r) => ({ id: r.id, cells: waterRecordToRow(r) })),
      deletedWaterIds,
    ),
    syncOneSheet(
      accessToken,
      spreadsheetId,
      WORKOUT_CONFIG,
      workoutRecords.map((r) => ({ id: r.id, cells: workoutRecordToRow(r) })),
      deletedWorkoutIds,
    ),
    syncOneSheet(
      accessToken,
      spreadsheetId,
      DIARY_CONFIG,
      diaryRecords.map((r) => ({ id: r.id, cells: diaryRecordToRow(r) })),
      deletedDiaryIds,
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
  ]);

  const syncedWeightDates = weightResult.status === "fulfilled" ? weightResult.value.syncedIds : [];
  const deletedWeightIdsOut = weightResult.status === "fulfilled" ? weightResult.value.deletedIds : [];
  const syncedMealIds = mealResult.status === "fulfilled" ? mealResult.value.syncedIds : [];
  const deletedMealIdsOut = mealResult.status === "fulfilled" ? mealResult.value.deletedIds : [];
  const syncedWaterIds = waterResult.status === "fulfilled" ? waterResult.value.syncedIds : [];
  const deletedWaterIdsOut = waterResult.status === "fulfilled" ? waterResult.value.deletedIds : [];
  const syncedWorkoutIds = workoutResult.status === "fulfilled" ? workoutResult.value.syncedIds : [];
  const deletedWorkoutIdsOut = workoutResult.status === "fulfilled" ? workoutResult.value.deletedIds : [];
  const syncedDiaryDates = diaryResult.status === "fulfilled" ? diaryResult.value.syncedIds : [];
  const deletedDiaryIdsOut = diaryResult.status === "fulfilled" ? diaryResult.value.deletedIds : [];
  const syncedFoodMasterIds = foodMasterResult.status === "fulfilled" ? foodMasterResult.value.syncedIds : [];
  const deletedFoodMasterIdsOut = foodMasterResult.status === "fulfilled" ? foodMasterResult.value.deletedIds : [];
  const syncedExerciseMasterIds =
    exerciseMasterResult.status === "fulfilled" ? exerciseMasterResult.value.syncedIds : [];
  const deletedExerciseMasterIdsOut =
    exerciseMasterResult.status === "fulfilled" ? exerciseMasterResult.value.deletedIds : [];

  if (weightResult.status === "rejected") console.error("体重記録の同期に失敗:", weightResult.reason);
  if (mealResult.status === "rejected") console.error("食事記録の同期に失敗:", mealResult.reason);
  if (waterResult.status === "rejected") console.error("水分記録の同期に失敗:", waterResult.reason);
  if (workoutResult.status === "rejected") console.error("筋トレ記録の同期に失敗:", workoutResult.reason);
  if (diaryResult.status === "rejected") console.error("日記記録の同期に失敗:", diaryResult.reason);
  if (foodMasterResult.status === "rejected") console.error("食事マスタの同期に失敗:", foodMasterResult.reason);
  if (exerciseMasterResult.status === "rejected")
    console.error("種目マスタの同期に失敗:", exerciseMasterResult.reason);

  const attempted =
    weightRecords.length +
      mealRecords.length +
      waterRecords.length +
      workoutRecords.length +
      diaryRecords.length +
      foodMasterItems.length +
      exerciseMasterItems.length +
      deletedWeightIds.length +
      deletedMealIds.length +
      deletedWaterIds.length +
      deletedWorkoutIds.length +
      deletedDiaryIds.length +
      deletedFoodMasterIds.length +
      deletedExerciseMasterIds.length >
    0;
  const nothingSynced =
    syncedWeightDates.length +
      deletedWeightIdsOut.length +
      syncedMealIds.length +
      deletedMealIdsOut.length +
      syncedWaterIds.length +
      deletedWaterIdsOut.length +
      syncedWorkoutIds.length +
      deletedWorkoutIdsOut.length +
      syncedDiaryDates.length +
      deletedDiaryIdsOut.length +
      syncedFoodMasterIds.length +
      deletedFoodMasterIdsOut.length +
      syncedExerciseMasterIds.length +
      deletedExerciseMasterIdsOut.length ===
    0;
  const results = [
    weightResult,
    mealResult,
    waterResult,
    workoutResult,
    diaryResult,
    foodMasterResult,
    exerciseMasterResult,
  ];
  const anyFailure = results.some((r) => r.status === "rejected");

  if (attempted && nothingSynced && anyFailure) {
    const messages = results
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
    return Response.json({ error: messages.join(" / ") }, { status: 502 });
  }

  return Response.json({
    syncedWeightDates,
    syncedMealIds,
    syncedWaterIds,
    syncedWorkoutIds,
    syncedDiaryDates,
    syncedFoodMasterIds,
    syncedExerciseMasterIds,
    deletedWeightIds: deletedWeightIdsOut,
    deletedMealIds: deletedMealIdsOut,
    deletedWaterIds: deletedWaterIdsOut,
    deletedWorkoutIds: deletedWorkoutIdsOut,
    deletedDiaryIds: deletedDiaryIdsOut,
    deletedFoodMasterIds: deletedFoodMasterIdsOut,
    deletedExerciseMasterIds: deletedExerciseMasterIdsOut,
  } satisfies SyncPushResultOutput);
}
