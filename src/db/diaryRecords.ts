import { db } from "./db";
import { cancelDeletion, enqueueDeletion } from "./syncDeletions";
import type { DiaryMood, DiaryRecord } from "@/types";

export interface SaveDiaryRecordInput {
  date: string; // YYYY-MM-DD
  text: string;
  mood?: DiaryMood;
  timestamp?: string; // 省略時は現在時刻
}

/** 同じdateで保存した場合は上書きされる(後勝ち。体重記録と同じ考え方)。内容が変わるため同期状態は未同期に戻す */
export async function saveDiaryRecord(input: SaveDiaryRecordInput): Promise<DiaryRecord> {
  const record: DiaryRecord = {
    id: input.date,
    date: input.date,
    timestamp: input.timestamp ?? new Date().toISOString(),
    text: input.text,
    mood: input.mood,
    synced: false,
  };
  await db.diaryRecords.put(record);
  // 同じ日付を削除→再登録した場合、スプレッドシート側は削除ではなく更新すべきなので保留中の削除要求を取り消す(Issue #72)
  await cancelDeletion("diary", record.id);
  return record;
}

export async function getDiaryRecord(date: string): Promise<DiaryRecord | undefined> {
  return db.diaryRecords.get(date);
}

/** 履歴確認画面用に全日記を日付降順で返す(Issue #73) */
export async function getAllDiaryRecordsDesc(): Promise<DiaryRecord[]> {
  return db.diaryRecords.orderBy("date").reverse().toArray();
}

/** 指定期間(両端含む)の日記を日付昇順で返す。週次レビューの気分タグ集計に使う(Issue #45) */
export async function getDiaryRecordsByDateRange(startDate: string, endDate: string): Promise<DiaryRecord[]> {
  return db.diaryRecords.where("date").between(startDate, endDate, true, true).sortBy("date");
}

/**
 * 本文・気分タグの両方が空の状態で保存された場合に「未記録に戻す」ために使う(画面設計書6章)。
 * スプレッドシート側の該当行も次回同期で削除するためトゥームストーンを残す(Issue #72)
 */
export async function deleteDiaryRecord(date: string): Promise<void> {
  await db.diaryRecords.delete(date);
  await enqueueDeletion("diary", date);
}

export async function getUnsyncedDiaryRecords(): Promise<DiaryRecord[]> {
  return db.diaryRecords.filter((record) => !record.synced).toArray();
}

export async function markDiaryRecordsSynced(dates: string[]): Promise<void> {
  await db.diaryRecords.where("date").anyOf(dates).modify({ synced: true });
}
