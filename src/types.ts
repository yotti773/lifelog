export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface WeightRecord {
  id: string;
  date: string; // YYYY-MM-DD, 1日1件のキー
  timestamp: string; // ISO8601, 最後に保存した時刻
  weightKg: number;
  bodyFatPercent?: number; // 体脂肪率(%)。任意入力
  note?: string;
  synced: boolean; // スプレッドシートへの同期済みフラグ
}

export interface MealRecord {
  id: string;
  timestamp: string; // ISO8601
  mealType: MealType;
  photoLocalRef?: string;
  aiEstimatedName?: string;
  aiEstimatedKcal?: number;
  aiEstimatedProteinG?: number;
  aiEstimatedFatG?: number;
  aiEstimatedCarbsG?: number;
  confirmedName: string;
  confirmedKcal: number;
  confirmedProteinG: number;
  confirmedFatG: number;
  confirmedCarbsG: number;
  synced: boolean; // スプレッドシートへの同期済みフラグ
}

export interface FoodMasterItem {
  id: string;
  name: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  source?: string; // 出典(公式栄養成分表のURL等)。事前登録の数値検証用、任意
  createdAt: string; // ISO8601
}

/** どちらのスプレッドシートタブの行を指すかの識別子 */
export type SyncSheet = "weight" | "meal";

/**
 * 同期済み(スプレッドシートに書き出し済み)の可能性がある記録を削除したときのトゥームストーン。
 * ローカルの記録は即座に消えるが、スプレッドシート側の行は次回同期でこの情報を使って削除する(Issue #30)。
 */
export interface SyncDeletion {
  /** `${sheet}:${recordId}` の合成キー(同じ行への削除要求を冪等にまとめる) */
  id: string;
  sheet: SyncSheet;
  /** スプレッドシートのID列に書かれている値(WeightRecord.id=日付 / MealRecord.id=UUID) */
  recordId: string;
  deletedAt: string; // ISO8601
}

export interface Settings {
  goalWeightKg: number;
  goalDate: string; // ISO8601 date
  dailyCalorieTarget: number;
  lastSyncedAt?: string; // ISO8601, 最終同期日時
  baselineDate?: string; // YYYY-MM-DD, 進捗バーの起点日。未設定時は一番古い体重記録を起点とする
}
