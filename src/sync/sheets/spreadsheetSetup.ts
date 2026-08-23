import {
  ADVICE_CONFIG,
  ADVICE_HEADER,
  BLOOD_PRESSURE_CONFIG,
  BLOOD_PRESSURE_HEADER,
  BODY_MEASUREMENT_CONFIG,
  BODY_MEASUREMENT_HEADER,
  DIARY_CONFIG,
  DIARY_HEADER,
  EXERCISE_MASTER_CONFIG,
  EXERCISE_MASTER_HEADER,
  ensureSheetsOk,
  FOOD_MASTER_CONFIG,
  FOOD_MASTER_HEADER,
  HABIT_MASTER_CONFIG,
  HABIT_MASTER_HEADER,
  HABIT_RECORD_CONFIG,
  HABIT_RECORD_HEADER,
  MEAL_CONFIG,
  MEAL_HEADER,
  MONTHLY_ADVICE_CONFIG,
  MONTHLY_ADVICE_HEADER,
  SETTINGS_CONFIG,
  SETTINGS_HEADER,
  SHEETS_API_BASE,
  WATER_CONFIG,
  WATER_HEADER,
  WEIGHT_CONFIG,
  WEIGHT_HEADER,
  WORKOUT_CONFIG,
  WORKOUT_HEADER,
} from "./sheetsSync";

/**
 * 同期先スプレッドシートをユーザー自身のDriveに新規作成する(Issue #216)。
 *
 * **`drive.file` スコープでは「アプリが作成したファイル」にしかアクセスできない。**
 * つまり配布版では、同期先はアプリが作ったシートである必要がある — 既存シートのIDを
 * 手入力しても権限が無く、Googleは403を返す(この制約が本Issueの存在理由)。
 *
 * **タブは全て自動作成する。** 移設前は「記録5タブは手動作成が前提、それ以外は同期時に自動作成」
 * という作りだったが(#96)、他人のDriveに置く以上、手動作成の前提は成立しない。
 */

/** 作成するタブと見出し行。並びはシート上のタブ順になるので、記録 → マスタ → 分析 → 設定の順に置く */
const TABS: { name: string; header: string[] }[] = [
  { name: WEIGHT_CONFIG.name, header: WEIGHT_HEADER },
  { name: MEAL_CONFIG.name, header: MEAL_HEADER },
  { name: WATER_CONFIG.name, header: WATER_HEADER },
  { name: WORKOUT_CONFIG.name, header: WORKOUT_HEADER },
  { name: DIARY_CONFIG.name, header: DIARY_HEADER },
  { name: BLOOD_PRESSURE_CONFIG.name, header: BLOOD_PRESSURE_HEADER },
  { name: BODY_MEASUREMENT_CONFIG.name, header: BODY_MEASUREMENT_HEADER },
  { name: HABIT_RECORD_CONFIG.name, header: HABIT_RECORD_HEADER },
  { name: FOOD_MASTER_CONFIG.name, header: FOOD_MASTER_HEADER },
  { name: EXERCISE_MASTER_CONFIG.name, header: EXERCISE_MASTER_HEADER },
  { name: HABIT_MASTER_CONFIG.name, header: HABIT_MASTER_HEADER },
  { name: ADVICE_CONFIG.name, header: ADVICE_HEADER },
  { name: MONTHLY_ADVICE_CONFIG.name, header: MONTHLY_ADVICE_HEADER },
  { name: SETTINGS_CONFIG.name, header: SETTINGS_HEADER },
];

/**
 * **活動記録タブは作らない。** Garmin連携(`scripts/garmin/garmin_to_sheet.py`)が自分で
 * タブと見出しを作る側であり、列構成の正はあちらにある。配布版のユーザーはGarmin連携を
 * 持たないためこのタブは存在しないままになるが、取り込みはタブが無い場合を許容している(#133)。
 */
export const ACTIVITY_TAB_CREATED_BY_GARMIN = true;

export interface CreatedSpreadsheet {
  spreadsheetId: string;
  /** ブラウザで開くURL。作成直後に「シートを開く」導線を出すために使う */
  spreadsheetUrl: string;
}

/** シートのタイトル。Drive上で見つけやすいようアプリ名を入れる */
export const SPREADSHEET_TITLE = "からだログ 記録";

/**
 * スプレッドシートを作り、全タブに見出し行を書き込んで返す。
 *
 * 作成(タブ込み)と見出し書き込みの2往復にしている。`spreadsheets.create` はタブを同時に作れるが、
 * セル値は `values:batchUpdate` でしか入れられないため。
 * **見出しはRAWで書く** — USER_ENTEREDだと「カロリー(kcal)」等が数式・日付として誤解釈されうる。
 */
export async function createSpreadsheet(accessToken: string): Promise<CreatedSpreadsheet> {
  const createRes = await fetch(SHEETS_API_BASE, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      properties: { title: SPREADSHEET_TITLE, locale: "ja_JP", timeZone: "Asia/Tokyo" },
      sheets: TABS.map((tab) => ({ properties: { title: tab.name } })),
    }),
  });
  await ensureSheetsOk(createRes);
  const created = (await createRes.json()) as { spreadsheetId?: string; spreadsheetUrl?: string };
  if (!created.spreadsheetId) throw new Error("スプレッドシートの作成に失敗しました");

  const headerRes = await fetch(`${SHEETS_API_BASE}/${created.spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      valueInputOption: "RAW",
      data: TABS.map((tab) => ({ range: `${tab.name}!A1`, values: [tab.header] })),
    }),
  });
  await ensureSheetsOk(headerRes);

  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl:
      created.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
  };
}

/** 保存済みのIDからシートのURLを組み立てる(設定画面の「シートを開く」用) */
export function spreadsheetUrlFor(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}
