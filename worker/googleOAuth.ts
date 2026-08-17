/**
 * ユーザー自身のGoogle認可(Issue #214。検討メモ12.7・12.8の案A)。
 *
 * **Workerが担うのはトークン交換だけで、健康データには触れない。** Sheets APIはクライアントから
 * 直接叩く(#215)。Googleは refresh token の発行・使用に `client_secret` を要求し、PKCEでは
 * 代替できないため、client_secret を持つサーバ側の口が1つだけ必要になる — それがここ。
 *
 * **refresh token は保存しない(ステートレスな中継)。** クライアントが持ち、必要なたびに送ってくる。
 * これにより、Workerが漏れても他人のDriveには手が届かない(検討メモ12.8の案A)。
 *
 * ## このファイルで守ること
 *
 * - **スコープに `spreadsheets` を足さない。** `drive.file` は非機微(non-sensitive)スコープで、
 *   非機微のみならGoogleのアプリ検証が必須にならない。`spreadsheets` は sensitive に落ちる(検討メモ12.7)
 * - **トークンをログに出さない。** `wrangler.toml` の `[observability]` に付けた注意(Issue #206)の対象。
 *   Googleからのエラー応答をそのまま返すときも、本文にトークンが混ざらないよう整形して返す
 * - **このエンドポイントは実質「client_secret の代行窓口」。** refresh token を盗んだ攻撃者は
 *   ここを叩けば代行させられるため、**必ず `/api/*` の共有トークン認証(worker/auth.ts)の内側に置く**
 */

/** 要求するスコープ。**ここに `spreadsheets` を足さないこと**(上記のとおり検証コストが跳ね上がる) */
export const GOOGLE_OAUTH_SCOPE = "https://www.googleapis.com/auth/drive.file";

export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export interface GoogleOAuthEnv {
  /** OAuthクライアントID(公開値。クライアントへ配信する) */
  GOOGLE_OAUTH_CLIENT_ID?: string;
  /** OAuthクライアントシークレット(Workerのみが持つ) */
  GOOGLE_OAUTH_CLIENT_SECRET?: string;
}

/** クライアントから受け取るリクエスト。認可コードの交換と、リフレッシュの2種類 */
export type GoogleTokenRequest =
  | { grantType: "authorization_code"; code: string; codeVerifier: string; redirectUri: string }
  | { grantType: "refresh_token"; refreshToken: string };

export interface GoogleTokenResponse {
  accessToken: string;
  /** 有効期限(秒)。クライアントはこれを使って期限切れ前に更新する */
  expiresIn: number;
  /** 認可コードの交換時のみ返る。リフレッシュ時は返らない(クライアントは既存の値を保持し続ける) */
  refreshToken?: string;
}

/**
 * Googleのトークンエンドポイントへ送るフォーム本文を組み立てる。
 * `client_secret` を必ず添える — Googleは refresh token の発行・使用の両方でこれを要求する。
 */
export function buildTokenRequestBody(
  req: GoogleTokenRequest,
  clientId: string,
  clientSecret: string,
): URLSearchParams {
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret });
  if (req.grantType === "authorization_code") {
    body.set("grant_type", "authorization_code");
    body.set("code", req.code);
    body.set("code_verifier", req.codeVerifier);
    body.set("redirect_uri", req.redirectUri);
  } else {
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", req.refreshToken);
  }
  return body;
}

/** リクエストボディを検証する。不正ならエラーメッセージを返す(nullなら妥当) */
export function validateTokenRequest(raw: unknown): { request: GoogleTokenRequest } | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "リクエストボディが不正です" };
  const body = raw as Record<string, unknown>;
  const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value !== "";

  if (body.grantType === "authorization_code") {
    if (!isNonEmptyString(body.code) || !isNonEmptyString(body.codeVerifier) || !isNonEmptyString(body.redirectUri)) {
      return { error: "code・codeVerifier・redirectUriは必須です" };
    }
    return {
      request: {
        grantType: "authorization_code",
        code: body.code,
        codeVerifier: body.codeVerifier,
        redirectUri: body.redirectUri,
      },
    };
  }
  if (body.grantType === "refresh_token") {
    if (!isNonEmptyString(body.refreshToken)) return { error: "refreshTokenは必須です" };
    return { request: { grantType: "refresh_token", refreshToken: body.refreshToken } };
  }
  return { error: "grantTypeはauthorization_codeまたはrefresh_tokenのいずれかです" };
}

