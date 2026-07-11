import { db } from "./db";
import { enqueueDeletion } from "./syncDeletions";
import { sumDailyTotals } from "@/lib/dailyTotals";
import { localDateRangeToUtcIso } from "@/lib/date";
import type { WaterRecord } from "@/types";

export interface DailyWaterTotal {
  date: string; // YYYY-MM-DD
  amountMl: number;
}

/** クイック追加(1タップ=1レコード)。timestampを省略すると現在時刻で記録する */
export async function addWaterRecord(amountMl: number, timestamp?: string): Promise<WaterRecord> {
  const record: WaterRecord = {
    id: crypto.randomUUID(),
    timestamp: timestamp ?? new Date().toISOString(),
    amountMl,
    synced: false,
  };
  await db.waterRecords.add(record);
  return record;
}

/** 履歴確認画面用に全記録を新しい順(タイムスタンプ降順)で返す(Issue #73) */
export async function getAllWaterRecordsDesc(): Promise<WaterRecord[]> {
  return db.waterRecords.orderBy("timestamp").reverse().toArray();
}

export async function getWaterRecordsForDate(date: string): Promise<WaterRecord[]> {
  const [startIso, endIso] = localDateRangeToUtcIso(date);
  return db.waterRecords.where("timestamp").between(startIso, endIso, true, true).sortBy("timestamp");
}

/**
 * 誤記録の訂正用(削除→再記録。量の編集UIは持たない。画面設計書5章)。
 * スプレッドシート側の該当行も次回同期で削除するためトゥームストーンを残す(Issue #72)
 */
export async function deleteWaterRecord(id: string): Promise<void> {
  await db.waterRecords.delete(id);
  await enqueueDeletion("water", id);
}

export async function getUnsyncedWaterRecords(): Promise<WaterRecord[]> {
  return db.waterRecords.filter((record) => !record.synced).toArray();
}

export async function markWaterRecordsSynced(ids: string[]): Promise<void> {
  await db.waterRecords.where("id").anyOf(ids).modify({ synced: true });
}

/** 指定期間の日別摂取量合計を返す(記録のない日も0mlとして含める。カロリー推移と同じ考え方) */
export async function getDailyWaterTotals(
  startDate: string,
  endDate: string,
): Promise<DailyWaterTotal[]> {
  const [startIso] = localDateRangeToUtcIso(startDate);
  const [, endIso] = localDateRangeToUtcIso(endDate);
  const records = await db.waterRecords
    .where("timestamp")
    .between(startIso, endIso, true, true)
    .toArray();
  return sumDailyTotals(records, startDate, endDate, (r) => r.timestamp, (r) => r.amountMl).map(
    ({ date, total }) => ({ date, amountMl: total }),
  );
}
