import { ApiStatusError, requestApi, SYNC_REQUEST_TIMEOUT_MS } from "@/api/request";
import { clearGoogleRefreshToken, getGoogleRefreshToken, saveGoogleRefreshToken } from "@/db/googleAuth";
import { createCodeChallenge, generateRandomToken } from "@/lib/pkce";

/**
 * ユーザー自身のGoogle認可(Issue #214。検討メモ12.7・12.8の案A)。
 *
 * 認可コードフロー + PKCE をリダイレクトで行う。ポップアップではなくリダイレクトにしたのは、
 * インストール済みPWA(standalone表示)ではポップアップの挙動が不安定で、ブロックもされやすいため。
 *
 * **client_secret はWorkerだけが持つ。** クライアントは認可コード / refresh token を
 * `/api/google-oauth/token` へ渡し、Workerが交換して返す(Googleはrefresh tokenの発行・使用の
 * 両方でclient_secretを要求し、PKCEでは代替できない)。
 *
 * **access token は永続化しない。** 短命(約1時間)なのでメモリに置き、期限切れなら作り直す。
 * 永続化する価値より、保存された認証情報を増やさないことを取る。
 */

/** 認可後にGoogleが戻ってくる先。Google Cloud Consoleの「承認済みのリダイレクトURI」に登録が要る */
export const OAUTH_REDIRECT_PATH = "/oauth/callback";

/** stateとcode_verifierの一時保管先。タブを閉じれば消えてよい値のためsessionStorageを使う */
const STATE_STORAGE_KEY = "googleOAuthState";
const VERIFIER_STORAGE_KEY = "googleOAuthVerifier";

/**
 * access tokenの更新を、期限の何ミリ秒前から行うか。
 * 通信の往復と時計のズレを吸収するための余裕で、期限ぴったりまで使い切ると
 * 「送信した時点では有効だが到着時には切れている」が起こりうる。
 */
const REFRESH_MARGIN_MS = 60_000;

interface CachedAccessToken {
  token: string;
  expiresAtMs: number;
}

/** メモリ上のaccess token。リロードで消える(そのときはrefresh tokenから作り直す) */
let cachedAccessToken: CachedAccessToken | null = null;

/** 連携解除・失効時にメモリ上のトークンも捨てる。テストからも使う */
export function clearCachedAccessToken(): void {
  cachedAccessToken = null;
}

export interface GoogleOAuthConfig {
  clientId: string;
  scope: string;
}

/** WorkerからOAuthクライアントIDを取得する。ビルド時に埋め込まないのは、設定をWorker側に集約するため */
export async function fetchGoogleOAuthConfig(): Promise<GoogleOAuthConfig> {
  return requestApi<GoogleOAuthConfig>("/api/google-oauth/config", {
    timeoutMs: SYNC_REQUEST_TIMEOUT_MS,
    fallbackErrorMessage: () => "Googleの連携設定を取得できませんでした",
  });
}

export function googleOAuthRedirectUri(): string {
  return `${location.origin}${OAUTH_REDIRECT_PATH}`;
}

/**
 * Googleの認可画面へのURLを組み立て、PKCEのcode_verifierとstateをsessionStorageへ保存する。
 *
 * `access_type=offline` と `prompt=consent` は**どちらも必要**: 前者が無いとrefresh tokenが
 * 発行されず、後者が無いと2回目以降の認可でrefresh tokenが返らない(初回だけ返る仕様のため、
 * 再連携したいときに空振りする)。
 */
export async function buildAuthorizationUrl(config: GoogleOAuthConfig): Promise<string> {
  const verifier = generateRandomToken();
  const state = generateRandomToken(16);
  sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier);
  sessionStorage.setItem(STATE_STORAGE_KEY, state);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: googleOAuthRedirectUri(),
    response_type: "code",
    scope: config.scope,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: await createCodeChallenge(verifier),
    code_challenge_method: "S256",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
}

