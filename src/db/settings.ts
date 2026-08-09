import { db } from "./db";
import type { Settings } from "@/types";

const SETTINGS_ID = "default" as const;

// デフォルト値は持たず、ユーザーの明示的な設定を待つ(Issue #217)。
// 初回セットアップで目標を入力させることで、他人に配るときに開発者本人の目標値が表示されるのを防ぐ
export const DEFAULT_SETTINGS: Settings = {};

/**
 * **既定値は読み取り時にだけ被せ、保存はしない**(Issue #164)。
 *
 * 以前は `updateSettings` が `getSettings()` のマージ結果(既定値込み)をそのまま保存していた。
 * その作りだと、新規端末で最初にAPIトークンを入れた瞬間に既定値が「ユーザーが設定した値」として
 * 実体化し、(1) 次の自動同期で既定値がシートの実値を上書きし、(2) 「シートから取り込み」も
 * 既定値を設定済みとみなして実値を復元しない、という二重の事故になる。
 * 保存行には明示的に設定された項目だけを持たせることで、「未設定」と「既定値のまま」を区別する。
 */
export async function getSettings(): Promise<Settings> {
  const stored = await getStoredSettings();
  return { ...DEFAULT_SETTINGS, ...stored };
}

/** 保存行そのもの(明示的に設定された項目だけ)。取り込み・同期の判定はこちらを使う */
export async function getStoredSettings(): Promise<Partial<Settings>> {
  const row = await db.settings.get(SETTINGS_ID);
  if (!row) return {};
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
  const stored = await getStoredSettings();
  const updated: Partial<Settings> = { ...stored, ...patch };
  const synced = isOnlySyncStatePatch(patch) ? (row?.synced ?? false) : false;
  await db.settings.put({ id: SETTINGS_ID, ...updated, synced });
  return { ...DEFAULT_SETTINGS, ...updated };
}

/**
 * 未同期なら送信用の設定(明示的に設定された項目だけ)を返す。同期済み・未保存ならnull。
 * **既定値は含めない** — 含めると、APIトークン入力しかしていない新規端末の初回同期が
 * 既定値をシートへ書き、旧端末が積み上げた実値を上書きしてしまう
 */
export async function getUnsyncedSettings(): Promise<Partial<Settings> | null> {
  const row = await db.settings.get(SETTINGS_ID);
  if (!row || row.synced) return null;
  return getStoredSettings();
}

/**
 * 送信が完了した設定を同期済みにする。**送信中に別の変更が入っていたら同期済みにしない**(Issue #164)。
 * 送信時のスナップショットと現在の保存行を比べ、変わっていれば未同期のまま残して次回に再送させる。
 * 記録類と違い設定は数ヶ月触らないことがあり、ここで取りこぼすとシートが古いまま放置されるため。
 */
export async function markSettingsSynced(pushedSnapshot: Partial<Settings>): Promise<void> {
  const row = await db.settings.get(SETTINGS_ID);
  if (!row) return;
  const current = await getStoredSettings();
  const { lastSyncedAt: _a, apiToken: _b, ...pushedRest } = pushedSnapshot;
  const { lastSyncedAt: _c, apiToken: _d, ...currentRest } = current;
  if (JSON.stringify(pushedRest) !== JSON.stringify(currentRest)) return;
  await db.settings.put({ ...row, synced: true });
}
