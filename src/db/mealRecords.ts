import { db } from "./db";
import { enqueueDeletion } from "./syncDeletions";
import { sumDailyTotals } from "@/lib/dailyTotals";
import { localDateRangeToUtcIso } from "@/lib/date";
import type { MealRecord, MealType } from "@/types";

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

/** 指定したローカル日付・区分の食事記録を時刻昇順で返す(区分単位の記録画面の下書き読み込み用) */
export async function getMealRecordsForDateAndType(date: string, mealType: MealType): Promise<MealRecord[]> {
  const [startIso, endIso] = localDateRangeToUtcIso(date);
  const records = await db.mealRecords.where("timestamp").between(startIso, endIso, true, true).sortBy("timestamp");
  return records.filter((record) => record.mealType === mealType);
}

/** 区分単位の記録画面で1品分を保存するときの入力(1品=1レコード) */
export interface MealItemInput {
  confirmedName: string;
  confirmedKcal: number;
  confirmedProteinG: number;
  confirmedFatG: number;
  confirmedCarbsG: number;
  aiEstimatedName?: string;
  aiEstimatedKcal?: number;
  aiEstimatedProteinG?: number;
  aiEstimatedFatG?: number;
  aiEstimatedCarbsG?: number;
  /** この区分を「食べなかった」として保存する場合にtrue(Issue #143)。MealRecord.skippedへそのまま渡す */
  skipped?: boolean;
}

/**
 * 指定日・区分の食事記録を丸ごと置き換える(筋トレの replaceWorkoutRecordsForDate と同じ考え方)。
 * 区分ごとの記録画面は「その日のその区分の全品目」を1画面で編集するため、保存=「既存の当日・当区分分を消して登録し直す」。
 * itemsを空にして保存すればその区分の当日分の削除になる。「食べなかった」の記録(Issue #143)は
 * skipped:trueの1件だけを含むitemsを渡すことで表現する(未記録=0件、と区別するため)。
 * 置き換えのたびに各品目へ新しいIDを振り直すため、置き換え前の全レコードIDを削除トゥームストーンとして残し、
 * スプレッドシート側の古い行を次回同期で消す(Issue #30の削除反映の仕組みを流用)。
 * timestampは区分内の全品目で共有する(筋トレが当日の全セットで保存時刻を共有するのと同じ)が、
 * 品目の並び順を読み戻し時(timestamp昇順ソート)に保つため、各品目へindex分のミリ秒だけ加算する
 * (同一分内の差なので表示上は同じ時刻、範囲・日別集計にも影響しない)。
 */
export async function replaceMealRecordsForDateAndType(
  date: string,
  mealType: MealType,
  timestamp: string,
  items: MealItemInput[],
): Promise<MealRecord[]> {
  const baseMs = new Date(timestamp).getTime();
  const records: MealRecord[] = items.map((item, index) => ({
    id: crypto.randomUUID(),
    timestamp: new Date(baseMs + index).toISOString(),
    mealType,
    aiEstimatedName: item.aiEstimatedName,
    aiEstimatedKcal: item.aiEstimatedKcal,
    aiEstimatedProteinG: item.aiEstimatedProteinG,
    aiEstimatedFatG: item.aiEstimatedFatG,
    aiEstimatedCarbsG: item.aiEstimatedCarbsG,
    confirmedName: item.confirmedName,
    confirmedKcal: item.confirmedKcal,
    confirmedProteinG: item.confirmedProteinG,
    confirmedFatG: item.confirmedFatG,
    confirmedCarbsG: item.confirmedCarbsG,
    skipped: item.skipped,
    synced: false,
  }));
  await db.transaction("rw", db.mealRecords, db.syncDeletions, async () => {
    const existing = await getMealRecordsForDateAndType(date, mealType);
    if (existing.length > 0) {
      await db.mealRecords.bulkDelete(existing.map((record) => record.id));
    }
    if (records.length > 0) {
      await db.mealRecords.bulkAdd(records);
    }
    await Promise.all(existing.map((record) => enqueueDeletion("meal", record.id)));
  });
  return records;
}

export async function getAllMealRecords(): Promise<MealRecord[]> {
  return db.mealRecords.orderBy("timestamp").toArray();
}

/** 履歴確認画面用: タイムスタンプ降順(新しい記録が先頭)で全件取得する */
export async function getAllMealRecordsDesc(): Promise<MealRecord[]> {
  return db.mealRecords.orderBy("timestamp").reverse().toArray();
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
  // スプレッドシート側の該当行も次回同期で削除するためトゥームストーンを残す(Issue #30)
  await enqueueDeletion("meal", id);
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
  return sumDailyTotals(records, startDate, endDate, (r) => r.timestamp, (r) => r.confirmedKcal).map(
    ({ date, total }) => ({ date, kcal: total }),
  );
}
