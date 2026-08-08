import {
  getUnsyncedAdviceRecords,
  getUnsyncedMonthlyAdviceRecords,
  markAdviceRecordsSynced,
  markMonthlyAdviceRecordsSynced,
} from "@/db/adviceRecords";
import { getUnsyncedBloodPressureRecords, markBloodPressureRecordsSynced } from "@/db/bloodPressureRecords";
import { getUnsyncedBodyMeasurementRecords, markBodyMeasurementRecordsSynced } from "@/db/bodyMeasurementRecords";
import { getUnsyncedDiaryRecords, markDiaryRecordsSynced } from "@/db/diaryRecords";
import { getUnsyncedExerciseMasterItems, markExerciseMasterItemsSynced } from "@/db/exerciseMaster";
import { getUnsyncedFoodMasterItems, markFoodMasterItemsSynced } from "@/db/foodMaster";
import { getUnsyncedHabitMasterItems, markHabitMasterItemsSynced } from "@/db/habitMaster";
import { getUnsyncedHabitRecords, markHabitRecordsSynced } from "@/db/habitRecords";
import { getUnsyncedMealRecords, markMealRecordsSynced } from "@/db/mealRecords";
import { getUnsyncedSettings, markSettingsSynced, updateSettings } from "@/db/settings";
import { clearDeletions, getPendingDeletionIds } from "@/db/syncDeletions";
import { getUnsyncedWaterRecords, markWaterRecordsSynced } from "@/db/waterRecords";
import { getUnsyncedWeightRecords, markWeightRecordsSynced } from "@/db/weightRecords";
import { getUnsyncedWorkoutRecords, markWorkoutRecordsSynced } from "@/db/workoutRecords";
import { notConfiguredTransport } from "./notConfiguredTransport";
import { toSettingsEntries } from "./settingsSync";
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
    unsyncedBloodPressureRecords,
    unsyncedBodyMeasurementRecords,
    unsyncedHabitMasterItems,
    unsyncedHabitRecords,
    unsyncedAdviceRecords,
    unsyncedMonthlyAdviceRecords,
    unsyncedSettings,
    deletedWeightIds,
    deletedMealIds,
    deletedWaterIds,
    deletedWorkoutIds,
    deletedDiaryIds,
    deletedFoodMasterIds,
    deletedExerciseMasterIds,
    deletedBloodPressureIds,
    deletedBodyMeasurementIds,
    deletedHabitMasterIds,
    deletedHabitRecordIds,
  ] = await Promise.all([
    getUnsyncedWeightRecords(),
    getUnsyncedMealRecords(),
    getUnsyncedWaterRecords(),
    getUnsyncedWorkoutRecords(),
    getUnsyncedDiaryRecords(),
    getUnsyncedFoodMasterItems(),
    getUnsyncedExerciseMasterItems(),
    getUnsyncedBloodPressureRecords(),
    getUnsyncedBodyMeasurementRecords(),
    getUnsyncedHabitMasterItems(),
    getUnsyncedHabitRecords(),
    getUnsyncedAdviceRecords(),
    getUnsyncedMonthlyAdviceRecords(),
    getUnsyncedSettings(),
    getPendingDeletionIds("weight"),
    getPendingDeletionIds("meal"),
    getPendingDeletionIds("water"),
    getPendingDeletionIds("workout"),
    getPendingDeletionIds("diary"),
    getPendingDeletionIds("foodMaster"),
    getPendingDeletionIds("exerciseMaster"),
    getPendingDeletionIds("bloodPressure"),
    getPendingDeletionIds("bodyMeasurement"),
    getPendingDeletionIds("habitMaster"),
    getPendingDeletionIds("habitRecord"),
  ]);

  // 設定は「行が未同期か」ではなく「送信できる項目があるか」で判定する。
  // APIトークンだけ入れた端末(移行直後にまさにこの状態)は送信対象が0件で、
  // 行の未同期フラグだけを見ると永久に同期待ちのまま残ってしまう
  const settingsEntries = unsyncedSettings ? toSettingsEntries(unsyncedSettings) : [];

  if (
    unsyncedWeightRecords.length === 0 &&
    unsyncedMealRecords.length === 0 &&
    unsyncedWaterRecords.length === 0 &&
    unsyncedWorkoutRecords.length === 0 &&
    unsyncedDiaryRecords.length === 0 &&
    unsyncedFoodMasterItems.length === 0 &&
    unsyncedExerciseMasterItems.length === 0 &&
    unsyncedBloodPressureRecords.length === 0 &&
    unsyncedBodyMeasurementRecords.length === 0 &&
    unsyncedHabitMasterItems.length === 0 &&
    unsyncedHabitRecords.length === 0 &&
    unsyncedAdviceRecords.length === 0 &&
    unsyncedMonthlyAdviceRecords.length === 0 &&
    settingsEntries.length === 0 &&
    deletedWeightIds.length === 0 &&
    deletedMealIds.length === 0 &&
    deletedWaterIds.length === 0 &&
    deletedWorkoutIds.length === 0 &&
    deletedDiaryIds.length === 0 &&
    deletedFoodMasterIds.length === 0 &&
    deletedExerciseMasterIds.length === 0 &&
    deletedBloodPressureIds.length === 0 &&
    deletedBodyMeasurementIds.length === 0 &&
    deletedHabitMasterIds.length === 0 &&
    deletedHabitRecordIds.length === 0
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
      bloodPressureRecords: unsyncedBloodPressureRecords,
      bodyMeasurementRecords: unsyncedBodyMeasurementRecords,
      habitMasterItems: unsyncedHabitMasterItems,
      habitRecords: unsyncedHabitRecords,
      // digestはシートに載せない。日記本文の送信がONの週は digest に本文が入りうるため落としてから送る
      settingsEntries,
      adviceRecords: unsyncedAdviceRecords.map(({ digest: _digest, ...rest }) => rest),
      monthlyAdviceRecords: unsyncedMonthlyAdviceRecords.map(({ digest: _digest, ...rest }) => rest),
      deletedWeightIds,
      deletedMealIds,
      deletedWaterIds,
      deletedWorkoutIds,
      deletedDiaryIds,
      deletedFoodMasterIds,
      deletedExerciseMasterIds,
      deletedBloodPressureIds,
      deletedBodyMeasurementIds,
      deletedHabitMasterIds,
      deletedHabitRecordIds,
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
    // 血圧・周囲径・習慣も同様に、未対応の旧Workerのレスポンスでは欠けるため空とみなす(Issue #117・#118・#113)
    const syncedBloodPressureDates = result.syncedBloodPressureDates ?? [];
    const syncedBodyMeasurementDates = result.syncedBodyMeasurementDates ?? [];
    const syncedHabitMasterIds = result.syncedHabitMasterIds ?? [];
    const syncedHabitRecordIds = result.syncedHabitRecordIds ?? [];
    // AIコメントも同様(Issue #164)
    const syncedAdviceWeekStarts = result.syncedAdviceWeekStarts ?? [];
    const syncedMonthlyAdviceMonths = result.syncedMonthlyAdviceMonths ?? [];
    const syncedSettingsKeys = result.syncedSettingsKeys ?? [];
    const confirmedBloodPressureDeletions = result.deletedBloodPressureIds ?? [];
    const confirmedBodyMeasurementDeletions = result.deletedBodyMeasurementIds ?? [];
    const confirmedHabitMasterDeletions = result.deletedHabitMasterIds ?? [];
    const confirmedHabitRecordDeletions = result.deletedHabitRecordIds ?? [];

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
      syncedBloodPressureDates.length > 0
        ? markBloodPressureRecordsSynced(syncedBloodPressureDates)
        : Promise.resolve(),
      syncedBodyMeasurementDates.length > 0
        ? markBodyMeasurementRecordsSynced(syncedBodyMeasurementDates)
        : Promise.resolve(),
      syncedHabitMasterIds.length > 0 ? markHabitMasterItemsSynced(syncedHabitMasterIds) : Promise.resolve(),
      syncedHabitRecordIds.length > 0 ? markHabitRecordsSynced(syncedHabitRecordIds) : Promise.resolve(),
      syncedAdviceWeekStarts.length > 0
        ? markAdviceRecordsSynced(syncedAdviceWeekStarts)
        : Promise.resolve(),
      syncedMonthlyAdviceMonths.length > 0
        ? markMonthlyAdviceRecordsSynced(syncedMonthlyAdviceMonths)
        : Promise.resolve(),
      // 送信中に入った設定変更を取りこぼさないよう、送信時のスナップショットを渡して比較させる
      syncedSettingsKeys.length > 0 && unsyncedSettings !== null
        ? markSettingsSynced(unsyncedSettings)
        : Promise.resolve(),
      clearDeletions("weight", confirmedWeightDeletions),
      clearDeletions("meal", confirmedMealDeletions),
      clearDeletions("water", confirmedWaterDeletions),
      clearDeletions("workout", confirmedWorkoutDeletions),
      clearDeletions("diary", confirmedDiaryDeletions),
      clearDeletions("foodMaster", confirmedFoodMasterDeletions),
      clearDeletions("exerciseMaster", confirmedExerciseMasterDeletions),
      clearDeletions("bloodPressure", confirmedBloodPressureDeletions),
      clearDeletions("bodyMeasurement", confirmedBodyMeasurementDeletions),
      clearDeletions("habitMaster", confirmedHabitMasterDeletions),
      clearDeletions("habitRecord", confirmedHabitRecordDeletions),
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
        syncedBloodPressureDates.length +
        syncedBodyMeasurementDates.length +
        syncedHabitMasterIds.length +
        syncedHabitRecordIds.length +
        syncedAdviceWeekStarts.length +
        syncedMonthlyAdviceMonths.length +
        syncedSettingsKeys.length +
        confirmedWeightDeletions.length +
        confirmedMealDeletions.length +
        confirmedWaterDeletions.length +
        confirmedWorkoutDeletions.length +
        confirmedDiaryDeletions.length +
        confirmedFoodMasterDeletions.length +
        confirmedExerciseMasterDeletions.length +
        confirmedBloodPressureDeletions.length +
        confirmedBodyMeasurementDeletions.length +
        confirmedHabitMasterDeletions.length +
        confirmedHabitRecordDeletions.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "同期に失敗しました";
    return { status: "error", message };
  }
}
