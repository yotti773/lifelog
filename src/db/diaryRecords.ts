import { db } from "./db";
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
  return record;
}

export async function getDiaryRecord(date: string): Promise<DiaryRecord | undefined> {
  return db.diaryRecords.get(date);
}

/**
 * 本文・気分タグの両方が空の状態で保存された場合に「未記録に戻す」ために使う(画面設計書6章)。
 * 日記はスプレッドシート同期の対象外のため削除トゥームストーンは残さない(画面設計書10章)
 */
export async function deleteDiaryRecord(date: string): Promise<void> {
  await db.diaryRecords.delete(date);
}
