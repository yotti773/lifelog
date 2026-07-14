import { db } from "./db";
import { cancelDeletion, enqueueDeletion } from "./syncDeletions";
import type { HabitRecord } from "@/types";

/** 習慣記録の合成キー。`${date}_${habitId}`で「1日1習慣1件・後勝ち」を成立させる(Issue #113) */
export function habitRecordId(date: string, habitId: string): string {
  return `${date}_${habitId}`;
}

/**
 * その日にその習慣を「やった」ことを記録する。同じ日・同じ習慣で呼ぶと後勝ちで上書きされる。
 * 削除→再チェックした場合はスプレッドシート側を削除ではなく更新すべきなので保留中の削除要求を取り消す。
 */
export async function markHabitDone(input: {
  date: string;
  habitId: string;
  habitName: string;
  timestamp?: string;
}): Promise<HabitRecord> {
  const id = habitRecordId(input.date, input.habitId);
  const record: HabitRecord = {
    id,
    date: input.date,
    habitId: input.habitId,
    habitName: input.habitName,
    timestamp: input.timestamp ?? new Date().toISOString(),
    synced: false,
  };
  await db.habitRecords.put(record);
  await cancelDeletion("habitRecord", id);
  return record;
}

/**
 * その日のその習慣のチェックを外す(記録の削除で表す)。
 * スプレッドシート側の該当行も次回同期で削除するためトゥームストーンを残す。
 */
export async function unmarkHabitDone(date: string, habitId: string): Promise<void> {
  const id = habitRecordId(date, habitId);
  await db.habitRecords.delete(id);
  await enqueueDeletion("habitRecord", id);
}

export async function getHabitRecordsForDate(date: string): Promise<HabitRecord[]> {
  return db.habitRecords.where("date").equals(date).toArray();
}

export async function getHabitRecordsByDateRange(
  startDate: string,
  endDate: string,
): Promise<HabitRecord[]> {
  return db.habitRecords.where("date").between(startDate, endDate, true, true).sortBy("date");
}

/** ある習慣の全記録を日付昇順で返す(連続日数・達成率の集計用) */
export async function getHabitRecordsByHabit(habitId: string): Promise<HabitRecord[]> {
  return (await db.habitRecords.where("habitId").equals(habitId).toArray()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

export async function getUnsyncedHabitRecords(): Promise<HabitRecord[]> {
  return db.habitRecords.filter((record) => !record.synced).toArray();
}

export async function markHabitRecordsSynced(ids: string[]): Promise<void> {
  await db.habitRecords.where("id").anyOf(ids).modify({ synced: true });
}
