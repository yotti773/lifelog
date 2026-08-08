import { afterEach, describe, expect, it, vi } from "vitest";
import { judgeMealPhoto } from "@/api/judgeMeal";

// resizeImageToBase64はcanvasに依存しNode上で動かないため、変換済みの体でモックする
vi.mock("@/lib/image", () => ({
  resizeImageToBase64: vi.fn(async () => ({ base64: "IMAGEDATA", mimeType: "image/jpeg" })),
}));

const photo = new File(["dummy"], "meal.jpg", { type: "image/jpeg" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("judgeMealPhoto", () => {
  it("リサイズ済み画像・食事区分・メモをWorkerへ送り、判定結果を返す", async () => {
    const result = {
      items: [{ dishName: "唐揚げ定食", kcal: 850, proteinG: 40, fatG: 35, carbsG: 90 }],
      isUncertain: false,
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(result), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(judgeMealPhoto([photo], "lunch", "外食")).resolves.toEqual(result);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/judge-meal");
    expect(JSON.parse(String(init.body))).toEqual({
      images: [{ imageBase64: "IMAGEDATA", mimeType: "image/jpeg" }],
      mealType: "lunch",
      note: "外食",
    });
  });

  it("サーバーが返したエラーメッセージをそのまま投げる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "画像を解釈できません" }), { status: 502 })),
    );

    await expect(judgeMealPhoto([photo], "lunch")).rejects.toThrow("画像を解釈できません");
  });

  it("エラーボディが解釈できない場合は汎用メッセージに落とす", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Bad Gateway", { status: 502 })));

    await expect(judgeMealPhoto([photo], "lunch")).rejects.toThrow("食事の判定に失敗しました");
  });

  it("itemsが空の応答は「判定できませんでした」として投げる(200でも信用しない)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ items: [], isUncertain: false }), { status: 200 })),
    );

    await expect(judgeMealPhoto([photo], "lunch")).rejects.toThrow("写真から料理を判定できませんでした");
  });
});
