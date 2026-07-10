import type { Sex } from "@/types";

/** 体重1kgの増減に相当するカロリー(kcal)。要件定義書4.7.1章の必要日次赤字の計算に使う */
export const KCAL_PER_KG = 7700;

/** 活動レベルの5段階(要件定義書4.7.1章)。factorはTDEE計算の活動係数 */
export const ACTIVITY_LEVELS = [
  { factor: 1.2, label: "ほぼ運動しない" },
  { factor: 1.375, label: "軽い運動(週1〜3回)" },
  { factor: 1.55, label: "中程度の運動(週3〜5回)" },
  { factor: 1.725, label: "激しい運動(週6〜7回)" },
  { factor: 1.9, label: "非常に激しい運動・肉体労働" },
] as const;

export function activityLevelLabel(factor: number): string {
  return ACTIVITY_LEVELS.find((level) => level.factor === factor)?.label ?? `係数 ${factor}`;
}

export interface BodyProfile {
  heightCm: number;
  birthYear: number;
  sex: Sex;
  activityLevel: number;
}

/**
 * Mifflin-St Jeor式の基礎代謝(kcal/日)。
 * 誕生日は保持していないため、年齢は「基準日の年 − 生年」で近似する(最大1歳の誤差はBMRで数kcalであり許容)。
 */
export function calcBmr(
  profile: Pick<BodyProfile, "heightCm" | "birthYear" | "sex">,
  weightKg: number,
  onDate: string,
): number {
  const age = Number(onDate.slice(0, 4)) - profile.birthYear;
  const base = 10 * weightKg + 6.25 * profile.heightCm - 5 * age;
  return Math.round(profile.sex === "male" ? base + 5 : base - 161);
}

/** 計算式ベースの推定TDEE = BMR × 活動係数(要件定義書4.7.1章) */
export function calcFormulaTdee(bmrKcal: number, activityLevel: number): number {
  return Math.round(bmrKcal * activityLevel);
}

export interface CalorieTargetSuggestionInput {
  bmrKcal: number;
  /** 消費カロリー。実測TDEE(Issue #44)があれば実測を、無ければ計算式ベースを渡す(実測優先。画面設計書9章) */
  tdeeKcal: number;
  tdeeSource: "measured" | "formula";
  currentWeightKg: number;
  goalWeightKg: number;
  /** 今日から目標日までの残り日数。0以下(目標日超過)は提案不能としてnullを返す */
  remainingDays: number;
}

export interface CalorieTargetSuggestion {
  /** 提案目標カロリー(10kcal単位に丸め。BMRクランプ時はBMRそのもの) */
  suggestedKcal: number;
  bmrKcal: number;
  tdeeKcal: number;
  tdeeSource: "measured" | "formula";
  /** 必要日次赤字 = (現在体重 − 目標体重) × 7700 ÷ 残り日数 */
  requiredDailyDeficitKcal: number;
  /** 必要ペース(kg/週)。減量が必要なら正の値で表す */
  requiredWeeklyLossKg: number;
  /** ガードレール: 提案値がBMRを下回ったためBMRへクランプした(要件定義書4.7.1章) */
  clampedToBmr: boolean;
  /** ガードレール: 必要ペースが週あたり現在体重の1%を超えている(目標日または目標値の見直しを推奨) */
  paceTooFast: boolean;
}

/** 目標摂取カロリーの提案値を計算する(Issue #43)。値は「提案」であり、設定への反映はユーザーの確定操作で行うこと */
export function suggestCalorieTarget(input: CalorieTargetSuggestionInput): CalorieTargetSuggestion | null {
  const { bmrKcal, tdeeKcal, tdeeSource, currentWeightKg, goalWeightKg, remainingDays } = input;
  if (remainingDays <= 0) return null;

  const requiredDailyDeficitKcal = ((currentWeightKg - goalWeightKg) * KCAL_PER_KG) / remainingDays;
  const requiredWeeklyLossKg = ((currentWeightKg - goalWeightKg) / remainingDays) * 7;
  const raw = Math.round((tdeeKcal - requiredDailyDeficitKcal) / 10) * 10;
  const clampedToBmr = raw < bmrKcal;

  return {
    suggestedKcal: clampedToBmr ? bmrKcal : raw,
    bmrKcal,
    tdeeKcal,
    tdeeSource,
    requiredDailyDeficitKcal: Math.round(requiredDailyDeficitKcal),
    requiredWeeklyLossKg,
    clampedToBmr,
    paceTooFast: requiredWeeklyLossKg > currentWeightKg * 0.01,
  };
}

export interface PfcTargetSuggestion {
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/**
 * PFC目標値の提案(Issue #47。要件定義書4.7.5章):
 * たんぱく質 = 体重×2.0g(減量中の筋量維持のため高めの係数)、脂質 = 目標カロリーの25%、炭水化物 = 残余。
 */
export function suggestPfcTargets(weightKg: number, calorieTargetKcal: number): PfcTargetSuggestion {
  const proteinG = Math.round(weightKg * 2.0);
  const fatG = Math.round((calorieTargetKcal * 0.25) / 9);
  const carbsG = Math.max(0, Math.round((calorieTargetKcal - proteinG * 4 - fatG * 9) / 4));
  return { proteinG, fatG, carbsG };
}
