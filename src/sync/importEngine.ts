import { db } from "@/db/db";
import { getStoredSettings, updateSettings } from "@/db/settings";
import { getPendingDeletionIds } from "@/db/syncDeletions";
import { notConfiguredTransport } from "./notConfiguredTransport";
import { fromSettingsEntries } from "./settingsSync";
import type { SyncPullActivityTransport, SyncPullTransport } from "./types";

export type ImportOutcome =
  | {
      status: "success";
      importedWeightCount: number;
      importedMealCount: number;
      importedWaterCount: number;
      importedWorkoutCount: number;
      importedDiaryCount: number;
      /** 取り込んだ(新規+上書き)活動記録の件数。他と違い既存日付も常に上書きされる(Issue #81) */
      importedActivityCount: number;
      importedFoodMasterCount: number;
      importedExerciseMasterCount: number;
      importedBloodPressureCount: number;
      importedBodyMeasurementCount: number;
      importedHabitMasterCount: number;
      importedHabitRecordCount: number;
      /** 取り込んだ設定項目の件数(Issue #164)。ローカル未設定の項目だけ入れる */
      importedSettingsCount: number;
      /** 取り込んだ週次AIコメントの件数(Issue #164) */
      importedAdviceCount: number;
      /** 取り込んだ月次AIコメントの件数(Issue #164) */
      importedMonthlyAdviceCount: number;
      /** ローカルに既にある・削除保留中のためスキップした件数(マスタは同名の既存品目・種目もスキップ対象) */
      skippedExistingCount: number;
      /** シート側で解釈できずスキップされた行数(見出し行を除く) */
      skippedRowCount: number;
    }
  | { status: "skipped-offline" }
  | { status: "error"; message: string };

export interface RunImportOptions {
  transport?: SyncPullTransport;
  isOnline?: () => boolean;
}

/**
 * スプレッドシートの全記録と食事マスタ・種目マスタを取り込む(復元・過去データ移行用。Issue #54・#72・#96)。
 * マージは「追加のみ」: ローカルに同じキーの記録があればローカル優先でスキップし、
 * 削除トゥームストーンが保留中のキーもスキップする(未送信の削除が取り込みで復活するのを防ぐ)。
 * マスタはさらに同名(前後空白無視)の既存品目・種目もスキップする。
 * 取り込んだ記録はシート由来のため`synced: true`で保存し、再送信の対象にしない。
 */
