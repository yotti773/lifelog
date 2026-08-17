import { describe, expect, it, vi } from "vitest";
import {
  buildTokenRequestBody,
  describeTokenError,
  GOOGLE_OAUTH_SCOPE,
  GOOGLE_TOKEN_ENDPOINT,
  handleGoogleOAuthConfig,
  handleGoogleOAuthToken,
  parseTokenResponse,
  validateTokenRequest,
} from "../googleOAuth";

const ENV = { GOOGLE_OAUTH_CLIENT_ID: "client-id", GOOGLE_OAUTH_CLIENT_SECRET: "client-secret" };

function tokenRequest(body: unknown): Request {
  return new Request("https://example.com/api/google-oauth/token", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("GOOGLE_OAUTH_SCOPE", () => {
  // spreadsheets を足すと sensitive スコープに落ち、Googleのアプリ検証が必要になる(検討メモ12.7)。
  // 個人開発では現実的でないため、ここを踏まないことが配布版の前提になっている
  it("drive.file だけを要求する(spreadsheets を含めない)", () => {
    expect(GOOGLE_OAUTH_SCOPE).toBe("https://www.googleapis.com/auth/drive.file");
    expect(GOOGLE_OAUTH_SCOPE).not.toContain("spreadsheets");
    expect(GOOGLE_OAUTH_SCOPE).not.toContain("drive.readonly");
  });
});

describe("buildTokenRequestBody", () => {
  it("認可コードの交換にはcode・code_verifier・redirect_uriを載せる", () => {
    const body = buildTokenRequestBody(
      { grantType: "authorization_code", code: "abc", codeVerifier: "verifier", redirectUri: "https://app/cb" },
      "cid",
      "secret",
    );
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("abc");
    expect(body.get("code_verifier")).toBe("verifier");
    expect(body.get("redirect_uri")).toBe("https://app/cb");
  });

  it("リフレッシュにはrefresh_tokenを載せ、codeは載せない", () => {
    const body = buildTokenRequestBody({ grantType: "refresh_token", refreshToken: "rt" }, "cid", "secret");
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt");
    expect(body.get("code")).toBeNull();
  });

  it("どちらの場合もclient_secretを添える(Googleが両方で要求するため)", () => {
    for (const req of [
      { grantType: "authorization_code", code: "a", codeVerifier: "v", redirectUri: "r" },
      { grantType: "refresh_token", refreshToken: "rt" },
    ] as const) {
      const body = buildTokenRequestBody(req, "cid", "secret");
      expect(body.get("client_id")).toBe("cid");
      expect(body.get("client_secret")).toBe("secret");
    }
  });
});

describe("validateTokenRequest", () => {
  it("妥当な認可コード交換を通す", () => {
    const result = validateTokenRequest({
      grantType: "authorization_code",
      code: "a",
      codeVerifier: "v",
      redirectUri: "r",
    });
    expect(result).toEqual({
      request: { grantType: "authorization_code", code: "a", codeVerifier: "v", redirectUri: "r" },
    });
  });

  it("妥当なリフレッシュを通す", () => {
    expect(validateTokenRequest({ grantType: "refresh_token", refreshToken: "rt" })).toEqual({
      request: { grantType: "refresh_token", refreshToken: "rt" },
    });
  });

  it.each([
    ["オブジェクトでない", "文字列"],
    ["grantTypeが不明", { grantType: "password" }],
    ["codeVerifierが欠落", { grantType: "authorization_code", code: "a", redirectUri: "r" }],
    ["codeが空文字", { grantType: "authorization_code", code: "", codeVerifier: "v", redirectUri: "r" }],
    ["refreshTokenが欠落", { grantType: "refresh_token" }],
  ])("%s は弾く", (_label, raw) => {
    expect(validateTokenRequest(raw)).toHaveProperty("error");
  });
});

describe("parseTokenResponse", () => {
  it("スネークケースをキャメルケースに正規化する", () => {
    expect(parseTokenResponse({ access_token: "at", expires_in: 3599, refresh_token: "rt" })).toEqual({
      accessToken: "at",
      expiresIn: 3599,
      refreshToken: "rt",
    });
  });

  it("リフレッシュ時のようにrefresh_tokenが無くても通す(既存の値を使い続けるため)", () => {
    expect(parseTokenResponse({ access_token: "at", expires_in: 3599 })).toEqual({
      accessToken: "at",
      expiresIn: 3599,
    });
  });

  it.each([
    ["access_tokenが欠落", { expires_in: 3599 }],
    ["access_tokenが空", { access_token: "", expires_in: 3599 }],
    ["expires_inが数値でない", { access_token: "at", expires_in: "3599" }],
    ["オブジェクトでない", null],
  ])("%s はエラーにする(undefinedのまま使わせない)", (_label, raw) => {
    expect(() => parseTokenResponse(raw)).toThrow("Googleのトークン応答が不正でした");
  });
});

describe("describeTokenError", () => {
  it("invalid_grant は再連携を促す文言にする(失効は正常系)", () => {
    expect(describeTokenError(400, { error: "invalid_grant" })).toContain("連携し直して");
  });

  it("その他はステータスとエラーコードだけを出す", () => {
    expect(describeTokenError(403, { error: "access_denied" })).toBe(
      "Googleの認証に失敗しました (403: access_denied)",
    );
  });

  it("応答本文をそのまま含めない(トークンの混入を防ぐ)", () => {
    const message = describeTokenError(400, {
      error: "invalid_request",
      refresh_token: "SECRET-RT",
      access_token: "SECRET-AT",
ようこそ: "SECRET",
    });
    expect(message).not.toContain("SECRET");
  });
});

describe("handleGoogleOAuthConfig", () => {
  it("クライアントIDとスコープを返す", async () => {
    const res = handleGoogleOAuthConfig(ENV);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clientId: "client-id", scope: GOOGLE_OAUTH_SCOPE });
  });

  it("クライアントIDが未設定なら503", () => {
    expect(handleGoogleOAuthConfig({}).status).toBe(503);
  });

  it("クライアントシークレットは返さない", async () => {
    const body = JSON.stringify(await handleGoogleOAuthConfig(ENV).json());
    expect(body).not.toContain("client-secret");
  });
});

