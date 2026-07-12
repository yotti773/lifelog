import { db } from "@/db/db";
import { getPendingDeletionIds } from "@/db/syncDeletions";
import { notConfiguredTransport } from "./notConfiguredTransport";
import type { SyncPullTransport } from "./types";

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
        ] = await Promise.all([
          getPendingDeletionIds("weight"),
          getPendingDeletionIds("meal"),
          getPendingDeletionIds("water"),
          getPendingDeletionIds("workout"),
          getPendingDeletionIds("diary"),
          getPendingDeletionIds("foodMaster"),
          getPendingDeletionIds("exerciseMaster"),
        ]);
        const pendingWeightSet = new Set(pendingWeightIds);
        const pendingMealSet = new Set(pendingMealIds);
        const pendingWaterSet = new Set(pendingWaterIds);
        const pendingWorkoutSet = new Set(pendingWorkoutIds);
        const pendingDiarySet = new Set(pendingDiaryIds);
        const pendingFoodMasterSet = new Set(pendingFoodMasterIds);
        const pendingExerciseMasterSet = new Set(pendingExerciseMasterIds);

        let importedWeightCount = 0;
        let importedMealCount = 0;
        let importedWaterCount = 0;
        let importedWorkoutCount = 0;
        let importedDiaryCount = 0;
        let importedFoodMasterCount = 0;
        let importedExerciseMasterCount = 0;
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

        return {
          importedWeightCount,
          importedMealCount,
          importedWaterCount,
          importedWorkoutCount,
          importedDiaryCount,
          importedActivityCount,
          importedFoodMasterCount,
          importedExerciseMasterCount,
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
        (pulled.skippedExerciseMasterRows ?? 0),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "取り込みに失敗しました";
    return { status: "error", message };
  }
}