async function exchangeToken(body: Record<string, string>): Promise<TokenResponse> {
  return requestApi<TokenResponse>("/api/google-oauth/token", {
    method: "POST",
    body,
    timeoutMs: SYNC_REQUEST_TIMEOUT_MS,
    fallbackErrorMessage: () => "Googleとの連携に失敗しました",
  });
}

/**
 * 認可画面から戻ってきたときの処理。stateを照合し、認可コードをトークンへ交換して保存する。
 *
 * stateの照合は**CSRF対策として必須** — これが無いと、攻撃者の認可コードを踏ませることで
 * 攻撃者のDriveへ記録を書かせられる。照合後は使い捨てる。
 */
export async function completeAuthorization(params: URLSearchParams): Promise<void> {
  const savedState = sessionStorage.getItem(STATE_STORAGE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY);
  sessionStorage.removeItem(STATE_STORAGE_KEY);
  sessionStorage.removeItem(VERIFIER_STORAGE_KEY);

  const error = params.get("error");
  if (error !== null) {
    // ユーザーが認可画面で「キャンセル」を押した場合もここに来る(error=access_denied)
    throw new Error(
      error === "access_denied"
        ? "Googleとの連携がキャンセルされました"
        : `Googleとの連携に失敗しました (${error})`,
    );
  }

  const code = params.get("code");
  const state = params.get("state");
  if (code === null || state === null) throw new Error("Googleからの応答が不正でした");
  if (savedState === null || verifier === null) {
    throw new Error("連携の途中経過が失われました。設定画面からもう一度お試しください");
  }
  if (state !== savedState) throw new Error("Googleからの応答が不正でした");

  const tokens = await exchangeToken({
    grantType: "authorization_code",
    code,
    codeVerifier: verifier,
    redirectUri: googleOAuthRedirectUri(),
  });

  if (tokens.refreshToken === undefined) {
    // access_type=offline と prompt=consent を送っている限り起きないはずだが、
    // ここで黙って通すと「連携済みに見えるのに次回から更新できない」状態になる
    throw new Error("Googleから継続利用の許可が得られませんでした。もう一度お試しください");
  }
  await saveGoogleRefreshToken(tokens.refreshToken);
  cachedAccessToken = { token: tokens.accessToken, expiresAtMs: Date.now() + tokens.expiresIn * 1000 };
}

/**
 * Sheets APIを呼ぶためのaccess tokenを返す(#215がこれを使う)。
 * 期限内ならメモリのものを使い、切れていればrefresh tokenから作り直す。
 *
 * **失効(401)は正常系として扱う**(検討メモ12.8): 保存済みのrefresh tokenを捨てて未連携に戻し、
 * 再連携を促すエラーを投げる。使えないトークンを持ち続けても再連携の妨げにしかならない。
 */
export async function getGoogleAccessToken(): Promise<string> {
  if (cachedAccessToken !== null && cachedAccessToken.expiresAtMs - REFRESH_MARGIN_MS > Date.now()) {
    return cachedAccessToken.token;
  }

  const refreshToken = await getGoogleRefreshToken();
  if (refreshToken === null) {
    throw new Error("Googleと連携していません。設定画面から連携してください");
  }

  let tokens: TokenResponse;
  try {
    tokens = await exchangeToken({ grantType: "refresh_token", refreshToken });
  } catch (error) {
    if (error instanceof ApiStatusError && error.status === 401) {
      await clearGoogleRefreshToken();
      cachedAccessToken = null;
    }
    throw error;
  }

  cachedAccessToken = { token: tokens.accessToken, expiresAtMs: Date.now() + tokens.expiresIn * 1000 };
  return cachedAccessToken.token;
}

/** 連携を解除する。ローカルのトークンを捨てるだけで、Google側の認可取り消しはユーザーのアカウント画面から */
export async function disconnectGoogle(): Promise<void> {
  await clearGoogleRefreshToken();
  cachedAccessToken = null;
}
