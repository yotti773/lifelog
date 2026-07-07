import type { SyncPullResult, SyncPullTransport, SyncPushPayload, SyncPushResult, SyncTransport } from "./types";

/** Cloudflare Worker(/api/sync-sheets ほか)経由でGoogle Sheetsと読み書きする本番用トランスポート(画面設計書10章参照)。 */
export const workerSheetsTransport: SyncTransport & SyncPullTransport = {
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

  async pull(): Promise<SyncPullResult> {
    const res = await fetch("/api/import-sheets");

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `取り込みに失敗しました (${res.status})`);
    }

    return (await res.json()) as SyncPullResult;
  },
};
