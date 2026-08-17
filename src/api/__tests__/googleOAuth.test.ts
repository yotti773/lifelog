import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthorizationUrl,
  clearCachedAccessToken,
  completeAuthorization,
  disconnectGoogle,
  getGoogleAccessToken,
} from "@/api/googleOAuth";
import { db } from "@/db/db";
import { getGoogleRefreshToken, saveGoogleRefreshToken } from "@/db/googleAuth";

/** sessionStorageはNode環境に無いため最小限の実装を挿す */
function installSessionStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
  return store;
}

const CONFIG = { clientId: "client-id", scope: "https://www.googleapis.com/auth/drive.file" };

beforeEach(async () => {
  await db.googleAuth.clear();
  await db.settings.clear();
  clearCachedAccessToken();
  installSessionStorage();
  vi.stubGlobal("location", { origin: "https://app.example" });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** 成功応答を返すfetchモック。呼び出しごとのボディを記録する */
function stubTokenFetch(responses: unknown[]) {
  const bodies: Record<string, string>[] = [];
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)) as Record<string, string>);
    const next = responses.shift();
    return new Response(JSON.stringify(next), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, bodies };
}

describe("buildAuthorizationUrl", () => {
  it("必要なパラメータを揃えた認可URLを組み立てる", async () => {
    const url = new URL(await buildAuthorizationUrl(CONFIG));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example/oauth/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
  });

  it("refresh tokenを得るためのaccess_type・promptを付ける", async () => {
    // access_type=offline が無いとrefresh tokenが発行されず、
    // prompt=consent が無いと2回目以降の認可でrefresh tokenが返らない
    const url = new URL(await buildAuthorizationUrl(CONFIG));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
  });

  it("スコープはdrive.fileのみ(spreadsheetsを要求しない)", async () => {
    const url = new URL(await buildAuthorizationUrl(CONFIG));
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive.file");
  });

  it("呼ぶたびにcode_verifierとstateが変わる(使い回さない)", async () => {
    const store = installSessionStorage();
    await buildAuthorizationUrl(CONFIG);
    const first = { v: store.get("googleOAuthVerifier"), s: store.get("googleOAuthState") };
    await buildAuthorizationUrl(CONFIG);
    expect(store.get("googleOAuthVerifier")).not.toBe(first.v);
    expect(store.get("googleOAuthState")).not.toBe(first.s);
  });
});

describe("completeAuthorization", () => {
  async function startFlow() {
    const store = installSessionStorage();
    await buildAuthorizationUrl(CONFIG);
    return store.get("googleOAuthState")!;
  }

  it("stateが一致すれば認可コードを交換し、refresh tokenを保存する", async () => {
    const state = await startFlow();
    const { bodies } = stubTokenFetch([{ accessToken: "at", expiresIn: 3599, refreshToken: "rt" }]);

    await completeAuthorization(new URLSearchParams({ code: "the-code", state }));

    expect(await getGoogleRefreshToken()).toBe("rt");
    expect(bodies[0]).toMatchObject({ grantType: "authorization_code", code: "the-code" });
    expect(bodies[0].codeVerifier).toBeTruthy();
  });

  it("stateが一致しなければ交換しない(CSRF対策)", async () => {
    await startFlow();
    const { fetchMock } = stubTokenFetch([]);

    await expect(
      completeAuthorization(new URLSearchParams({ code: "the-code", state: "attacker-state" })),
    ).rejects.toThrow("不正");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await getGoogleRefreshToken()).toBeNull();
  });

  it("認可をキャンセルされた場合は専用の文言にする", async () => {
    await startFlow();
    await expect(completeAuthorization(new URLSearchParams({ error: "access_denied" }))).rejects.toThrow(
      "キャンセル",
    );
  });

  it("開始していない状態で戻ってきたら、やり直しを促す", async () => {
    installSessionStorage(); // verifier/stateが無い状態
    await expect(completeAuthorization(new URLSearchParams({ code: "c", state: "s" }))).rejects.toThrow(
      "もう一度お試しください",
    );
  });

  it("refresh tokenが返らなければ失敗にする(連携済みに見えて更新できない状態を作らない)", async () => {
    const state = await startFlow();
    stubTokenFetch([{ accessToken: "at", expiresIn: 3599 }]);

    await expect(completeAuthorization(new URLSearchParams({ code: "c", state }))).rejects.toThrow(
      "継続利用の許可",
    );
    expect(await getGoogleRefreshToken()).toBeNull();
  });

  it("state・verifierは使い捨てる(同じコードを二度交換させない)", async () => {
    const state = await startFlow();
    stubTokenFetch([{ accessToken: "at", expiresIn: 3599, refreshToken: "rt" }]);
    await completeAuthorization(new URLSearchParams({ code: "c", state }));

    await expect(completeAuthorization(new URLSearchParams({ code: "c", state }))).rejects.toThrow(
      "もう一度お試しください",
    );
  });
});

