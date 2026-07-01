import { db } from "./db";
import type { Settings } from "../types";

const SETTINGS_ID = "default" as const;

// 要件定義書の初期値(64kg / 2026-10-31)
export const DEFAULT_SETTINGS: Settings = {
  goalWeightKg: 64,
  goalDate: "2026-10-31",
  dailyCalorieTarget: 1900,
};

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get(SETTINGS_ID);
  if (!row) return DEFAULT_SETTINGS;
  const { id: _id, ...settings } = row;
  return settings;
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const updated: Settings = { ...current, ...patch };
  await db.settings.put({ id: SETTINGS_ID, ...updated });
  return updated;
}
