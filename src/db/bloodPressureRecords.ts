import { db } from "./db";
import { cancelDeletion, enqueueDeletion } from "./syncDeletions";
import type { BloodPressureRecord } from "@/types";

export interface SaveBloodPressureRecordInput {
  date: string; // YYYY-MM-DD
  systolic: number;
  diastolic: number;
  pulse?: number;
  note?: string;
  timestamp?: string; // 省略時は現在時刻
}

/** 同じdateで保存した場合は上書きされる(後勝ち。体重記録と同じ考え方)。内容が変わるため同期状態は未同期に戻す */
export async function saveBloodPressureRecord(
  input: SaveBloodPressureRecordInput,
): Promise<BloodPressureRecord> {
  const record: BloodPressureRecord = {
    id: input.date,
    date: input.date,
    timestamp: input.timestamp ?? new Date().toISOString(),
    systolic: input.systolic,
    diastolic: input.diastolic,
    pulse: input.pulse,
    note: input.note,
    synced: false,
  };
  await db.bloodPressureRecords.put(record);
  // 同じ日付を削除→再登録した場合、スプレッドシート側は削除ではなく更新すべきなので保留中の削除要求を取り消す(Issue #117)
  await cancelDeletion("bloodPressure", record.id);
  return record;
}

export async function getBloodPressureRecord(date: string): Promise<BloodPressureRecord | undefined> {
  return db.bloodPressureRecords.get(date);
}

export async function getAllBloodPressureRecords(): Promise<BloodPressureRecord[]> {
  return db.bloodPressureRecords.orderBy("date").toArray();
}

/** 履歴確認画面用: 日付降順(新しい記録が先頭)で全件取得する */
export async function getAllBloodPressureRecordsDesc(): Promise<BloodPressureRecord[]> {
  return db.bloodPressureRecords.orderBy("date").reverse().toArray();
}

export async function getBloodPressureRecordsByDateRange(
  startDate: string,
  endDate: string,
): Promise<BloodPressureRecord[]> {
  return db.bloodPressureRecords.where("date").between(startDate, endDate, true, true).sortBy("date");
}

export async function deleteBloodPressureRecord(date: string): Promise<void> {
  await db.bloodPressureRecords.delete(date);
  // スプレッドシート側の該当行も次回同期で削除するためトゥームストーンを残す(Issue #117)
  await enqueueDeletion("bloodPressure", date);
}

export async function getUnsyncedBloodPressureRecords(): Promise<BloodPressureRecord[]> {
  return db.bloodPressureRecords.filter((record) => !record.synced).toArray();
}

export async function markBloodPressureRecordsSynced(dates: string[]): Promise<void> {
  await db.bloodPressureRecords.where("date").anyOf(dates).modify({ synced: true });
}
