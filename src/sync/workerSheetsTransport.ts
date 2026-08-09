import { requestApi, SYNC_REQUEST_TIMEOUT_MS } from "@/api/request";
import type {
  SyncPullActivityResult,
  SyncPullActivityTransport,
  SyncPullResult,
  SyncPullTransport,
  SyncPushPayload,
  SyncPushResult,
  SyncTransport,
} from "./types";

/** Cloudflare Worker(/api/sync-sheets ほか)経由でGoogle Sheetsと読み書きする本番用トランスポート(画面設計書10章参照)。 */
export const workerSheetsTransport: SyncTransport & SyncPullTransport & SyncPullActivityTransport = {
  async push(payload: SyncPushPayload): Promise<SyncPushResult> {
    return requestApi<SyncPushResult>("/api/sync-sheets", {
      method: "POST",
      body: payload,
      timeoutMs: SYNC_REQUEST_TIMEOUT_MS,
      fallbackErrorMessage: (status) => `同期に失敗しました (${status})`,
    });
  },

  async pull(): Promise<SyncPullResult> {
    return requestApi<SyncPullResult>("/api/import-sheets", {
      timeoutMs: SYNC_REQUEST_TIMEOUT_MS,
      fallbackErrorMessage: (status) => `取り込みに失敗しました (${status})`,
    });
  },

  async pullActivity(): Promise<SyncPullActivityResult> {
    return requestApi<SyncPullActivityResult>("/api/import-activity", {
      timeoutMs: SYNC_REQUEST_TIMEOUT_MS,
      fallbackErrorMessage: (status) => `活動記録の取り込みに失敗しました (${status})`,
    });
  },
};
