import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertAiConsent } from "@/api/aiConsent";
import { getAiConsentAt, grantAiConsent, hasAiConsent, revokeAiConsent } from "@/db/aiConsent";
import { db } from "@/db/db";
import { requestWeeklyAdvice } from "@/api/weeklyAdvice";
import type { WeeklyDigest } from "@/types";

beforeEach(async () => {
  await db.settings.clear();
});

describe("AIへの送信の同意(Issue #219)", () => {
  it("既定は未同意", async () => {
    expect(await hasAiConsent()).toBe(false);
    expect(await getAiConsentAt()).toBeNull();
  });

  it("同意すると日時が残り、取り消すと未同意に戻る", async () => {
    await grantAiConsent();
    expect(await hasAiConsent()).toBe(true);
    expect(await getAiConsentAt()).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await revokeAiConsent();
    expect(await hasAiConsent()).toBe(false);
    // 空文字を残さず「値が無い」に戻す(未同意の判定を1点に保つ)
    expect(await getAiConsentAt()).toBeNull();
  });

  it("未同意ならassertAiConsentが弾き、同意後は通る", async () => {
    await expect(assertAiConsent()).rejects.toThrow(/同意していません/);
    await grantAiConsent();
    await expect(assertAiConsent()).resolves.toBeUndefined();
  });

  it("未同意ならAIコメントの生成は通信せずに失敗する", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // ダイジェストの中身は問わない。同意チェックが送信より前にあることを確認する
    await expect(requestWeeklyAdvice({} as WeeklyDigest)).rejects.toThrow(/同意していません/);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("同意しても他の設定は壊さない", async () => {
    const { updateSettings, getSettings } = await import("@/db/settings");
    await updateSettings({ goalWeightKg: 64 });
    await grantAiConsent();

    const settings = await getSettings();
    expect(settings.goalWeightKg).toBe(64);
    expect(settings.aiConsentAt).toBeTruthy();
  });
});
