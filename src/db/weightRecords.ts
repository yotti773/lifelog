import { db } from "./db";
import type { WeightRecord } from "../types";

export interface SaveWeightRecordInput {
  date: string; // YYYY-MM-DD
  weightKg: number;
  bodyFatPercent?: number;
  note?: string;
  timestamp?: string; // 省略時は現在時刻
}

/** 同じdateで保存した場合は上書きされる(後勝ち)。内容が変わるため同期状態は未同期に戻す */
export async function saveWeightRecord(input: SaveWeightRecordInput): Promise<WeightRecord> {
  const record: WeightRecord = {
    id: input.date,
    date: input.date,
    timestamp: input.timestamp ?? new Date().toISOString(),
    weightKg: input.weightKg,
    bodyFatPercent: input.bodyFatPercent,
    note: input.note,
    synced: false,
  };
  await db.weightRecords.put(record);
  return record;
}

export async function getWeightRecord(date: string): Promise<WeightRecord | undefined> {
  return db.weightRecords.get(date);
}

export async function getAllWeightRecords(): Promise<WeightRecord[]> {
  return db.weightRecords.orderBy("date").toArray();
}

export async function getWeightRecordsByDateRange(
  startDate: string,
  endDate: string,
): Promise<WeightRecord[]> {
  return db.weightRecords.where("date").between(startDate, endDate, true, true).sortBy("date");
}

export async function updateWeightRecord(
  date: string,
  patch: Partial<Pick<WeightRecord, "weightKg" | "bodyFatPercent" | "note">>,
): Promise<WeightRecord> {
  const existing = await db.weightRecords.get(date);
  if (!existing) {
    throw new Error(`WeightRecord not found for date: ${date}`);
  }
  const updated: WeightRecord = {
    ...existing,
    ...patch,
    timestamp: new Date().toISOString(),
    synced: false,
  };
  await db.weightRecords.put(updated);
  return updated;
}

export async function deleteWeightRecord(date: string): Promise<void> {
  await db.weightRecords.delete(date);
}

export async function getUnsyncedWeightRecords(): Promise<WeightRecord[]> {
  return db.weightRecords.filter((record) => !record.synced).toArray();
}

export async function markWeightRecordsSynced(dates: string[]): Promise<void> {
  await db.weightRecords
    .where("date")
    .anyOf(dates)
    .modify({ synced: true });
}
