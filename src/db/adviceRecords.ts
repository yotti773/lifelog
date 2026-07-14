import { db } from "./db";
import type { AdviceRecord, MonthlyAdviceRecord, MonthlyDigest, WeeklyAdvice, WeeklyDigest } from "@/types";

/**
 * AIコーチコメントのキャッシュ(週次: Issue #12・画面設計書11章、月次: Issue #114)。
 * スプレッドシート同期の対象外(ローカルのみ)のためsyncedフラグは持たない。
 */

/** 同じ週で保存した場合は上書きされる(再生成=後勝ち)。生成時のdigestも再現・デバッグ用に保存する */
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
  };
  await db.adviceRecords.put(record);
  return record;
}

export async function getAdviceRecord(weekStart: string): Promise<AdviceRecord | undefined> {
  return db.adviceRecords.get(weekStart);
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
  };
  await db.monthlyAdviceRecords.put(record);
  return record;
}

export async function getMonthlyAdviceRecord(month: string): Promise<MonthlyAdviceRecord | undefined> {
  return db.monthlyAdviceRecords.get(month);
}
