import { getUnsyncedMealRecords, markMealRecordsSynced } from "../db/mealRecords";
import { updateSettings } from "../db/settings";
import { getUnsyncedWeightRecords, markWeightRecordsSynced } from "../db/weightRecords";
import { notConfiguredTransport } from "./notConfiguredTransport";
import type { SyncTransport } from "./types";

export type SyncOutcome =
  | { status: "success"; syncedCount: number }
  | { status: "skipped-offline" }
  | { status: "skipped-nothing-to-sync" }
  | { status: "error"; message: string };

export interface RunSyncOptions {
  transport?: SyncTransport;
  isOnline?: () => boolean;
}

/**
 * 未同期の体重・食事記録をまとめて送信先に送り、成功した分だけsyncedフラグを立てる。
 * 失敗時は記録を未同期のまま維持し、次回のトリガー(アプリ起動時・手動ボタン)で再試行できるようにする。
 */
export async function runSync({
  transport = notConfiguredTransport,
  isOnline = () => navigator.onLine,
}: RunSyncOptions = {}): Promise<SyncOutcome> {
  if (!isOnline()) {
    return { status: "skipped-offline" };
  }

  const [unsyncedWeightRecords, unsyncedMealRecords] = await Promise.all([
    getUnsyncedWeightRecords(),
    getUnsyncedMealRecords(),
  ]);

  if (unsyncedWeightRecords.length === 0 && unsyncedMealRecords.length === 0) {
    return { status: "skipped-nothing-to-sync" };
  }

  try {
    const result = await transport.push({
      weightRecords: unsyncedWeightRecords,
      mealRecords: unsyncedMealRecords,
    });

    await Promise.all([
      result.syncedWeightDates.length > 0
        ? markWeightRecordsSynced(result.syncedWeightDates)
        : Promise.resolve(),
      result.syncedMealIds.length > 0 ? markMealRecordsSynced(result.syncedMealIds) : Promise.resolve(),
    ]);
    await updateSettings({ lastSyncedAt: new Date().toISOString() });

    return {
      status: "success",
      syncedCount: result.syncedWeightDates.length + result.syncedMealIds.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "同期に失敗しました";
    return { status: "error", message };
  }
}
