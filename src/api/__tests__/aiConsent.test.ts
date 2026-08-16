import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { judgeMealPhoto } from "@/api/judgeMeal";
import { requestMonthlyAdvice } from "@/api/monthlyAdvice";
import { requestWeeklyAdvice } from "@/api/weeklyAdvice";
import { db } from "@/db/db";
import { agreeToAiConsent, getSettings, hasAiConsent, withdrawAiConsent } from "@/db/settings";
import type { MonthlyDigest, WeeklyDigest } from "@/types";

vi.mock("@/lib/image", () => ({
  resizeImageToBase64: vi.fn(async () => ({ base64: "IMAGEDATA", mimeType: "image/jpeg" })),
}));

beforeEach(async () => {
  await db.settings.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** 呼ばれたら失敗させるfetch。同意ガードが送信前に止めていることを確認するために使う */
function fetchThatMustNotBeCalled() {
  return vi.fn(() => {
    throw new Error("同意していないのに送信された");
  });
}

const weeklyDigest = {} as WeeklyDigest;
const monthlyDigest = {} as MonthlyDigest;
const photo = new File(["dummy"], "meal.jpg", { type: "image/jpeg" });

describe("AI機能の同意ガード(Issue #219)", () => {
  // 3つの入口すべてを対象にする。画面側の分岐だけで守ると呼び出しを増やしたときにすり抜けるため、
  // 送信直前のこの層で止まることを入口ごとに確認する
  const entryPoints: [string, () => Promise<unknown>][] = [
    ["週次AIコメント", () => requestWeeklyAdvice(weeklyDigest)],
    ["月次AIコメント", () => requestMonthlyAdvice(monthlyDigest)],
    ["食事の判定", () => judgeMealPhoto([photo], "lunch")],
  ];

  it.each(entryPoints)("未同意なら%sは送信せずにエラーになる", async (_label, call) => {
    const fetchMock = fetchThatMustNotBeCalled();
    vi.stubGlobal("fetch", fetchMock);

    await expect(call()).rejects.toThrow("AI機能の利用にはデータ送信への同意が必要です");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(entryPoints)("撤回後も%sは送信せずにエラーになる", async (_label, call) => {
    await agreeToAiConsent();
    await withdrawAiConsent();
    const fetchMock = fetchThatMustNotBeCalled();
    vi.stubGlobal("fetch", fetchMock);

    await expect(call()).rejects.toThrow("AI機能の利用にはデータ送信への同意が必要です");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("同意済みなら送信される", async () => {
    await agreeToAiConsent();
    const advice = { verdict: "on_track", summary: "順調です", wins: ["継続"], actions: ["維持"] };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(advice), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestWeeklyAdvice(weeklyDigest)).resolves.toEqual(advice);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("同意状態の保持", () => {
  it("未設定は未同意として扱う", async () => {
    expect(hasAiConsent(await getSettings())).toBe(false);
  });

  it("同意すると日時が記録される", async () => {
    await agreeToAiConsent();
    const settings = await getSettings();
    expect(hasAiConsent(settings)).toBe(true);
    expect(Number.isNaN(Date.parse(settings.aiConsentAgreedAt!))).toBe(false);
  });

  it("再同意しても初回の日時を保つ(同意の記録として上書きしない)", async () => {
    await agreeToAiConsent();
    const first = (await getSettings()).aiConsentAgreedAt;
    await agreeToAiConsent();
    expect((await getSettings()).aiConsentAgreedAt).toBe(first);
  });

  it("撤回すると項目自体が消える(falseを残さない)", async () => {
    await agreeToAiConsent();
    await withdrawAiConsent();
    const settings = await getSettings();
    expect(hasAiConsent(settings)).toBe(false);
    expect("aiConsentAgreedAt" in settings).toBe(false);
  });

  it("撤回後にもう一度同意できる", async () => {
    await agreeToAiConsent();
    await withdrawAiConsent();
    await agreeToAiConsent();
    expect(hasAiConsent(await getSettings())).toBe(true);
  });

  it("同意・撤回とも他の設定を壊さない", async () => {
    await db.settings.put({ id: "default", goalWeightKg: 64, dailyCalorieTarget: 1730, synced: true });
    await agreeToAiConsent();
    await withdrawAiConsent();
    const settings = await getSettings();
    expect(settings.goalWeightKg).toBe(64);
    expect(settings.dailyCalorieTarget).toBe(1730);
  });
});
