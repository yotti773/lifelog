import { db } from "./db";
import { cancelDeletion, enqueueDeletion } from "./syncDeletions";
import type { BodyMeasurementRecord } from "@/types";

export interface SaveBodyMeasurementRecordInput {
  date: string; // YYYY-MM-DD
  waistCm: number;
  chestCm?: number;
  thighCm?: number;
  note?: string;
  timestamp?: string; // 省略時は現在時刻
}

/** 同じdateで保存した場合は上書きされる(後勝ち。体重記録と同じ考え方)。内容が変わるため同期状態は未同期に戻す */
export async function saveBodyMeasurementRecord(
  input: SaveBodyMeasurementRecordInput,
): Promise<BodyMeasurementRecord> {
  const record: BodyMeasurementRecord = {
    id: input.date,
    date: input.date,
    timestamp: input.timestamp ?? new Date().toISOString(),
    waistCm: input.waistCm,
    chestCm: input.chestCm,
    thighCm: input.thighCm,
    note: input.note,
    synced: false,
  };
  await db.bodyMeasurementRecords.put(record);
  // 同じ日付を削除→再登録した場合、スプレッドシート側は削除ではなく更新すべきなので保留中の削除要求を取り消す(Issue #118)
  await cancelDeletion("bodyMeasurement", record.id);
  return record;
}

export async function getBodyMeasurementRecord(
  date: string,
): Promise<BodyMeasurementRecord | undefined> {
  return db.bodyMeasurementRecords.get(date);
}

export async function getAllBodyMeasurementRecords(): Promise<BodyMeasurementRecord[]> {
  return db.bodyMeasurementRecords.orderBy("date").toArray();
}

/** 履歴確認画面用: 日付降順(新しい記録が先頭)で全件取得する */
export async function getAllBodyMeasurementRecordsDesc(): Promise<BodyMeasurementRecord[]> {
  return db.bodyMeasurementRecords.orderBy("date").reverse().toArray();
}

export async function getBodyMeasurementRecordsByDateRange(
  startDate: string,
  endDate: string,
): Promise<BodyMeasurementRecord[]> {
  return db.bodyMeasurementRecords.where("date").between(startDate, endDate, true, true).sortBy("date");
}

export async function deleteBodyMeasurementRecord(date: string): Promise<void> {
  await db.bodyMeasurementRecords.delete(date);
  // スプレッドシート側の該当行も次回同期で削除するためトゥームストーンを残す(Issue #118)
  await enqueueDeletion("bodyMeasurement", date);
}

export async function getUnsyncedBodyMeasurementRecords(): Promise<BodyMeasurementRecord[]> {
  return db.bodyMeasurementRecords.filter((record) => !record.synced).toArray();
}

export async function markBodyMeasurementRecordsSynced(dates: string[]): Promise<void> {
  await db.bodyMeasurementRecords.where("date").anyOf(dates).modify({ synced: true });
}
