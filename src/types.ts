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

/**
 * 水分記録。1回のクイック追加=1レコード(画面設計書5章)。
 * 量の編集UIは持たず、訂正は削除→再記録で行う。
 */
export interface WaterRecord {
  id: string;
  timestamp: string; // ISO8601, 記録した瞬間の時刻
  amountMl: number;
  synced: boolean; // 同期対象化自体は未決定(画面設計書10章)。対象化に備えて保持する
}

/** 日記の気分タグ(絶好調/良い/普通/眠い/不調の5段階。画面設計書6章) */
export type DiaryMood = "great" | "good" | "ok" | "tired" | "bad";

export interface DiaryRecord {
  id: string;
  date: string; // YYYY-MM-DD, 1日1件のキー(体重と同様の後勝ち)
  timestamp: string; // ISO8601, 最後に保存した時刻
  text: string;
  mood?: DiaryMood;
  synced: boolean; // 同期対象化自体は未決定(画面設計書10章)
}

/**
 * 筋トレ記録。1セット=1レコードで、種目単位の合計値は持たない(画面設計書7章)。
 * 保存は「その日の全レコードの置き換え」で行うため、dateが置き換えの単位になる。
 */
export interface WorkoutRecord {
  id: string;
  date: string; // YYYY-MM-DD, 記録日(当日分置き換えの単位)
  timestamp: string; // ISO8601, 同じ保存操作で確定した全セットが共通で持つ
  exerciseName: string; // 自由入力(種目マスタのサジェストから選んだ場合も名前のコピー)
  exerciseOrder: number; // 画面上で何番目の種目カードか(1始まり)
  setNumber: number; // 何セット目か(1始まり)
  weightKg: number;
  reps: number;
  synced: boolean; // 同期対象化自体は未決定(画面設計書10章)
}

export interface ExerciseMasterItem {
  id: string;
  name: string; // 食事マスタと異なり数値項目は持たない(重量・回数は毎回変わるため。画面設計書7.1章)
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
  dailyWaterTargetMl?: number; // 1日の目標水分摂取量(ml)。未設定時はホーム・水分記録画面で合計mlのみ表示する(画面設計書5章)
  lastSyncedAt?: string; // ISO8601, 最終同期日時
  baselineDate?: string; // YYYY-MM-DD, 進捗バーの起点日。未設定時は一番古い体重記録を起点とする
}
