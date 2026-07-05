import Dexie, { type EntityTable } from "dexie";
import type { FoodMasterItem, MealRecord, Settings, WeightRecord } from "@/types";

export type SettingsRow = Settings & { id: "default" };

export const db = new Dexie("lifelog") as Dexie & {
  weightRecords: EntityTable<WeightRecord, "date">;
  mealRecords: EntityTable<MealRecord, "id">;
  settings: EntityTable<SettingsRow, "id">;
  foodMasterItems: EntityTable<FoodMasterItem, "id">;
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