describe("handleGoogleOAuthToken", () => {
  it("認可コードをGoogleのトークンエンドポイントで交換して返す", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ access_token: "at", expires_in: 3599, refresh_token: "rt" })),
    );
    const res = await handleGoogleOAuthToken(
      tokenRequest({ grantType: "authorization_code", code: "a", codeVerifier: "v", redirectUri: "r" }),
      ENV,
      fetchImpl as unknown as typeof fetch,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accessToken: "at", expiresIn: 3599, refreshToken: "rt" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GOOGLE_TOKEN_ENDPOINT);
    expect(String(init.body)).toContain("client_secret=client-secret");
  });

  it("リフレッシュも同じ窓口で中継する", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ access_token: "at2", expires_in: 3599 })));
    const res = await handleGoogleOAuthToken(
      tokenRequest({ grantType: "refresh_token", refreshToken: "rt" }),
      ENV,
      fetchImpl as unknown as typeof fetch,
    );
    expect(await res.json()).toEqual({ accessToken: "at2", expiresIn: 3599 });
  });

  it("OAuth設定が無ければ503(Google Cloud側の設定前)", async () => {
    const res = await handleGoogleOAuthToken(tokenRequest({ grantType: "refresh_token", refreshToken: "rt" }), {});
    expect(res.status).toBe(503);
  });

  it("不正なボディは400で、Googleを呼ばない", async () => {
    const fetchImpl = vi.fn();
    const res = await handleGoogleOAuthToken(
      tokenRequest({ grantType: "password" }),
      ENV,
      fetchImpl as unknown as typeof fetch,
    );
    expect(res.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("invalid_grant(失効)は401で返し、再連携を促す", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
    );
    const res = await handleGoogleOAuthToken(
      tokenRequest({ grantType: "refresh_token", refreshToken: "rt" }),
      ENV,
      fetchImpl as unknown as typeof fetch,
    );
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toContain("連携し直して");
  });

  it("その他のGoogleエラーは502で返す", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ error: "server_error" }), { status: 500 }),
    );
    const res = await handleGoogleOAuthToken(
      tokenRequest({ grantType: "refresh_token", refreshToken: "rt" }),
      ENV,
      fetchImpl as unknown as typeof fetch,
    );
    expect(res.status).toBe(502);
  });

  it("Googleのエラー応答をそのまま返さない(トークンの混入を防ぐ)", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "invalid_request", refresh_token: "SECRET-RT" }), { status: 400 }),
    );
    const res = await handleGoogleOAuthToken(
      tokenRequest({ grantType: "refresh_token", refreshToken: "rt" }),
      ENV,
      fetchImpl as unknown as typeof fetch,
    );
    expect(JSON.stringify(await res.json())).not.toContain("SECRET-RT");
  });

  it("応答がJSONでなくても落ちない(502として扱う)", async () => {
    const fetchImpl = vi.fn(async () => new Response("Bad Gateway", { status: 502 }));
    const res = await handleGoogleOAuthToken(
      tokenRequest({ grantType: "refresh_token", refreshToken: "rt" }),
      ENV,
      fetchImpl as unknown as typeof fetch,
    );
    expect(res.status).toBe(502);
  });
});
