import type { SyncPullActivityTransport, SyncPullTransport, SyncTransport } from "./types";

export class SyncNotConfiguredError extends Error {
  constructor() {
    super("同期先(スプレッドシート連携)がまだ設定されていません");
    this.name = "SyncNotConfiguredError";
  }
}

/** Cloudflare Workers連携が実装されるまでのデフォルト送信先。常に未設定エラーを返す。 */
export const notConfiguredTransport: SyncTransport & SyncPullTransport & SyncPullActivityTransport = {
  async push() {
    throw new SyncNotConfiguredError();
  },
  async pull() {
    throw new SyncNotConfiguredError();
  },
  async pullActivity() {
    throw new SyncNotConfiguredError();
  },
};
