import { describe, expect, it } from "vitest";
import {
  averageWeightKg,
  smoothedMeasuredTdee,
  weeklyMeasuredTdee,
  type WeeklyNutritionSummary,
} from "../tdee";

const validWeek: WeeklyNutritionSummary = {
  avgIntakeKcal: 1850,
  mealRecordedDays: 7,
  weightCount: 5,
  weekAvgKg: 71.4,
};
const validPrevWeek = { weightCount: 4, weekAvgKg: 71.9 };

describe("averageWeightKg", () => {
  it("週平均を返す", () => {
    expect(averageWeightKg([{ weightKg: 71 }, { weightKg: 72 }])).toBe(71.5);
  });

  it("記録が無ければnull", () => {
    expect(averageWeightKg([])).toBeNull();
  });
});

describe("weeklyMeasuredTdee", () => {
  it("実測TDEE = 週平均摂取kcal − (週平均体重の前週比変化kg × 7700 ÷ 7)", () => {
    // 変化 -0.5kg → 1850 − (-0.5×7700÷7) = 1850 + 550 = 2400
    expect(weeklyMeasuredTdee(validWeek, validPrevWeek)).toBe(2400);
  });

  it("体重増加の週は摂取より小さいTDEEになる", () => {
    const tdee = weeklyMeasuredTdee({ ...validWeek, weekAvgKg: 72.2 }, { weightCount: 3, weekAvgKg: 71.9 });
    expect(tdee).toBe(Math.round(1850 - (0.3 * 7700) / 7)); // 1520
  });

  it("食事記録が5日未満の週は無効(null)", () => {
    expect(weeklyMeasuredTdee({ ...validWeek, mealRecordedDays: 4 }, validPrevWeek)).toBeNull();
  });

  it("当該週の体重記録が2件未満なら無効", () => {
    expect(weeklyMeasuredTdee({ ...validWeek, weightCount: 1 }, validPrevWeek)).toBeNull();
  });

  it("前週の体重記録が2件未満なら無効", () => {
    expect(weeklyMeasuredTdee(validWeek, { weightCount: 1, weekAvgKg: 71.9 })).toBeNull();
  });

  it("食事記録が無い週(平均摂取がnull)は無効", () => {
    expect(weeklyMeasuredTdee({ ...validWeek, avgIntakeKcal: null, mealRecordedDays: 5 }, validPrevWeek)).toBeNull();
  });
});

describe("smoothedMeasuredTdee", () => {
  it("直近の有効週 最大3週の平均を返す", () => {
    // 有効週が4つ → 直近3つ(2300, 2400, 2500)の平均
    expect(smoothedMeasuredTdee([2600, 2300, 2400, 2500])).toBe(2400);
  });

  it("無効週(null)は飛ばして有効週だけで平均する", () => {
    expect(smoothedMeasuredTdee([2300, null, 2500])).toBe(2400);
  });

  it("有効週が3週未満ならある分だけで平均する", () => {
    expect(smoothedMeasuredTdee([null, 2400, null])).toBe(2400);
  });

  it("有効週が1つも無ければnull(データ蓄積中)", () => {
    expect(smoothedMeasuredTdee([null, null])).toBeNull();
    expect(smoothedMeasuredTdee([])).toBeNull();
  });
});