describe("getGoogleAccessToken", () => {
  it("未連携ならエラーにする", async () => {
    await expect(getGoogleAccessToken()).rejects.toThrow("連携していません");
  });

  it("refresh tokenからaccess tokenを作る", async () => {
    await saveGoogleRefreshToken("rt");
    const { bodies } = stubTokenFetch([{ accessToken: "at", expiresIn: 3599 }]);

    expect(await getGoogleAccessToken()).toBe("at");
    expect(bodies[0]).toEqual({ grantType: "refresh_token", refreshToken: "rt" });
  });

  it("期限内なら再取得せずメモリのトークンを使う", async () => {
    await saveGoogleRefreshToken("rt");
    const { fetchMock } = stubTokenFetch([{ accessToken: "at", expiresIn: 3599 }]);

    expect(await getGoogleAccessToken()).toBe("at");
    expect(await getGoogleAccessToken()).toBe("at");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("期限が近づいたら作り直す(ユーザー操作なしで更新される)", async () => {
    // **偽タイマー(vi.useFakeTimers)は使わない** — Dexieの内部タイマーとrequestApiの
    // AbortSignal.timeoutまで止まり、IndexedDBの操作がそのままハングする。
    // 期限判定が見ているのは Date.now() だけなので、そこだけ進める
    await saveGoogleRefreshToken("rt");
    stubTokenFetch([
      { accessToken: "at1", expiresIn: 3599 },
      { accessToken: "at2", expiresIn: 3599 },
    ]);

    expect(await getGoogleAccessToken()).toBe("at1");

    // 1時間経過(#214の完了条件「1時間以上経過したあともユーザー操作なしに更新される」)
    const realNow = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(realNow + 3600_000);
    try {
      expect(await getGoogleAccessToken()).toBe("at2");
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("失効(401)ならローカルのrefresh tokenを捨てて未連携に戻す", async () => {
    await saveGoogleRefreshToken("rt");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "連携し直してください" }), { status: 401 })),
    );

    await expect(getGoogleAccessToken()).rejects.toThrow("連携し直して");
    expect(await getGoogleRefreshToken()).toBeNull();
  });

  it("失効以外のエラーではrefresh tokenを捨てない(一時障害で連携を失わない)", async () => {
    await saveGoogleRefreshToken("rt");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "サーバーエラー" }), { status: 502 })),
    );

    await expect(getGoogleAccessToken()).rejects.toThrow();
    expect(await getGoogleRefreshToken()).toBe("rt");
  });
});

describe("disconnectGoogle", () => {
  it("保存済みトークンとメモリ上のトークンを両方捨てる", async () => {
    await saveGoogleRefreshToken("rt");
    stubTokenFetch([{ accessToken: "at", expiresIn: 3599 }]);
    await getGoogleAccessToken();

    await disconnectGoogle();

    expect(await getGoogleRefreshToken()).toBeNull();
    // メモリも消えているので、次は未連携エラーになる(古いトークンを返さない)
    await expect(getGoogleAccessToken()).rejects.toThrow("連携していません");
  });
});
