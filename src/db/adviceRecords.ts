import { db } from "./db";
import type { AdviceRecord, WeeklyAdvice, WeeklyDigest } from "@/types";

/**
 * AIコーチコメントのキャッシュ(Issue #12。画面設計書11章)。
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
