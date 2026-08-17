import { db } from "./db";

/**
 * ユーザー自身のGoogle認可の保存(Issue #214)。
 *
 * 保存するのは **refresh token だけ**。access token は短命(約1時間)なため永続化せず、
 * `src/api/googleOAuth.ts` がメモリ上で保持して期限切れ時に作り直す。
 *
 * **このテーブルはシート同期にもバックアップにも載らない**(`BACKUP_EXCLUDED_TABLES`)。
 * 認証情報を持ち出せるファイルにしない、という #164 の `apiToken` と同じ線。
 */

const GOOGLE_AUTH_ID = "default" as const;

/** 連携済みならrefresh tokenを返す。未連携ならnull */
export async function getGoogleRefreshToken(): Promise<string | null> {
  const row = await db.googleAuth.get(GOOGLE_AUTH_ID);
  return row?.refreshToken ?? null;
}

/** 連携状態(画面表示用)。「まだ読んでいない」とは区別できないため、呼び出し側でnull正規化して使う */
export async function getGoogleConnection(): Promise<{ connectedAt: string } | null> {
  const row = await db.googleAuth.get(GOOGLE_AUTH_ID);
  return row ? { connectedAt: row.connectedAt } : null;
}

export async function saveGoogleRefreshToken(refreshToken: string): Promise<void> {
  await db.googleAuth.put({
    id: GOOGLE_AUTH_ID,
    refreshToken,
    connectedAt: new Date().toISOString(),
  });
}

/**
 * 連携を解除する。**行ごと消す**(空文字を残さない) — 未連携の判定を「行が無い」の一点に保つ。
 * 失効(6ヶ月未使用・ユーザーによる解除・認可の上限超過)でGoogleが弾いたときもここを呼ぶ:
 * 使えないトークンを持ち続けても再連携の妨げにしかならないため(検討メモ12.8「失効は正常系」)。
 */
export async function clearGoogleRefreshToken(): Promise<void> {
  await db.googleAuth.delete(GOOGLE_AUTH_ID);
}
