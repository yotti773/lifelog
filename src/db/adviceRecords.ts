import { db } from "./db";
import type { AdviceRecord, MonthlyAdviceRecord, MonthlyDigest, WeeklyAdvice, WeeklyDigest } from "@/types";

/**
 * AIコーチコメントのキャッシュ(週次: Issue #12・画面設計書11章、月次: Issue #114)。
 *
 * **スプレッドシート同期の対象(Issue #164)。** 生成が非決定的で、再生成しても同じものは二度と出ない。
 * 数値部分はレコードから再計算できる(`getWeeklyDigest()`)のに対し、AIの出力だけは失うと復旧手段が無いため、
 * 記録と同じくシートへ書き出して保全する。シートに載せるのは`advice`だけで`digest`は載せない。
 *
 * 削除UIは無い(再生成は同じキーへの上書き)ため、削除トゥームストーンの仕組みには乗せていない。
 */

/** 同じ週で保存した場合は上書きされる(再生成=後勝ち)。内容が変わるため同期状態は未同期に戻す */
export async function saveAdviceRecord(
  weekStart: string,
  digest: WeeklyDigest,
  advice: WeeklyAdvice,
): Promise<AdviceRecord> {
  const record: AdviceRecord = {
    weekStart,
    createdAt: new Date().toISOString(),
    digest,
    advice,
    synced: false,
  };
  await db.adviceRecords.put(record);
  return record;
}

export async function getAdviceRecord(weekStart: string): Promise<AdviceRecord | undefined> {
  return db.adviceRecords.get(weekStart);
}

/** 未同期の週次AIコメント。booleanはIndexedDBのインデックスに使えないためJS側で絞り込む(他の記録と同じ) */
export async function getUnsyncedAdviceRecords(): Promise<AdviceRecord[]> {
  return db.adviceRecords.filter((record) => !record.synced).toArray();
}

export async function markAdviceRecordsSynced(weekStarts: string[]): Promise<void> {
  if (weekStarts.length === 0) return;
  await db.adviceRecords.where("weekStart").anyOf(weekStarts).modify({ synced: true });
}

/** 月次版(Issue #114)。同じ月で保存した場合は上書きされる(再生成=後勝ち) */
export async function saveMonthlyAdviceRecord(
  month: string,
  digest: MonthlyDigest,
  advice: WeeklyAdvice,
): Promise<MonthlyAdviceRecord> {
  const record: MonthlyAdviceRecord = {
    month,
    createdAt: new Date().toISOString(),
    digest,
    advice,
    synced: false,
  };
  await db.monthlyAdviceRecords.put(record);
  return record;
}

export async function getMonthlyAdviceRecord(month: string): Promise<MonthlyAdviceRecord | undefined> {
  return db.monthlyAdviceRecords.get(month);
}

export async function getUnsyncedMonthlyAdviceRecords(): Promise<MonthlyAdviceRecord[]> {
  return db.monthlyAdviceRecords.filter((record) => !record.synced).toArray();
}

export async function markMonthlyAdviceRecordsSynced(months: string[]): Promise<void> {
  if (months.length === 0) return;
  await db.monthlyAdviceRecords.where("month").anyOf(months).modify({ synced: true });
}
