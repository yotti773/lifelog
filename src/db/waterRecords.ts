import { db } from "./db";
import { formatDate, localDateRangeToUtcIso } from "@/lib/date";
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

export async function getWaterRecordsForDate(date: string): Promise<WaterRecord[]> {
  const [startIso, endIso] = localDateRangeToUtcIso(date);
  return db.waterRecords.where("timestamp").between(startIso, endIso, true, true).sortBy("timestamp");
}

/**
 * 誤記録の訂正用(削除→再記録。量の編集UIは持たない。画面設計書5章)。
 * 水分はスプレッドシート同期の対象外のため、体重・食事と違い削除トゥームストーンは残さない(画面設計書10章)
 */
export async function deleteWaterRecord(id: string): Promise<void> {
  await db.waterRecords.delete(id);
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

  const totalsByDate = new Map<string, number>();
  for (const record of records) {
    const date = formatDate(new Date(record.timestamp));
    totalsByDate.set(date, (totalsByDate.get(date) ?? 0) + record.amountMl);
  }

  const totals: DailyWaterTotal[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    const date = formatDate(cursor);
    totals.push({ date, amountMl: totalsByDate.get(date) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return totals;
}
