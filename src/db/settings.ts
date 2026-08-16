import { db } from "./db";
import type { Settings } from "@/types";

const SETTINGS_ID = "default" as const;

// デフォルト値は持たず、ユーザーの明示的な設定を待つ(Issue #217)。
// 初回セットアップで目標を入力させることで、他人に配るときに開発者本人の目標値が表示されるのを防ぐ
export const DEFAULT_SETTINGS: Settings = {};

/**
 * 初回セットアップ(Issue #217)を終えたとみなす条件。**目標の3項目だけを必須とする。**
 * 身体プロフィール・PFC・水分目標は自動計算や補助表示にしか使わず、無くても記録も進捗表示も成立するため
 * 任意に留める(必須にすると、入れる気の無い項目のせいで記録が始められなくなる)。
 *
 * **ホーム(リダイレクト判定)と初回セットアップ画面(「はじめる」の活性)で必ず同じ関数を使うこと。**
 * 条件が食い違うと、片方だけを満たしたユーザーがどちらの画面からも解放されない状態が生まれる。
 */
export function isInitialSetupComplete(settings: Settings): boolean {
  return (
    settings.goalWeightKg !== undefined &&
    settings.goalDate !== undefined &&
    settings.dailyCalorieTarget !== undefined
  );
}

/** 初回セットアップ画面へ誘導すべきか。スキップ済みなら未設定でも誘導しない(移行ユーザー向け) */
export function shouldShowInitialSetup(settings: Settings): boolean {
  return !settings.initialSetupSkipped && !isInitialSetupComplete(settings);
}

/**
 * AI機能(Gemini APIへの送信)に同意済みか(Issue #219)。**未設定=未同意**。
 * 記録・同期は同意の有無に関わらず使えるため、この判定はAI機能の入口だけで使う。
 */
export function hasAiConsent(settings: Settings): boolean {
  return settings.aiConsentAgreedAt !== undefined;
}

/** AI機能への同意を記録する。同意日時は記録として残すため上書きしない(再同意は初回の日時を保つ) */
export async function agreeToAiConsent(): Promise<Settings> {
  const stored = await getStoredSettings();
  if (stored.aiConsentAgreedAt !== undefined) return getSettings();
  return updateSettings({ aiConsentAgreedAt: new Date().toISOString() });
}

/**
 * AI機能への同意を撤回する。**項目自体を保存行から取り除く**(未設定=未同意に戻す)。
 * `updateSettings` に undefined を渡してもキーは残るため、ここで明示的に除いた行を書き戻す。
 */
export async function withdrawAiConsent(): Promise<Settings> {
  const stored = await getStoredSettings();
  const { aiConsentAgreedAt: _removed, ...rest } = stored;
  await db.settings.put({ id: SETTINGS_ID, ...rest, synced: false });
  return { ...DEFAULT_SETTINGS, ...rest };
}

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
