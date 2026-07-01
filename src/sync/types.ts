import type { MealRecord, WeightRecord } from "../types";

export interface SyncPushPayload {
  weightRecords: WeightRecord[];
  mealRecords: MealRecord[];
}

export interface SyncPushResult {
  /** 送信に成功したWeightRecordのdate一覧 */
  syncedWeightDates: string[];
  /** 送信に成功したMealRecordのid一覧 */
  syncedMealIds: string[];
}

/**
 * 同期先(スプレッドシート)への実際の送信を担う差し替え可能なインターフェース。
 * Cloudflare Workers経由でGoogle Sheets APIを呼ぶ実装は別途追加する(画面設計書7章参照)。
 */
export interface SyncTransport {
  push(payload: SyncPushPayload): Promise<SyncPushResult>;
}
