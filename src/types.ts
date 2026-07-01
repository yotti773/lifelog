export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export interface WeightRecord {
  id: string;
  date: string; // YYYY-MM-DD, 1日1件のキー
  timestamp: string; // ISO8601, 最後に保存した時刻
  weightKg: number;
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

export interface Settings {
  goalWeightKg: number;
  goalDate: string; // ISO8601 date
  dailyCalorieTarget: number;
  lastSyncedAt?: string; // ISO8601, 最終同期日時
}
