import { getGoogleAccessToken } from "@/api/googleOAuth";
import { getSettings } from "@/db/settings";
import { pullActivityFromSheets, pullFromSheets } from "./sheets/sheetsImport";
import type { SheetsApiContext } from "./sheets/sheetsSync";
import { pushToSheets } from "./sheets/sheetsSync";
import type {
  SyncPullActivityResult,
  SyncPullResult,
  SyncPushPayload,
  SyncPushResult,
  SyncTransport,
  SyncPullActivityTransport,
  SyncPullTransport,
} from "./types";

/**
 * Google Sheets APIを**ブラウザから直接**叩く本番用トランスポート(Issue #215)。
 *
 * 移設前は Worker(`/api/sync-sheets` ほか)を中継していた。クライアント直にしたのは、
 * **他人の健康データを開発者のインフラに一切通さない**ため(検討メモ12.8の案A)。
 * Workerに残るのはAIの2本と写真判定だけで、そちらはダイジェスト・写真しか受け取らない。
 *
 * 必要なものは2つ:
 * - **access token** — #214 のユーザー自身の認可から得る。失効時は `getGoogleAccessToken` が
 *   未連携に戻して再連携を促すため、ここでは扱わない
 * - **スプレッドシートID** — #216 でアプリが作成し `Settings.spreadsheetId` に保存したもの。
 *   `drive.file` はアプリが作ったファイルにしかアクセスできないため、**IDの手入力では代用できない**
 */

/** 同期先が未設定(Google未連携・シート未作成)のときのエラー文言。設定画面へ誘導する */
const NOT_READY_MESSAGE = "同期先のスプレッドシートがありません。設定画面でGoogleと連携してください";

async function sheetsContext(): Promise<SheetsApiContext> {
  const { spreadsheetId } = await getSettings();
  if (!spreadsheetId) throw new Error(NOT_READY_MESSAGE);
  // access tokenの取得は連携済みが前提。未連携ならここで「連携してください」のエラーになる
  const accessToken = await getGoogleAccessToken();
  return { accessToken, spreadsheetId };
}

export const googleSheetsTransport: SyncTransport & SyncPullTransport & SyncPullActivityTransport = {
  async push(payload: SyncPushPayload): Promise<SyncPushResult> {
    return pushToSheets(payload, await sheetsContext());
  },

  async pull(): Promise<SyncPullResult> {
    return pullFromSheets(await sheetsContext());
  },

  async pullActivity(): Promise<SyncPullActivityResult> {
    return pullActivityFromSheets(await sheetsContext());
  },
};