export async function runImport({
  transport = notConfiguredTransport,
  isOnline = () => navigator.onLine,
}: RunImportOptions = {}): Promise<ImportOutcome> {
  if (!isOnline()) {
    return { status: "skipped-offline" };
  }

  try {
    const pulled = await transport.pull();

    const counts = await db.transaction(
      "rw",
      [
        db.weightRecords,
        db.mealRecords,
        db.waterRecords,
        db.workoutRecords,
        db.diaryRecords,
        db.activityRecords,
        db.foodMasterItems,
        db.exerciseMasterItems,
        db.adviceRecords,
        db.monthlyAdviceRecords,
        db.bloodPressureRecords,
        db.bodyMeasurementRecords,
        db.habitMasterItems,
        db.habitRecords,
        db.settings,
        db.syncDeletions,
      ],
      async () => {
        const [
          pendingWeightIds,
          pendingMealIds,
          pendingWaterIds,
          pendingWorkoutIds,
          pendingDiaryIds,
          pendingFoodMasterIds,
          pendingExerciseMasterIds,
          pendingBloodPressureIds,
          pendingBodyMeasurementIds,
          pendingHabitMasterIds,
          pendingHabitRecordIds,
        ] = await Promise.all([
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
        const pendingWeightSet = new Set(pendingWeightIds);
        const pendingMealSet = new Set(pendingMealIds);
        const pendingWaterSet = new Set(pendingWaterIds);
        const pendingWorkoutSet = new Set(pendingWorkoutIds);
        const pendingDiarySet = new Set(pendingDiaryIds);
        const pendingFoodMasterSet = new Set(pendingFoodMasterIds);
        const pendingExerciseMasterSet = new Set(pendingExerciseMasterIds);
        const pendingBloodPressureSet = new Set(pendingBloodPressureIds);
        const pendingBodyMeasurementSet = new Set(pendingBodyMeasurementIds);
        const pendingHabitMasterSet = new Set(pendingHabitMasterIds);
        const pendingHabitRecordSet = new Set(pendingHabitRecordIds);

        let importedWeightCount = 0;
        let importedMealCount = 0;
        let importedWaterCount = 0;
        let importedWorkoutCount = 0;
        let importedDiaryCount = 0;
        let importedFoodMasterCount = 0;
        let importedExerciseMasterCount = 0;
        let importedBloodPressureCount = 0;
        let importedBodyMeasurementCount = 0;
        let importedHabitMasterCount = 0;
        let importedHabitRecordCount = 0;
        let importedSettingsCount = 0;
        let importedAdviceCount = 0;
        let importedMonthlyAdviceCount = 0;
        let skippedExistingCount = 0;

        for (const record of pulled.weightRecords) {
          // 体重のトゥームストーンはdate(=ID列の値)をキーにしている(deleteWeightRecord参照)
          if (pendingWeightSet.has(record.date) || (await db.weightRecords.get(record.date)) !== undefined) {
            skippedExistingCount++;
            continue;
          }
          await db.weightRecords.put({ ...record, synced: true });
          importedWeightCount++;
        }

        for (const record of pulled.mealRecords) {
          if (pendingMealSet.has(record.id) || (await db.mealRecords.get(record.id)) !== undefined) {
            skippedExistingCount++;
            continue;
          }
          await db.mealRecords.put({ ...record, synced: true });
          importedMealCount++;
        }

        for (const record of pulled.waterRecords) {
          if (pendingWaterSet.has(record.id) || (await db.waterRecords.get(record.id)) !== undefined) {
            skippedExistingCount++;
            continue;
          }
          await db.waterRecords.put({ ...record, synced: true });
          importedWaterCount++;
        }

        for (const record of pulled.workoutRecords) {
          if (pendingWorkoutSet.has(record.id) || (await db.workoutRecords.get(record.id)) !== undefined) {
            skippedExistingCount++;
            continue;
          }
          await db.workoutRecords.put({ ...record, synced: true });
          importedWorkoutCount++;
        }

        for (const record of pulled.diaryRecords) {
          // 日記のトゥームストーンはdate(=ID列の値)をキーにしている(deleteDiaryRecord参照)
          if (pendingDiarySet.has(record.date) || (await db.diaryRecords.get(record.date)) !== undefined) {
            skippedExistingCount++;
            continue;
          }
          await db.diaryRecords.put({ ...record, synced: true });
          importedDiaryCount++;
        }

        // 活動記録(Garmin由来)は他と違い「追加のみ・ローカル優先」にしない —
        // アプリ内に編集・削除が無く競合しないうえ、Garminのバックフィルによる
        // 過去日の訂正を反映するため、常にシート側で上書きする(Issue #81)
        for (const record of pulled.activityRecords) {
          await db.activityRecords.put({ ...record, synced: true });
        }
        const importedActivityCount = pulled.activityRecords.length;

        // マスタはIDに加えて名前でも重複を弾く(Issue #96)。手入力行はID採番前にローカルと
        // 同名になりうるうえ、種目マスタは同名を許さない(サジェストのキーが名前のため)
        const existingFoodNames = new Set(
          (await db.foodMasterItems.toArray()).map((item) => item.name.trim()),
        );
        for (const item of pulled.foodMasterItems ?? []) {
          if (
            pendingFoodMasterSet.has(item.id) ||
            existingFoodNames.has(item.name.trim()) ||
            (await db.foodMasterItems.get(item.id)) !== undefined
          ) {
            skippedExistingCount++;
            continue;
          }
          await db.foodMasterItems.put({ ...item, synced: true });
          existingFoodNames.add(item.name.trim());
          importedFoodMasterCount++;
        }

        const existingExerciseNames = new Set(
          (await db.exerciseMasterItems.toArray()).map((item) => item.name.trim()),
        );
        for (const item of pulled.exerciseMasterItems ?? []) {
          if (
            pendingExerciseMasterSet.has(item.id) ||
            existingExerciseNames.has(item.name.trim()) ||
            (await db.exerciseMasterItems.get(item.id)) !== undefined
          ) {
            skippedExistingCount++;
            continue;
          }
          await db.exerciseMasterItems.put({ ...item, synced: true });
          existingExerciseNames.add(item.name.trim());
          importedExerciseMasterCount++;
        }

        // 設定も追加のみ・ローカル優先(Issue #164)。ローカルで未設定の項目だけ埋める —
        // 上書きすると、機種変更後に手で入れ直した値をシートの古い値が潰しうる
        const pulledSettings = fromSettingsEntries(pulled.settingsEntries ?? []);
        if (Object.keys(pulledSettings).length > 0) {
          // **既定値とのマージ結果ではなく、明示的に保存された項目だけを見る。**
          // getSettings()は既定値を被せて返すため、それで判定すると新規端末で
          // goalWeightKg・goalDate・dailyCalorieTarget が「設定済み」に見えて復元されない。
          // 保存行が既定値を実体化しないことは updateSettings 側が保証している(settings.ts参照)
          const stored = await getStoredSettings();
          const patch: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(pulledSettings)) {
            if (stored[key as keyof typeof stored] === undefined) {
              patch[key] = value;
              importedSettingsCount++;
            } else {
              skippedExistingCount++;
            }
          }
          // 取り込んだ設定は未同期のまま残す(次回同期で押し戻る)。ここで同期済みにすると、
          // 手元に残っている未送信の設定変更まで送信対象から外れてしまう
          if (importedSettingsCount > 0) await updateSettings(patch);
        }

        // AIコメントも追加のみ・ローカル優先(Issue #164)。手元にあるものはdigest付きなので上書きしない
        // (シート側にはdigestが無く、上書きすると生成時の証跡を失うため)
        for (const record of pulled.adviceRecords ?? []) {
          if ((await db.adviceRecords.get(record.weekStart)) !== undefined) {
            skippedExistingCount++;
            continue;
          }
          await db.adviceRecords.put({ ...record, synced: true });
          importedAdviceCount++;
        }

        for (const record of pulled.monthlyAdviceRecords ?? []) {
          if ((await db.monthlyAdviceRecords.get(record.month)) !== undefined) {
            skippedExistingCount++;
            continue;
          }
          await db.monthlyAdviceRecords.put({ ...record, synced: true });
          importedMonthlyAdviceCount++;
        }

        // 血圧・周囲径は体重と同じく日付キー・追加のみ・ローカル優先(Issue #117・#118)
        for (const record of pulled.bloodPressureRecords ?? []) {
          if (
            pendingBloodPressureSet.has(record.date) ||
            (await db.bloodPressureRecords.get(record.date)) !== undefined
          ) {
            skippedExistingCount++;
            continue;
          }
          await db.bloodPressureRecords.put({ ...record, synced: true });
          importedBloodPressureCount++;
        }

        for (const record of pulled.bodyMeasurementRecords ?? []) {
          if (
            pendingBodyMeasurementSet.has(record.date) ||
            (await db.bodyMeasurementRecords.get(record.date)) !== undefined
          ) {
            skippedExistingCount++;
            continue;
          }
          await db.bodyMeasurementRecords.put({ ...record, synced: true });
          importedBodyMeasurementCount++;
        }

        // 習慣マスタはマスタ系と同じくIDに加えて名前でも重複を弾く(Issue #113)。
        // orderが欠けている取り込み行は末尾に採番していく
        const existingHabits = await db.habitMasterItems.toArray();
        const existingHabitNames = new Set(existingHabits.map((item) => item.name.trim()));
        let maxHabitOrder = existingHabits.reduce((max, item) => Math.max(max, item.order), 0);
        for (const item of pulled.habitMasterItems ?? []) {
          if (
            pendingHabitMasterSet.has(item.id) ||
            existingHabitNames.has(item.name.trim()) ||
            (await db.habitMasterItems.get(item.id)) !== undefined
          ) {
            skippedExistingCount++;
            continue;
          }
          maxHabitOrder += 1;
          await db.habitMasterItems.put({ ...item, order: item.order || maxHabitOrder, synced: true });
          existingHabitNames.add(item.name.trim());
          importedHabitMasterCount++;
        }

        // 習慣記録は合成キー(id=`${date}_${habitId}`)で追加のみ・ローカル優先(Issue #113)
        for (const record of pulled.habitRecords ?? []) {
          if (
            pendingHabitRecordSet.has(record.id) ||
            (await db.habitRecords.get(record.id)) !== undefined
          ) {
            skippedExistingCount++;
            continue;
          }
          await db.habitRecords.put({ ...record, synced: true });
          importedHabitRecordCount++;
        }

        return {
          importedWeightCount,
          importedMealCount,
          importedWaterCount,
          importedWorkoutCount,
          importedDiaryCount,
          importedActivityCount,
          importedFoodMasterCount,
          importedExerciseMasterCount,
          importedBloodPressureCount,
          importedBodyMeasurementCount,
          importedHabitMasterCount,
          importedHabitRecordCount,
          importedSettingsCount,
          importedAdviceCount,
          importedMonthlyAdviceCount,
          skippedExistingCount,
        };
      },
    );

    return {
      status: "success",
      ...counts,
      skippedRowCount:
        pulled.skippedWeightRows +
        pulled.skippedMealRows +
        pulled.skippedWaterRows +
        pulled.skippedWorkoutRows +
        pulled.skippedDiaryRows +
        pulled.skippedActivityRows +
        (pulled.skippedFoodMasterRows ?? 0) +
        (pulled.skippedExerciseMasterRows ?? 0) +
        (pulled.skippedBloodPressureRows ?? 0) +
        (pulled.skippedBodyMeasurementRows ?? 0) +
        (pulled.skippedHabitMasterRows ?? 0) +
        (pulled.skippedHabitRecordRows ?? 0) +
        (pulled.skippedSettingsRows ?? 0) +
        (pulled.skippedAdviceRows ?? 0) +
        (pulled.skippedMonthlyAdviceRows ?? 0),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "取り込みに失敗しました";
    return { status: "error", message };
  }
}

export type ActivityImportOutcome =
  | { status: "success"; importedActivityCount: number; skippedRowCount: number }
  | { status: "skipped-offline" }
  | { status: "error"; message: string };

export interface RunActivityImportOptions {
  transport?: SyncPullActivityTransport;
  isOnline?: () => boolean;
}

/**
 * 活動記録タブ(Garmin由来)だけを取り込む(Issue #133)。自動同期のたびに呼ばれる軽量版で、
 * 全記録を取り込むrunImportと違い活動記録タブしか読まない。
 * 活動記録はアプリ内に編集・削除が無くGarminが真実の情報源のため、runImportと同じく
 * 「追加のみ・ローカル優先」にはせず既存日付も常にシート側で上書きする(Issue #81)。
 * 取り込んだレコードはシート由来のため`synced: true`で保存し、再送信の対象にしない。
 */
export async function runActivityImport({
  transport = notConfiguredTransport,
  isOnline = () => navigator.onLine,
}: RunActivityImportOptions = {}): Promise<ActivityImportOutcome> {
  if (!isOnline()) {
    return { status: "skipped-offline" };
  }

  try {
    const pulled = await transport.pullActivity();

    await db.transaction("rw", db.activityRecords, async () => {
      for (const record of pulled.activityRecords) {
        await db.activityRecords.put({ ...record, synced: true });
      }
    });

    return {
      status: "success",
      importedActivityCount: pulled.activityRecords.length,
      skippedRowCount: pulled.skippedActivityRows,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "活動記録の取り込みに失敗しました";
    return { status: "error", message };
  }
}
