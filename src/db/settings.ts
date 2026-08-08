import { db } from "./db";
import type { Settings } from "@/types";

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
  const { id: _id, synced: _synced, ...settings } = row;
  return settings;
}

/**
 * `lastSyncedAt` だけの更新では未同期に戻さない(Issue #164)。
 * 同期の完了時に毎回この値を書くため、ここで未同期にすると設定が永久に同期待ちのままになる。
 */
function isOnlySyncStatePatch(patch: Partial<Settings>): boolean {
  const keys = Object.keys(patch);
  return keys.length > 0 && keys.every((key) => key === "lastSyncedAt");
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const row = await db.settings.get(SETTINGS_ID);
  const current = await getSettings();
  const updated: Settings = { ...current, ...patch };
  const synced = isOnlySyncStatePatch(patch) ? (row?.synced ?? false) : false;
  await db.settings.put({ id: SETTINGS_ID, ...updated, synced });
  return updated;
}

/**
 * 未同期なら送信用の設定を返す。同期済みならnull(差分同期のため)。
 * **設定を一度も保存していない場合もnull** — 既定値のままなら書き出すものが無く、
 * 新規ユーザーの初回起動で「同期するものがある」状態になってしまうため
 */
export async function getUnsyncedSettings(): Promise<Settings | null> {
  const row = await db.settings.get(SETTINGS_ID);
  if (!row || row.synced) return null;
  return getSettings();
}

export async function markSettingsSynced(): Promise<void> {
  const row = await db.settings.get(SETTINGS_ID);
  if (!row) return;
  await db.settings.put({ ...row, synced: true });
}
