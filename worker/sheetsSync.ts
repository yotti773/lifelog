import { getGoogleAccessToken } from "./googleSheetsAuth";
import type { Env } from "./index";
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

interface SyncPushPayloadInput {
  weightRecords?: WeightRecordInput[];
  mealRecords?: MealRecordInput[];
}

interface SyncPushResultOutput {
  syncedWeightDates: string[];
  syncedMealIds: string[];
}

// タブ名にスペースやアポストロフィが含まれる場合は `'${sheetName}'!A:Z` 形式(埋め込み`'`は`''`にエスケープ)に変更すること。
const WEIGHT_SHEET_NAME = "体重記録";
const MEAL_SHEET_NAME = "食事記録";

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

async function appendRows(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rows: (string | number)[][],
): Promise<void> {
  if (rows.length === 0) return;

  const range = encodeURIComponent(`${sheetName}!A:Z`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
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

  let accessToken: string;
  try {
    accessToken = await getGoogleAccessToken(env);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google認証に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }

  const [weightResult, mealResult] = await Promise.allSettled([
    appendRows(accessToken, env.GOOGLE_SHEETS_SPREADSHEET_ID, WEIGHT_SHEET_NAME, weightRecords.map(weightRecordToRow)),
    appendRows(accessToken, env.GOOGLE_SHEETS_SPREADSHEET_ID, MEAL_SHEET_NAME, mealRecords.map(mealRecordToRow)),
  ]);

  const syncedWeightDates = weightResult.status === "fulfilled" ? weightRecords.map((r) => r.date) : [];
  const syncedMealIds = mealResult.status === "fulfilled" ? mealRecords.map((r) => r.id) : [];

  if (weightResult.status === "rejected") console.error("体重記録の同期に失敗:", weightResult.reason);
  if (mealResult.status === "rejected") console.error("食事記録の同期に失敗:", mealResult.reason);

  const attempted = weightRecords.length > 0 || mealRecords.length > 0;
  const nothingSynced = syncedWeightDates.length === 0 && syncedMealIds.length === 0;
  const anyFailure = weightResult.status === "rejected" || mealResult.status === "rejected";

  if (attempted && nothingSynced && anyFailure) {
    const messages = [weightResult, mealResult]
      .filter((r): r is PromiseRejectedResult => r.status === "rejected")
      .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
    return Response.json({ error: messages.join(" / ") }, { status: 502 });
  }

  return Response.json({ syncedWeightDates, syncedMealIds } satisfies SyncPushResultOutput);
}
