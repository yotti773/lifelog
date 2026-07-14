import type {
  ActivityRecord,
  BloodPressureRecord,
  BodyMeasurementRecord,
  DiaryRecord,
  ExerciseMasterItem,
  FoodMasterItem,
  HabitMasterItem,
  HabitRecord,
  MealRecord,
  WaterRecord,
  WeightRecord,
  WorkoutRecord,
} from "@/types";

export interface SyncPushPayload {
  weightRecords: WeightRecord[];
  mealRecords: MealRecord[];
  waterRecords: WaterRecord[];
  workoutRecords: WorkoutRecord[];
  diaryRecords: DiaryRecord[];
  foodMasterItems: FoodMasterItem[];
  exerciseMasterItems: ExerciseMasterItem[];
  bloodPressureRecords: BloodPressureRecord[];
  bodyMeasurementRecords: BodyMeasurementRecord[];
  habitMasterItems: HabitMasterItem[];
  habitRecords: HabitRecord[];
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
  /** スプレッドシートから削除すべき食事マスタ品目のID一覧。トゥームストーン由来(Issue #96) */
  deletedFoodMasterIds: string[];
  /** スプレッドシートから削除すべき種目マスタのID一覧。トゥームストーン由来(Issue #96) */
  deletedExerciseMasterIds: string[];
  /** スプレッドシートから削除すべき血圧記録のID(=日付)一覧。トゥームストーン由来(Issue #117) */
  deletedBloodPressureIds: string[];
  /** スプレッドシートから削除すべき周囲径記録のID(=日付)一覧。トゥームストーン由来(Issue #118) */
  deletedBodyMeasurementIds: string[];
  /** スプレッドシートから削除すべき習慣マスタのID一覧。トゥームストーン由来(Issue #113) */
  deletedHabitMasterIds: string[];
  /** スプレッドシートから削除すべき習慣記録のID一覧。トゥームストーン由来(Issue #113) */
  deletedHabitRecordIds: string[];
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
  /** 送信(追記/更新)に成功したFoodMasterItemのid一覧。マスタ未対応の旧Workerは返さないため省略可(Issue #96) */
  syncedFoodMasterIds?: string[];
  /** 送信(追記/更新)に成功したExerciseMasterItemのid一覧。マスタ未対応の旧Workerは返さないため省略可(Issue #96) */
  syncedExerciseMasterIds?: string[];
  /** 送信に成功したBloodPressureRecordのdate一覧。未対応の旧Workerは返さないため省略可(Issue #117) */
  syncedBloodPressureDates?: string[];
  /** 送信に成功したBodyMeasurementRecordのdate一覧。未対応の旧Workerは返さないため省略可(Issue #118) */
  syncedBodyMeasurementDates?: string[];
  /** 送信に成功したHabitMasterItemのid一覧。未対応の旧Workerは返さないため省略可(Issue #113) */
  syncedHabitMasterIds?: string[];
  /** 送信に成功したHabitRecordのid一覧。未対応の旧Workerは返さないため省略可(Issue #113) */
  syncedHabitRecordIds?: string[];
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
  /** 削除を確定できた食事マスタ品目のID一覧。省略時は空とみなす(Issue #96) */
  deletedFoodMasterIds?: string[];
  /** 削除を確定できた種目マスタのID一覧。省略時は空とみなす(Issue #96) */
  deletedExerciseMasterIds?: string[];
  /** 削除を確定できた血圧記録のID一覧。省略時は空とみなす(Issue #117) */
  deletedBloodPressureIds?: string[];
  /** 削除を確定できた周囲径記録のID一覧。省略時は空とみなす(Issue #118) */
  deletedBodyMeasurementIds?: string[];
  /** 削除を確定できた習慣マスタのID一覧。省略時は空とみなす(Issue #113) */
  deletedHabitMasterIds?: string[];
  /** 削除を確定できた習慣記録のID一覧。省略時は空とみなす(Issue #113) */
  deletedHabitRecordIds?: string[];
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

/** スプレッドシートから取り込んだ活動記録(Garmin由来。Issue #81)。シートに無い`synced`を除きActivityRecordと同形 */
export type PulledActivityRecord = Omit<ActivityRecord, "synced">;

/** スプレッドシートから取り込んだ食事マスタ品目(Issue #96)。シートに無い`synced`を除きFoodMasterItemと同形 */
export type PulledFoodMasterItem = Omit<FoodMasterItem, "synced">;

/** スプレッドシートから取り込んだ種目マスタ(Issue #96)。シートに無い`synced`を除きExerciseMasterItemと同形 */
export type PulledExerciseMasterItem = Omit<ExerciseMasterItem, "synced">;

/** スプレッドシートから取り込んだ血圧記録(Issue #117)。シートに無い`synced`を除きBloodPressureRecordと同形 */
export type PulledBloodPressureRecord = Omit<BloodPressureRecord, "synced">;

/** スプレッドシートから取り込んだ周囲径記録(Issue #118)。シートに無い`synced`を除きBodyMeasurementRecordと同形 */
export type PulledBodyMeasurementRecord = Omit<BodyMeasurementRecord, "synced">;

/** スプレッドシートから取り込んだ習慣マスタ(Issue #113)。シートに無い`synced`を除きHabitMasterItemと同形 */
export type PulledHabitMasterItem = Omit<HabitMasterItem, "synced">;

/** スプレッドシートから取り込んだ習慣記録(Issue #113)。シートに無い`synced`を除きHabitRecordと同形 */
export type PulledHabitRecord = Omit<HabitRecord, "synced">;

export interface SyncPullResult {
  weightRecords: PulledWeightRecord[];
  mealRecords: PulledMealRecord[];
  waterRecords: PulledWaterRecord[];
  workoutRecords: PulledWorkoutRecord[];
  diaryRecords: PulledDiaryRecord[];
  activityRecords: PulledActivityRecord[];
  /** マスタ未対応の旧Workerは返さないため省略可(Issue #96) */
  foodMasterItems?: PulledFoodMasterItem[];
  /** マスタ未対応の旧Workerは返さないため省略可(Issue #96) */
  exerciseMasterItems?: PulledExerciseMasterItem[];
  /** 未対応の旧Workerは返さないため省略可(Issue #117) */
  bloodPressureRecords?: PulledBloodPressureRecord[];
  /** 未対応の旧Workerは返さないため省略可(Issue #118) */
  bodyMeasurementRecords?: PulledBodyMeasurementRecord[];
  /** 未対応の旧Workerは返さないため省略可(Issue #113) */
  habitMasterItems?: PulledHabitMasterItem[];
  /** 未対応の旧Workerは返さないため省略可(Issue #113) */
  habitRecords?: PulledHabitRecord[];
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
  /** 解釈できずスキップされた活動記録タブの行数(見出し行とみなす1行目を除く。タブ自体が無い場合は0) */
  skippedActivityRows: number;
  /** 解釈できずスキップされた食事マスタタブの行数(見出し行とみなす1行目を除く。タブ自体が無い・旧Workerの場合は0扱い) */
  skippedFoodMasterRows?: number;
  /** 解釈できずスキップされた種目マスタタブの行数(見出し行とみなす1行目を除く。タブ自体が無い・旧Workerの場合は0扱い) */
  skippedExerciseMasterRows?: number;
  /** 解釈できずスキップされた血圧記録タブの行数(見出し行を除く。タブ自体が無い・旧Workerの場合は0扱い) */
  skippedBloodPressureRows?: number;
  /** 解釈できずスキップされた周囲径記録タブの行数(見出し行を除く。タブ自体が無い・旧Workerの場合は0扱い) */
  skippedBodyMeasurementRows?: number;
  /** 解釈できずスキップされた習慣マスタタブの行数(見出し行を除く。タブ自体が無い・旧Workerの場合は0扱い) */
  skippedHabitMasterRows?: number;
  /** 解釈できずスキップされた習慣記録タブの行数(見出し行を除く。タブ自体が無い・旧Workerの場合は0扱い) */
  skippedHabitRecordRows?: number;
}

/** スプレッドシートからの取り込み(復元・過去データ移行)を担うインターフェース(Issue #54) */
export interface SyncPullTransport {
  pull(): Promise<SyncPullResult>;
}
