import { getUnsyncedDiaryRecords, markDiaryRecordsSynced } from "@/db/diaryRecords";
import { getUnsyncedExerciseMasterItems, markExerciseMasterItemsSynced } from "@/db/exerciseMaster";
import { getUnsyncedFoodMasterItems, markFoodMasterItemsSynced } from "@/db/foodMaster";
import { getUnsyncedMealRecords, markMealRecordsSynced } from "@/db/mealRecords";
import { updateSettings } from "@/db/settings";
import { clearDeletions, getPendingDeletionIds } from "@/db/syncDeletions";
import { getUnsyncedWaterRecords, markWaterRecordsSynced } from "@/db/waterRecords";
import { getUnsyncedWeightRecords, markWeightRecordsSynced } from "@/db/weightRecords";
import { getUnsyncedWorkoutRecords, markWorkoutRecordsSynced } from "@/db/workoutRecords";
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
 * 未同期の体重・食事・水分・筋トレ・日記記録と食事マスタ・種目マスタをまとめて送信先に送り、
 * 成功した分だけsyncedフラグを立てる。
 * 失敗時は記録を未同期のまま維持し、次回のトリガー(アプリ起動時・手動ボタン)で再試行できるようにする。
 */
export async function runSync({
  transport = notConfiguredTransport,
  isOnline = () => navigator.onLine,
}: RunSyncOptions = {}): Promise<SyncOutcome> {
  if (!isOnline()) {
    return { status: "skipped-offline" };
  }

  const [
    unsyncedWeightRecords,
    unsyncedMealRecords,
    unsyncedWaterRecords,
    unsyncedWorkoutRecords,
    unsyncedDiaryRecords,
    unsyncedFoodMasterItems,
    unsyncedExerciseMasterItems,
    deletedWeightIds,
    deletedMealIds,
    deletedWaterIds,
    deletedWorkoutIds,
    deletedDiaryIds,
    deletedFoodMasterIds,
    deletedExerciseMasterIds,
  ] = await Promise.all([
    getUnsyncedWeightRecords(),
    getUnsyncedMealRecords(),
    getUnsyncedWaterRecords(),
    getUnsyncedWorkoutRecords(),
    getUnsyncedDiaryRecords(),
    getUnsyncedFoodMasterItems(),
    getUnsyncedExerciseMasterItems(),
    getPendingDeletionIds("weight"),
    getPendingDeletionIds("meal"),
    getPendingDeletionIds("water"),
    getPendingDeletionIds("workout"),
    getPendingDeletionIds("diary"),
    getPendingDeletionIds("foodMaster"),
    getPendingDeletionIds("exerciseMaster"),
  ]);

  if (
    unsyncedWeightRecords.length === 0 &&
    unsyncedMealRecords.length === 0 &&
    unsyncedWaterRecords.length === 0 &&
    unsyncedWorkoutRecords.length === 0 &&
    unsyncedDiaryRecords.length === 0 &&
    unsyncedFoodMasterItems.length === 0 &&
    unsyncedExerciseMasterItems.length === 0 &&
    deletedWeightIds.length === 0 &&
    deletedMealIds.length === 0 &&
    deletedWaterIds.length === 0 &&
    deletedWorkoutIds.length === 0 &&
    deletedDiaryIds.length === 0 &&
    deletedFoodMasterIds.length === 0 &&
    deletedExerciseMasterIds.length === 0
  ) {
    return { status: "skipped-nothing-to-sync" };
  }

  try {
    const result = await transport.push({
      weightRecords: unsyncedWeightRecords,
      mealRecords: unsyncedMealRecords,
      waterRecords: unsyncedWaterRecords,
      workoutRecords: unsyncedWorkoutRecords,
      diaryRecords: unsyncedDiaryRecords,
      foodMasterItems: unsyncedFoodMasterItems,
      exerciseMasterItems: unsyncedExerciseMasterItems,
      deletedWeightIds,
      deletedMealIds,
      deletedWaterIds,
      deletedWorkoutIds,
      deletedDiaryIds,
      deletedFoodMasterIds,
      deletedExerciseMasterIds,
    });

    const confirmedWeightDeletions = result.deletedWeightIds ?? [];
    const confirmedMealDeletions = result.deletedMealIds ?? [];
    const confirmedWaterDeletions = result.deletedWaterIds ?? [];
    const confirmedWorkoutDeletions = result.deletedWorkoutIds ?? [];
    const confirmedDiaryDeletions = result.deletedDiaryIds ?? [];
    const confirmedFoodMasterDeletions = result.deletedFoodMasterIds ?? [];
    const confirmedExerciseMasterDeletions = result.deletedExerciseMasterIds ?? [];
    // 旧Worker(マスタ未対応)からのレスポンスでは同期済みID一覧自体が欠けるため、空とみなす
    const syncedFoodMasterIds = result.syncedFoodMasterIds ?? [];
    const syncedExerciseMasterIds = result.syncedExerciseMasterIds ?? [];

    await Promise.all([
      result.syncedWeightDates.length > 0
        ? markWeightRecordsSynced(result.syncedWeightDates)
        : Promise.resolve(),
      result.syncedMealIds.length > 0 ? markMealRecordsSynced(result.syncedMealIds) : Promise.resolve(),
      result.syncedWaterIds.length > 0 ? markWaterRecordsSynced(result.syncedWaterIds) : Promise.resolve(),
      result.syncedWorkoutIds.length > 0
        ? markWorkoutRecordsSynced(result.syncedWorkoutIds)
        : Promise.resolve(),
      result.syncedDiaryDates.length > 0
        ? markDiaryRecordsSynced(result.syncedDiaryDates)
        : Promise.resolve(),
      syncedFoodMasterIds.length > 0 ? markFoodMasterItemsSynced(syncedFoodMasterIds) : Promise.resolve(),
      syncedExerciseMasterIds.length > 0
        ? markExerciseMasterItemsSynced(syncedExerciseMasterIds)
        : Promise.resolve(),
      clearDeletions("weight", confirmedWeightDeletions),
      clearDeletions("meal", confirmedMealDeletions),
      clearDeletions("water", confirmedWaterDeletions),
      clearDeletions("workout", confirmedWorkoutDeletions),
      clearDeletions("diary", confirmedDiaryDeletions),
      clearDeletions("foodMaster", confirmedFoodMasterDeletions),
      clearDeletions("exerciseMaster", confirmedExerciseMasterDeletions),
    ]);
    await updateSettings({ lastSyncedAt: new Date().toISOString() });

    return {
      status: "success",
      syncedCount:
        result.syncedWeightDates.length +
        result.syncedMealIds.length +
        result.syncedWaterIds.length +
        result.syncedWorkoutIds.length +
        result.syncedDiaryDates.length +
        syncedFoodMasterIds.length +
        syncedExerciseMasterIds.length +
        confirmedWeightDeletions.length +
        confirmedMealDeletions.length +
        confirmedWaterDeletions.length +
        confirmedWorkoutDeletions.length +
        confirmedDiaryDeletions.length +
        confirmedFoodMasterDeletions.length +
        confirmedExerciseMasterDeletions.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "同期に失敗しました";
    return { status: "error", message };
  }
}
