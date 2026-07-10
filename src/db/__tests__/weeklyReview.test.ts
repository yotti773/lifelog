import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { saveDiaryRecord } from "../diaryRecords";
import { addMealRecord } from "../mealRecords";
import { updateSettings } from "../settings";
import { saveWeightRecord } from "../weightRecords";
import { getWeeklyDigest } from "../weeklyReview";
import { addDaysToDateString } from "@/lib/date";

// 2026-07-06(月)〜07-12(日)を対象週、「今日」を翌週月曜として注入する
const WEEK_START = "2026-07-06";
const TODAY = "2026-07-13";

beforeEach(async () => {
  await Promise.all([
    db.weightRecords.clear(),
    db.mealRecords.clear(),
    db.diaryRecords.clear(),
    db.settings.clear(),
    db.syncDeletions.clear(),
  ]);
});

describe("getWeeklyDigest", () => {
  it("記録が1件も無い週はデータ不足フラグ付きの空ダイジェストになる", async () => {
    const digest = await getWeeklyDigest(WEEK_START, TODAY);
    expect(digest.period).toEqual({ start: "2026-07-06", end: "2026-07-12" });
    expect(digest.weight.weekAvgKg).toBeNull();
    expect(digest.calories.estimatedTdeeKcal).toBeNull();
    expect(digest.flags).toEqual(["LOW_RECORDING_RATE", "NO_WEIGHT_DATA", "INSUFFICIENT_DATA"]);
    expect(digest.mood).toBeUndefined();
  });

  it("記録・設定からダイジェストを組み立てる(体重・食事・記録率・気分・BMR)", async () => {
    await updateSettings({
      goalWeightKg: 64,
      goalDate: "2026-10-31",
      dailyCalorieTarget: 1900,
      heightCm: 175,
      birthYear: 1990,
      sex: "male",
      activityLevel: 1.55,
      dailyProteinTargetG: 130,
      dailyFatTargetG: 53,
      dailyCarbsTargetG: 230,
    });
    // 前週: 体重2件(平均71.9)
    await saveWeightRecord({ date: "2026-06-29", weightKg: 72.0 });
    await saveWeightRecord({ date: "2026-07-02", weightKg: 71.8 });
    // 当該週: 体重2件(平均71.4)+ 食事5日 + 日記
    await saveWeightRecord({ date: "2026-07-06", weightKg: 71.5 });
    await saveWeightRecord({ date: "2026-07-10", weightKg: 71.3 });
    for (let i = 0; i < 5; i++) {
      await addMealRecord({
        mealType: "lunch",
        confirmedName: "テスト食",
        confirmedKcal: 1850,
        confirmedProteinG: 120,
        confirmedFatG: 55,
        confirmedCarbsG: 190,
        timestamp: new Date(`${addDaysToDateString(WEEK_START, i)}T12:00:00`).toISOString(),
      });
    }
    await saveDiaryRecord({ date: "2026-07-07", text: "順調", mood: "good" });

    const digest = await getWeeklyDigest(WEEK_START, TODAY);
    expect(digest.weight.weekAvgKg).toBe(71.4);
    expect(digest.weight.prevWeekAvgKg).toBe(71.9);
    expect(digest.weight.weeklyChangeKg).toBe(-0.5);
    expect(digest.calories.avgIntakeKcal).toBe(1850);
    expect(digest.calories.daysOnTarget).toBe(5);
    // 実測TDEE: 有効週(食事5日・両週の体重2件以上)→ 1850 + 550 = 2400
    expect(digest.calories.estimatedTdeeKcal).toBe(2400);
    // BMR: 男性・175cm・36歳・直近体重71.3kg → 10×71.3+6.25×175−5×36+5 = 1632
    expect(digest.calories.bmrKcal).toBe(1632);
    expect(digest.pfc.targetProteinG).toBe(130);
    expect(digest.pfc.avgProteinG).toBe(120);
    // 記録した日: 食事5日 + 体重のみの日は無し(06はどちらもあり)→ 06,07,08,09,10 = 5日
    expect(digest.recording.recordedDays).toBe(5);
    expect(digest.flags).not.toContain("LOW_RECORDING_RATE");
    expect(digest.mood).toEqual({ good: 1, normal: 0, bad: 0 });
  });
});
