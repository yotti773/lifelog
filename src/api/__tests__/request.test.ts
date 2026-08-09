import { afterEach, describe, expect, it, vi } from "vitest";
import {
  API_CONNECTION_MESSAGE,
  API_INVALID_RESPONSE_MESSAGE,
  API_TIMEOUT_MESSAGE,
  ApiConnectionError,
  isApiConnectionError,
  requestApi,
} from "@/api/request";
import { db } from "@/db/db";
import { updateSettings } from "@/db/settings";

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.settings.clear();
});

describe("requestApi", () => {
  it("POSTではJSONボディとcontent-typeを送り、応答のJSONを返す", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requestApi<{ ok: boolean }>("/api/thing", {
        method: "POST",
        body: { a: 1 },
        timeoutMs: 1000,
        fallbackErrorMessage: () => "失敗",
      }),
    ).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/thing");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual({ a: 1 });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("ボディ無し(GET)ではcontent-typeを付けない", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await requestApi("/api/thing", { timeoutMs: 1000, fallbackErrorMessage: () => "失敗" });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>)["content-type"]).toBeUndefined();
  });

  it("APIトークンが設定されていればAuthorizationヘッダを付ける", async () => {
    await updateSettings({ apiToken: "secret-token" });
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await requestApi("/api/thing", { timeoutMs: 1000, fallbackErrorMessage: () => "失敗" });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret-token");
  });

  it("サーバーが返したエラーメッセージをそのまま投げる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "認証に失敗しました" }), { status: 401 })),
    );

    await expect(
      requestApi("/api/thing", { timeoutMs: 1000, fallbackErrorMessage: () => "失敗" }),
    ).rejects.toThrow("認証に失敗しました");
  });

  it("エラーボディが解釈できない場合はステータス付きのフォールバック文言に落とす", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Bad Gateway", { status: 502 })));

    await expect(
      requestApi("/api/thing", { timeoutMs: 1000, fallbackErrorMessage: (status) => `失敗 (${status})` }),
    ).rejects.toThrow("失敗 (502)");
  });

  it("接続できなかった場合はApiConnectionErrorとして投げる(サーバーエラーと区別する)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const promise = requestApi("/api/thing", { timeoutMs: 1000, fallbackErrorMessage: () => "失敗" });
    await expect(promise).rejects.toThrow(API_CONNECTION_MESSAGE);
    await expect(promise).rejects.toBeInstanceOf(ApiConnectionError);
  });

  it("タイムアウトもApiConnectionErrorだが、文言は接続不能と分ける", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
      }),
    );

    const promise = requestApi("/api/thing", { timeoutMs: 1, fallbackErrorMessage: () => "失敗" });
    await expect(promise).rejects.toThrow(API_TIMEOUT_MESSAGE);
    await expect(promise).rejects.toBeInstanceOf(ApiConnectionError);
  });

  it("200でもJSONでない応答はApiConnectionErrorにする(Workerでない何かが応答している)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<!doctype html><html></html>", { status: 200 })),
    );

    const promise = requestApi("/api/thing", { timeoutMs: 1000, fallbackErrorMessage: () => "失敗" });
    await expect(promise).rejects.toThrow(API_INVALID_RESPONSE_MESSAGE);
    await expect(promise).rejects.toBeInstanceOf(ApiConnectionError);
  });

  it("サーバーが返したエラーはApiConnectionErrorではない", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));

    const error = await requestApi("/api/thing", {
      timeoutMs: 1000,
      fallbackErrorMessage: () => "失敗",
    }).catch((e: unknown) => e);

    expect(isApiConnectionError(error)).toBe(false);
  });
});
