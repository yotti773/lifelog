import type { DiaryRecord, MealRecord, WaterRecord, WeightRecord, WorkoutRecord } from "@/types";

export interface SyncPushPayload {
  weightRecords: WeightRecord[];
  mealRecords: MealRecord[];
  waterRecords: WaterRecord[];
  workoutRecords: WorkoutRecord[];
  diaryRecords: DiaryRecord[];
  /** スプレッドシートから削除すべき体重記録のID(=日付)一覧。トゥームストーン由来(Issue #30) */
  deletedWeightIds: string[];
  /** スプレッドシートから削除すべき食事記録のID一覧。トゥームストーン由来(Issue #30) */
  deletedMealIds: string[];
  /** スプレッドシートから削除すべき水分記録のID一覧。トゥームストーン由来(Issue #72) */
  deletedWaterIds: string[];
  /** スプレッドシートから削除すべき筋トレ記録(セット)のID一覧。トゥームストーン由来(Issue #72) */
  deletedWorkoutIds: string[];
  /** スプレッドシートから削除すべき日記記録のID(=日付)一覧。トゥームストーン由来(Issue #72) */
  deletedDiaryIds: string[];
}

export interface SyncPushResult {
  /** 送信(追記/更新)に成功したWeightRecordのdate一覧 */
  syncedWeightDates: string[];
  /** 送信(追記/更新)に成功したMealRecordのid一覧 */
  syncedMealIds: string[];
  /** 送信(追記/更新)に成功したWaterRecordのid一覧 */
  syncedWaterIds: string[];
  /** 送信(追記/更新)に成功したWorkoutRecordのid一覧 */
  syncedWorkoutIds: string[];
  /** 送信(追記/更新)に成功したDiaryRecordのdate一覧 */
  syncedDiaryDates: string[];
  /** 削除を確定できた体重記録のID一覧。省略時は空とみなす(Issue #30) */
  deletedWeightIds?: string[];
  /** 削除を確定できた食事記録のID一覧。省略時は空とみなす(Issue #30) */
  deletedMealIds?: string[];
  /** 削除を確定できた水分記録のID一覧。省略時は空とみなす(Issue #72) */
  deletedWaterIds?: string[];
  /** 削除を確定できた筋トレ記録(セット)のID一覧。省略時は空とみなす(Issue #72) */
  deletedWorkoutIds?: string[];
  /** 削除を確定できた日記記録のID一覧。省略時は空とみなす(Issue #72) */
  deletedDiaryIds?: string[];
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

/** スプレッドシートから取り込んだ水分記録。シートに無い`synced`を除きWaterRecordと同形 */
export type PulledWaterRecord = Omit<WaterRecord, "synced">;

/** スプレッドシートから取り込んだ筋トレ記録(セット)。シートに無い`synced`を除きWorkoutRecordと同形 */
export type PulledWorkoutRecord = Omit<WorkoutRecord, "synced">;

/** スプレッドシートから取り込んだ日記記録。シートに無い`synced`を除きDiaryRecordと同形 */
export type PulledDiaryRecord = Omit<DiaryRecord, "synced">;

export interface SyncPullResult {
  weightRecords: PulledWeightRecord[];
  mealRecords: PulledMealRecord[];
  waterRecords: PulledWaterRecord[];
  workoutRecords: PulledWorkoutRecord[];
  diaryRecords: PulledDiaryRecord[];
  /** 解釈できずスキップされた体重タブの行数(見出し行とみなす1行目を除く) */
  skippedWeightRows: number;
  /** 解釈できずスキップされた食事タブの行数(見出し行とみなす1行目を除く) */
  skippedMealRows: number;
  /** 解釈できずスキップされた水分タブの行数(見出し行とみなす1行目を除く) */
  skippedWaterRows: number;
  /** 解釈できずスキップされた筋トレタブの行数(見出し行とみなす1行目を除く) */
  skippedWorkoutRows: number;
  /** 解釈できずスキップされた日記タブの行数(見出し行とみなす1行目を除く) */
  skippedDiaryRows: number;
}

/** スプレッドシートからの取り込み(復元・過去データ移行)を担うインターフェース(Issue #54) */
export interface SyncPullTransport {
  pull(): Promise<SyncPullResult>;
}
