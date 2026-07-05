import type { SyncPushPayload, SyncPushResult, SyncTransport } from "./types";

/** Cloudflare Worker(/api/sync-sheets)経由でGoogle Sheetsに書き込む本番用トランスポート(画面設計書7章参照)。 */
export const workerSheetsTransport: SyncTransport = {
  async push(payload: SyncPushPayload): Promise<SyncPushResult> {
    const res = await fetch("/api/sync-sheets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `同期に失敗しました (${res.status})`);
    }

    return (await res.json()) as SyncPushResult;
  },
};
