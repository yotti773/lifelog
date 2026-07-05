import { db } from "./db";
import { DEFAULT_SETTINGS } from "./settings";
import type { MealRecord, Settings, WeightRecord } from "@/types";

export interface BackupData {
  exportedAt: string;
  weightRecords: WeightRecord[];
  mealRecords: MealRecord[];
  settings: Settings;
}

export async function exportBackupData(): Promise<BackupData> {
  const [weightRecords, mealRecords, settingsRow] = await Promise.all([
    db.weightRecords.toArray(),
    db.mealRecords.toArray(),
    db.settings.get("default"),
  ]);
  const { id: _id, ...settings } = settingsRow ?? { id: "default" as const, ...DEFAULT_SETTINGS };
  return {
    exportedAt: new Date().toISOString(),
    weightRecords,
    mealRecords,
    settings,
  };
}

/** 既存データを全て置き換える(機種変更・復元用) */
export async function importBackupData(data: BackupData): Promise<void> {
  await db.transaction("rw", db.weightRecords, db.mealRecords, db.settings, async () => {
    await db.weightRecords.clear();
    await db.mealRecords.clear();
    await db.settings.clear();
    await db.weightRecords.bulkPut(data.weightRecords);
    await db.mealRecords.bulkPut(data.mealRecords);
    await db.settings.put({ id: "default", ...data.settings });
  });
}