/**
 * Googleのトークン応答を検証してキャメルケースに正規化する。
 * 不正な応答をそのまま通すとクライアント側で undefined のまま使われるため、ここで弾く。
 */
export function parseTokenResponse(raw: unknown): GoogleTokenResponse {
  const invalid = () => new Error("Googleのトークン応答が不正でした");
  if (typeof raw !== "object" || raw === null) throw invalid();
  const data = raw as Record<string, unknown>;
  if (typeof data.access_token !== "string" || data.access_token === "") throw invalid();
  if (typeof data.expires_in !== "number" || !Number.isFinite(data.expires_in)) throw invalid();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    ...(typeof data.refresh_token === "string" && data.refresh_token !== ""
      ? { refreshToken: data.refresh_token }
      : {}),
  };
}

/**
 * Googleのエラー応答から、**トークンを含まない**短いメッセージを組み立てる。
 * 応答本文をそのまま返すとリクエストの反射でトークンが混ざりうるため、既知のフィールドだけを拾う。
 */
export function describeTokenError(status: number, raw: unknown): string {
  const data = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const code = typeof data.error === "string" ? data.error : "unknown_error";
  // invalid_grant = 期限切れ・失効・取り消し済み。ユーザー操作(再連携)で直るため区別して伝える
  if (code === "invalid_grant") {
    return "Googleとの連携の有効期限が切れています。設定画面から連携し直してください";
  }
  return `Googleの認証に失敗しました (${status}: ${code})`;
}

/** クライアントIDの配信。**シークレットではない**(認可URLに載る公開値)ため、そのまま返してよい */
export function handleGoogleOAuthConfig(env: GoogleOAuthEnv): Response {
  if (!env.GOOGLE_OAUTH_CLIENT_ID) {
    return Response.json({ error: "GoogleのOAuthクライアントIDが未設定です" }, { status: 503 });
  }
  return Response.json({ clientId: env.GOOGLE_OAUTH_CLIENT_ID, scope: GOOGLE_OAUTH_SCOPE });
}

/**
 * 認可コードの交換・リフレッシュを中継する。**受け取ったトークンは保存しない。**
 * `/api/*` の共有トークン認証の内側で呼ばれる前提(worker/index.ts)。
 */
export async function handleGoogleOAuthToken(
  request: Request,
  env: GoogleOAuthEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    return Response.json({ error: "GoogleのOAuthクライアント設定が未設定です" }, { status: 503 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }

  const validated = validateTokenRequest(raw);
  if ("error" in validated) return Response.json({ error: validated.error }, { status: 400 });

  const res = await fetchImpl(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: buildTokenRequestBody(validated.request, env.GOOGLE_OAUTH_CLIENT_ID, env.GOOGLE_OAUTH_CLIENT_SECRET),
  });

  // 応答本文はJSONでないことがある(502等)。パース失敗も「不正な応答」として同じ経路で扱う
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    // 失効は異常系ではなく正常系として扱う(検討メモ12.8)。401で返し、クライアントが再連携を促す
    const isExpired =
      typeof payload === "object" && payload !== null && (payload as Record<string, unknown>).error === "invalid_grant";
    return Response.json({ error: describeTokenError(res.status, payload) }, { status: isExpired ? 401 : 502 });
  }

  try {
    return Response.json(parseTokenResponse(payload));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Googleのトークン応答が不正でした";
    return Response.json({ error: message }, { status: 502 });
  }
}
