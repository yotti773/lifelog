import { describe, expect, it } from "vitest";
import { aggregateMoodCounts, buildWeeklyDigest, type WeeklyDigestSource } from "../weeklyDigest";

/** 順調な週(7日全記録・-0.5kg/週・目標以内5日)のベース入力 */
function goodWeekSource(): WeeklyDigestSource {
  return {
    weekStart: "2026-07-06",
    today: "2026-07-13",
    goalWeightKg: 64,
    goalDate: "2026-10-31",
    calorieTargetKcal: 1900,
    pfcTargets: { proteinG: 130, fatG: 53, carbsG: 230 },
    bmrKcal: 1639,
    weekWeights: [{ weightKg: 71.2 }, { weightKg: 71.4 }, { weightKg: 71.6 }],
    prevWeekWeights: [{ weightKg: 71.9 }],
    latestWeightKg: 71.2,
    mealDailyTotals: [
      { date: "2026-07-06", kcal: 1800, proteinG: 120, fatG: 55, carbsG: 190 },
      { date: "2026-07-07", kcal: 1850, proteinG: 125, fatG: 50, carbsG: 200 },
      { date: "2026-07-08", kcal: 1900, proteinG: 118, fatG: 60, carbsG: 185 },
      { date: "2026-07-09", kcal: 2000, proteinG: 122, fatG: 52, carbsG: 210 },
      { date: "2026-07-10", kcal: 1850, proteinG: 121, fatG: 54, carbsG: 195 },
      { date: "2026-07-11", kcal: 1800, proteinG: 119, fatG: 56, carbsG: 188 },
      { date: "2026-07-12", kcal: 1750, proteinG: 123, fatG: 51, carbsG: 192 },
    ],
    recordedDays: 7,
    currentStreakDays: 12,
    estimatedTdeeKcal: 2400,
    projectedKg: 63.5,
    moods: ["great", "good", "ok", "tired"],
  };
}

