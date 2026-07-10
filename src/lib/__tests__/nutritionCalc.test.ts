import { describe, expect, it } from "vitest";
import {
  ACTIVITY_LEVELS,
  activityLevelLabel,
  calcBmr,
  calcFormulaTdee,
  suggestCalorieTarget,
  suggestPfcTargets,
} from "../nutritionCalc";

describe("calcBmr (Mifflin-St Jeor)", () => {
  it("男性: 10×体重 + 6.25×身長 − 5×年齢 + 5", () => {
    // 1990年生・2026年時点で36歳、175cm・72kg
    const bmr = calcBmr({ sex: "male", heightCm: 175, birthYear: 1990 }, 72, "2026-07-10");
    expect(bmr).toBe(Math.round(10 * 72 + 6.25 * 175 - 5 * 36 + 5)); // 1639
  });

  it("女性: 10×体重 + 6.25×身長 − 5×年齢 − 161", () => {
    const bmr = calcBmr({ sex: "female", heightCm: 160, birthYear: 2000 }, 55, "2026-01-01");
    expect(bmr).toBe(Math.round(10 * 55 + 6.25 * 160 - 5 * 26 - 161)); // 1259
  });

  it("年齢は基準日の年−生年で近似する", () => {
    const at2026 = calcBmr({ sex: "male", heightCm: 175, birthYear: 1990 }, 72, "2026-12-31");
    const at2027 = calcBmr({ sex: "male", heightCm: 175, birthYear: 1990 }, 72, "2027-01-01");
    expect(at2027).toBe(at2026 - 5); // 1歳分
  });
});

describe("calcFormulaTdee", () => {
  it("BMR×活動係数を丸めて返す", () => {
    expect(calcFormulaTdee(1639, 1.55)).toBe(Math.round(1639 * 1.55)); // 2540
  });
});

describe("activityLevelLabel", () => {
  it("5段階すべてにラベルがある", () => {
    for (const { factor } of ACTIVITY_LEVELS) {
      expect(activityLevelLabel(factor)).not.toContain("係数");
    }
  });

  it("未知の係数はフォールバック表示", () => {
    expect(activityLevelLabel(1.05)).toBe("係数 1.05");
  });
});

describe("suggestCalorieTarget", () => {
  const base = {
    bmrKcal: 1639,
    tdeeKcal: 2540,
    tdeeSource: "formula" as const,
    currentWeightKg: 72,
    goalWeightKg: 64,
    remainingDays: 113, // 約16週で-8kg → 約-0.5kg/週
  };

  it("提案値 = TDEE − 必要日次赤字(10kcal単位)", () => {
    const s = suggestCalorieTarget(base);
    expect(s).not.toBeNull();
    const deficit = ((72 - 64) * 7700) / 113; // ≈ 545
    expect(s!.requiredDailyDeficitKcal).toBe(Math.round(deficit));
    expect(s!.suggestedKcal).toBe(Math.round((2540 - deficit) / 10) * 10); // 2000
    expect(s!.suggestedKcal % 10).toBe(0);
    expect(s!.clampedToBmr).toBe(false);
    expect(s!.paceTooFast).toBe(false);
  });

  it("提案値がBMRを下回る場合はBMRへクランプし警告フラグを立てる", () => {
    const s = suggestCalorieTarget({ ...base, remainingDays: 30 }); // 赤字≈2053kcal/日
    expect(s!.clampedToBmr).toBe(true);
    expect(s!.suggestedKcal).toBe(base.bmrKcal);
  });

  it("必要ペースが週あたり現在体重の1%を超えるとpaceTooFast", () => {
    // 72kgの1% = 0.72kg/週。30日で8kg減 → 約1.87kg/週
    const s = suggestCalorieTarget({ ...base, remainingDays: 30 });
    expect(s!.paceTooFast).toBe(true);
    expect(s!.requiredWeeklyLossKg).toBeCloseTo((8 / 30) * 7, 5);
  });

  it("目標日を過ぎている(残り日数0以下)場合はnull", () => {
    expect(suggestCalorieTarget({ ...base, remainingDays: 0 })).toBeNull();
    expect(suggestCalorieTarget({ ...base, remainingDays: -3 })).toBeNull();
  });

  it("既に目標体重を下回っている場合は赤字が負になり、TDEEより大きい維持寄りの値を提案する", () => {
    const s = suggestCalorieTarget({ ...base, currentWeightKg: 63 });
    expect(s!.requiredDailyDeficitKcal).toBeLessThan(0);
    expect(s!.suggestedKcal).toBeGreaterThan(base.tdeeKcal);
    expect(s!.paceTooFast).toBe(false);
  });
});

describe("suggestPfcTargets", () => {
  it("P=体重×2.0、F=目標kcal×25%÷9、C=残余", () => {
    const s = suggestPfcTargets(72, 2000);
    expect(s.proteinG).toBe(144);
    expect(s.fatG).toBe(Math.round((2000 * 0.25) / 9)); // 56
    expect(s.carbsG).toBe(Math.round((2000 - 144 * 4 - 56 * 9) / 4)); // 230
  });

  it("炭水化物の残余が負になる極端な入力では0で下限クランプ", () => {
    const s = suggestPfcTargets(100, 800);
    expect(s.carbsG).toBe(0);
  });
});
