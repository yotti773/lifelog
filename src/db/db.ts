import Dexie, { type EntityTable } from "dexie";
import type {
  AdviceRecord,
  DiaryRecord,
  ExerciseMasterItem,
  FoodMasterItem,
  MealRecord,
  Settings,
  SyncDeletion,
  WaterRecord,
  WeightRecord,
  WorkoutRecord,
} from "@/types";

export type SettingsRow = Settings & { id: "default" };

export const db = new Dexie("lifelog") as Dexie & {
  weightRecords: EntityTable<WeightRecord, "date">;
  mealRecords: EntityTable<MealRecord, "id">;
  settings: EntityTable<SettingsRow, "id">;
  foodMasterItems: EntityTable<FoodMasterItem, "id">;
  syncDeletions: EntityTable<SyncDeletion, "id">;
  waterRecords: EntityTable<WaterRecord, "id">;
  diaryRecords: EntityTable<DiaryRecord, "date">;
  workoutRecords: EntityTable<WorkoutRecord, "id">;
  exerciseMasterItems: EntityTable<ExerciseMasterItem, "id">;
  adviceRecords: EntityTable<AdviceRecord, "weekStart">;
};

// weightRecords: dateを主キーにすることで、同じ日付のput()が自動的に上書き(後勝ち)になる
db.version(1).stores({
  weightRecords: "date, timestamp",
  mealRecords: "id, mealType, timestamp",
  settings: "id",
});

db.version(2).stores({
  foodMasterItems: "id, name",
});

// syncDeletions: 削除された同期対象記録のトゥームストーン置き場(Issue #30)。sheetでの絞り込み用にインデックスを張る
db.version(3).stores({
  syncDeletions: "id, sheet",
});

// フェーズ2(Issue #8〜#10): 水分・日記・筋トレ・種目マスタ。
// diaryRecordsはweightRecordsと同じく日付を主キーにして「1日1件、後勝ち」を成立させる
db.version(4).stores({
  waterRecords: "id, timestamp",
  diaryRecords: "date, timestamp",
  workoutRecords: "id, date",
  exerciseMasterItems: "id, name",
});

// フェーズ3(Issue #12): AIコーチコメントのキャッシュ。
// 週の開始日(月曜)を主キーにして「1週1件、再生成で上書き(後勝ち)」を成立させる
db.version(5).stores({
  adviceRecords: "weekStart",
});