describe("buildWeeklyDigest", () => {
  it("順調な週: 集計値が正しくフラグが立たない", () => {
    const digest = buildWeeklyDigest(goodWeekSource());

    expect(digest.period).toEqual({ start: "2026-07-06", end: "2026-07-12" });
    expect(digest.goal.remainingDays).toBe(110);
    expect(digest.weight.weekAvgKg).toBe(71.4);
    expect(digest.weight.prevWeekAvgKg).toBe(71.9);
    expect(digest.weight.weeklyChangeKg).toBe(-0.5);
    // 必要ペース = -(71.4-64)/110*7 ≈ -0.47kg/週
    expect(digest.weight.requiredWeeklyPaceKg).toBeCloseTo(-0.47, 2);
    // 基準体重は週平均を優先する(latestWeightKg=71.2ではなくweekAvgKg=71.4)
    expect(digest.weight.paceBaseKg).toBe(71.4);
    expect(digest.calories.avgIntakeKcal).toBe(1850);
    expect(digest.calories.daysOnTarget).toBe(6); // 2000kcalの1日だけ超過
    expect(digest.calories.recordedDays).toBe(7);
    expect(digest.pfc.avgProteinG).toBeCloseTo(121.1, 1);
    expect(digest.pfc.targetProteinG).toBe(130);
    expect(digest.recording).toEqual({ recordedDays: 7, currentStreakDays: 12 });
    expect(digest.flags).toEqual([]);
    expect(digest.mood).toEqual({ good: 2, normal: 1, bad: 1 });
  });

  it("PACE_TOO_AGGRESSIVE: 週の減少幅が週平均体重の1%を超える", () => {
    const src = goodWeekSource();
    src.prevWeekWeights = [{ weightKg: 72.5 }]; // -1.1kg > 71.4×1% = 0.714kg
    expect(buildWeeklyDigest(src).flags).toContain("PACE_TOO_AGGRESSIVE");
  });

  it("体重増加の週はPACE_TOO_AGGRESSIVEにならない", () => {
    const src = goodWeekSource();
    src.prevWeekWeights = [{ weightKg: 70.0 }]; // +1.4kg増
    expect(buildWeeklyDigest(src).flags).not.toContain("PACE_TOO_AGGRESSIVE");
  });

  it("INTAKE_BELOW_BMR: 週平均摂取が基礎代謝を下回る", () => {
    const src = goodWeekSource();
    src.mealDailyTotals = src.mealDailyTotals.map((d) => ({ ...d, kcal: 1500 }));
    expect(buildWeeklyDigest(src).flags).toContain("INTAKE_BELOW_BMR");
  });

  it("BMR未設定(身体プロフィール無し)ならINTAKE_BELOW_BMRは判定しない", () => {
    const src = goodWeekSource();
    src.bmrKcal = null;
    src.mealDailyTotals = src.mealDailyTotals.map((d) => ({ ...d, kcal: 1200 }));
    expect(buildWeeklyDigest(src).flags).not.toContain("INTAKE_BELOW_BMR");
  });

  it("BEHIND_PACE: 着地予測が目標体重を上回る", () => {
    const src = goodWeekSource();
    src.projectedKg = 66.2;
    expect(buildWeeklyDigest(src).flags).toContain("BEHIND_PACE");
  });

  it("記録サボり週: LOW_RECORDING_RATE(5日未満)", () => {
    const src = goodWeekSource();
    src.recordedDays = 3;
    const digest = buildWeeklyDigest(src);
    expect(digest.flags).toContain("LOW_RECORDING_RATE");
    expect(digest.flags).not.toContain("INSUFFICIENT_DATA");
  });

  it("データ不足週: NO_WEIGHT_DATA + INSUFFICIENT_DATA(2日未満)", () => {
    const src = goodWeekSource();
    src.weekWeights = [];
    src.prevWeekWeights = [];
    src.mealDailyTotals = [];
    src.recordedDays = 0;
    src.moods = [];
    const digest = buildWeeklyDigest(src);
    expect(digest.flags).toEqual(["LOW_RECORDING_RATE", "NO_WEIGHT_DATA", "INSUFFICIENT_DATA"]);
    expect(digest.weight.weekAvgKg).toBeNull();
    expect(digest.calories.avgIntakeKcal).toBeNull();
    expect(digest.pfc.avgProteinG).toBeNull();
    // 週平均が無い場合は最新体重でフォールバックして必要ペースを出す
    expect(digest.weight.requiredWeeklyPaceKg).toBeCloseTo(-((71.2 - 64) / 110) * 7, 2);
    expect(digest.weight.paceBaseKg).toBe(71.2);
    expect(digest.mood).toBeUndefined();
  });

  it("体重記録が1件も無い(latestWeightKgもnull)場合の必要ペースは0・paceBaseKgもnull", () => {
    const src = goodWeekSource();
    src.weekWeights = [];
    src.latestWeightKg = null;
    const digest = buildWeeklyDigest(src);
    expect(digest.weight.requiredWeeklyPaceKg).toBe(0);
    expect(digest.weight.paceBaseKg).toBeNull();
  });

  it("目標日を過ぎている場合はremainingDays=0・必要ペース0", () => {
    const src = goodWeekSource();
    src.today = "2026-11-05";
    const digest = buildWeeklyDigest(src);
    expect(digest.goal.remainingDays).toBe(0);
    expect(digest.weight.requiredWeeklyPaceKg).toBe(0);
  });

  it("PFC目標未設定ならtarget側はnull", () => {
    const src = goodWeekSource();
    src.pfcTargets = null;
    const digest = buildWeeklyDigest(src);
    expect(digest.pfc.targetProteinG).toBeNull();
    expect(digest.pfc.avgProteinG).not.toBeNull();
  });
});

describe("aggregateMoodCounts", () => {
  it("5段階の気分タグを3区分(good/normal/bad)に集計する", () => {
    expect(aggregateMoodCounts(["great", "good", "ok", "tired", "bad"])).toEqual({
      good: 2,
      normal: 1,
      bad: 2,
    });
  });

  it("日記が無い週はundefined(digestからmoodを省く)", () => {
    expect(aggregateMoodCounts([])).toBeUndefined();
  });
});
