import { db } from "./db";
import type { SyncSheet } from "@/types";

function deletionKey(sheet: SyncSheet, recordId: string): string {
  return `${sheet}:${recordId}`;
}

/**
 * 記録の削除をトゥームストーンとして記録する。既に同じ行への削除要求があれば上書き(冪等)。
 * 同期済みだったかどうかに関わらず登録し、スプレッドシート側に該当行が無ければWorker側で無害にスキップされる(Issue #30)。
 */
export async function enqueueDeletion(sheet: SyncSheet, recordId: string): Promise<void> {
  await db.syncDeletions.put({
    id: deletionKey(sheet, recordId),
    sheet,
    recordId,
    deletedAt: new Date().toISOString(),
  });
}

/**
 * 同じ行に対する保留中の削除トゥームストーンを取り消す。
 * 例: 削除済みの体重(=日付キー)を同じ日付で再登録した場合、スプレッドシート側は削除ではなく更新すべきなので削除要求を消す。
 */
export async function cancelDeletion(sheet: SyncSheet, recordId: string): Promise<void> {
  await db.syncDeletions.delete(deletionKey(sheet, recordId));
}

/** 指定タブの保留中削除のrecordId一覧を返す */
export async function getPendingDeletionIds(sheet: SyncSheet): Promise<string[]> {
  const rows = await db.syncDeletions.where("sheet").equals(sheet).toArray();
  return rows.map((row) => row.recordId);
}

/** Workerが削除を確定した行のトゥームストーンを消す(部分成功を許容するためsheet単位で呼ぶ) */
export async function clearDeletions(sheet: SyncSheet, recordIds: string[]): Promise<void> {
  if (recordIds.length === 0) return;
  await db.syncDeletions.bulkDelete(recordIds.map((recordId) => deletionKey(sheet, recordId)));
}
