import { db } from "@/db/db";
import { getPendingDeletionIds } from "@/db/syncDeletions";
import { notConfiguredTransport } from "./notConfiguredTransport";
import type { SyncPullTransport } from "./types";

export type ImportOutcome =
  | {
      status: "success";
      importedWeightCount: number;
      importedMealCount: number;
      /** ローカルに既にある・削除保留中のためスキップした件数 */
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
 * スプレッドシートの全記録を取り込む(復元・過去データ移行用。Issue #54)。
 * マージは「追加のみ」: ローカルに同じキーの記録があればローカル優先でスキップし、
 * 削除トゥームストーンが保留中のキーもスキップする(未送信の削除が取り込みで復活するのを防ぐ)。
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

    const counts = await db.transaction("rw", db.weightRecords, db.mealRecords, db.syncDeletions, async () => {
      const [pendingWeightIds, pendingMealIds] = await Promise.all([
        getPendingDeletionIds("weight"),
        getPendingDeletionIds("meal"),
      ]);
      const pendingWeightSet = new Set(pendingWeightIds);
      const pendingMealSet = new Set(pendingMealIds);

      let importedWeightCount = 0;
      let importedMealCount = 0;
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

      return { importedWeightCount, importedMealCount, skippedExistingCount };
    });

    return {
      status: "success",
      ...counts,
      skippedRowCount: pulled.skippedWeightRows + pulled.skippedMealRows,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "取り込みに失敗しました";
    return { status: "error", message };
  }
}
