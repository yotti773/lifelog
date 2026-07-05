import { db } from "./db";
import { formatDate, localDateRangeToUtcIso } from "../lib/date";
import type { MealRecord, MealType } from "../types";

export interface DailyCalorieTotal {
  date: string; // YYYY-MM-DD
  kcal: number;
}

export interface AddMealRecordInput {
  mealType: MealType;
  confirmedName: string;
  confirmedKcal: number;
  confirmedProteinG: number;
  confirmedFatG: number;
  confirmedCarbsG: number;
  timestamp?: string; // 省略時は現在時刻
  photoLocalRef?: string;
  aiEstimatedName?: string;
  aiEstimatedKcal?: number;
  aiEstimatedProteinG?: number;
  aiEstimatedFatG?: number;
  aiEstimatedCarbsG?: number;
}

/** 同じmealTypeでも複数件保存できる(区分ごとの合計はホーム画面側で集計する) */
export async function addMealRecord(input: AddMealRecordInput): Promise<MealRecord> {
  const record: MealRecord = {
    id: crypto.randomUUID(),
    timestamp: input.timestamp ?? new Date().toISOString(),
    mealType: input.mealType,
    photoLocalRef: input.photoLocalRef,
    aiEstimatedName: input.aiEstimatedName,
    aiEstimatedKcal: input.aiEstimatedKcal,
    aiEstimatedProteinG: input.aiEstimatedProteinG,
    aiEstimatedFatG: input.aiEstimatedFatG,
    aiEstimatedCarbsG: input.aiEstimatedCarbsG,
    confirmedName: input.confirmedName,
    confirmedKcal: input.confirmedKcal,
    confirmedProteinG: input.confirmedProteinG,
    confirmedFatG: input.confirmedFatG,
    confirmedCarbsG: input.confirmedCarbsG,
    synced: false,
  };
  await db.mealRecords.add(record);
  return record;
}

export async function getMealRecord(id: string): Promise<MealRecord | undefined> {
  return db.mealRecords.get(id);
}

export async function getAllMealRecords(): Promise<MealRecord[]> {
  return db.mealRecords.orderBy("timestamp").toArray();
}

export async function getMealRecordsByDateRange(
  startDate: string,
  endDate: string,
): Promise<MealRecord[]> {
  const [startIso] = localDateRangeToUtcIso(startDate);
  const [, endIso] = localDateRangeToUtcIso(endDate);
  return db.mealRecords.where("timestamp").between(startIso, endIso, true, true).sortBy("timestamp");
}

export async function updateMealRecord(
  id: string,
  patch: Partial<Omit<MealRecord, "id">>,
): Promise<MealRecord> {
  const existing = await db.mealRecords.get(id);
  if (!existing) {
    throw new Error(`MealRecord not found for id: ${id}`);
  }
  const updated: MealRecord = { ...existing, ...patch, synced: patch.synced ?? false };
  await db.mealRecords.put(updated);
  return updated;
}

export async function deleteMealRecord(id: string): Promise<void> {
  await db.mealRecords.delete(id);
}

export async function getUnsyncedMealRecords(): Promise<MealRecord[]> {
  return db.mealRecords.filter((record) => !record.synced).toArray();
}

export async function markMealRecordsSynced(ids: string[]): Promise<void> {
  await db.mealRecords.where("id").anyOf(ids).modify({ synced: true });
}

/** 指定期間の日別摂取カロリー合計を返す(記録のない日も0kcalとして含める) */
export async function getDailyCalorieTotals(
  startDate: string,
  endDate: string,
): Promise<DailyCalorieTotal[]> {
  const records = await getMealRecordsByDateRange(startDate, endDate);

  const totalsByDate = new Map<string, number>();
  for (const record of records) {
    const date = formatDate(new Date(record.timestamp));
    totalsByDate.set(date, (totalsByDate.get(date) ?? 0) + record.confirmedKcal);
  }

  const totals: DailyCalorieTotal[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    const date = formatDate(cursor);
    totals.push({ date, kcal: totalsByDate.get(date) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return totals;
}
