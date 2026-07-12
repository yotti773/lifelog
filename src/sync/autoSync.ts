import { runSync, type SyncOutcome } from "./syncEngine";
import { workerSheetsTransport } from "./workerSheetsTransport";

/**
 * 自動同期のトリガー管理(Issue #105)。
 * 起動時1回だけだった自動同期を「アプリ復帰時(visibilitychange)・オンライン復帰時(online)」にも
 * 実行できるようにするための薄いラッパーで、以下だけを責務にする:
 * - スロットリング: タブ切り替え等で短時間に連続発火しても、前回試行からminIntervalMs以内は何もしない
 * - 再入抑止: 同期の実行中に重ねてトリガーされても2本目を走らせない
 * 失敗の扱いは従来どおり(未同期フラグが維持され次回再試行される)なので、結果は握りつぶしてよい。
 */

/** 自動トリガーの最小間隔。手動同期(設定画面のボタン)はこの制限を受けない */
export const AUTO_SYNC_MIN_INTERVAL_MS = 5 * 60 * 1000;

export interface AutoSyncTriggerOptions {
  /**
   * 最小間隔のチェックを飛ばして即時に試行する。オフライン→オンライン復帰(onlineイベント)用 —
   * 「今まで不可能だった同期が可能になった」という明確なシグナルなので、間隔を待たせる意味がない
   */
  bypassInterval?: boolean;
}

export interface AutoSyncRunner {
  /** 同期を試行する。スロットリング・再入抑止で実行しなかった場合はnullを返す */
  trigger: (options?: AutoSyncTriggerOptions) => Promise<SyncOutcome | null>;
}

export interface CreateAutoSyncRunnerOptions {
  run?: () => Promise<SyncOutcome>;
  minIntervalMs?: number;
  now?: () => number;
}

export function createAutoSyncRunner({
  run = () => runSync({ transport: workerSheetsTransport }),
  minIntervalMs = AUTO_SYNC_MIN_INTERVAL_MS,
  now = () => Date.now(),
}: CreateAutoSyncRunnerOptions = {}): AutoSyncRunner {
  let inFlight = false;
  let lastAttemptAt: number | null = null;

  return {
    async trigger(options = {}) {
      if (inFlight) return null;
      if (!options.bypassInterval && lastAttemptAt !== null && now() - lastAttemptAt < minIntervalMs) {
        return null;
      }
      inFlight = true;
      try {
        const outcome = await run();
        // オフラインで何もしなかった場合は「試行」に数えない — 記録した時刻が
        // オンライン復帰直後のvisibilitychangeトリガーまで抑止してしまうため
        if (outcome.status !== "skipped-offline") {
          lastAttemptAt = now();
        }
        return outcome;
      } finally {
        inFlight = false;
      }
    },
  };
}
