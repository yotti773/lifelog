import type { MealRecord, WeightRecord } from "@/types";

export interface SyncPushPayload {
  weightRecords: WeightRecord[];
  mealRecords: MealRecord[];
  /** スプレッドシートから削除すべき体重記録のID(=日付)一覧。トゥームストーン由来(Issue #30) */
  deletedWeightIds: string[];
  /** スプレッドシートから削除すべき食事記録のID一覧。トゥームストーン由来(Issue #30) */
  deletedMealIds: string[];
}

export interface SyncPushResult {
  /** 送信(追記/更新)に成功したWeightRecordのdate一覧 */
  syncedWeightDates: string[];
  /** 送信(追記/更新)に成功したMealRecordのid一覧 */
  syncedMealIds: string[];
  /** 削除を確定できた体重記録のID一覧。省略時は空とみなす(Issue #30) */
  deletedWeightIds?: string[];
  /** 削除を確定できた食事記録のID一覧。省略時は空とみなす(Issue #30) */
  deletedMealIds?: string[];
}

/**
 * 同期先(スプレッドシート)への実際の送信を担う差し替え可能なインターフェース。
 * Cloudflare Workers経由でGoogle Sheets APIを呼ぶ実装は別途追加する(画面設計書7章参照)。
 */
export interface SyncTransport {
  push(payload: SyncPushPayload): Promise<SyncPushResult>;
}

/** スプレッドシートから取り込んだ体重記録。シートに無い`synced`を除きWeightRecordと同形 */
export type PulledWeightRecord = Omit<WeightRecord, "synced">;

/**
 * スプレッドシートから取り込んだ食事記録。シートに無い`synced`・AI推定値・写真参照を除き
 * MealRecordと同形(シートは確定値のみを持つため、これらは復元できない。Issue #54)
 */
export type PulledMealRecord = Omit<
  MealRecord,
  | "synced"
  | "photoLocalRef"
  | "aiEstimatedName"
  | "aiEstimatedKcal"
  | "aiEstimatedProteinG"
  | "aiEstimatedFatG"
  | "aiEstimatedCarbsG"
>;

export interface SyncPullResult {
  weightRecords: PulledWeightRecord[];
  mealRecords: PulledMealRecord[];
  /** 解釈できずスキップされた体重タブの行数(見出し行とみなす1行目を除く) */
  skippedWeightRows: number;
  /** 解釈できずスキップされた食事タブの行数(見出し行とみなす1行目を除く) */
  skippedMealRows: number;
}

/** スプレッドシートからの取り込み(復元・過去データ移行)を担うインターフェース(Issue #54) */
export interface SyncPullTransport {
  pull(): Promise<SyncPullResult>;
}
