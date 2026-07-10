import { KCAL_PER_KG } from "./nutritionCalc";

/**
 * 実測TDEE推定(Issue #44。要件定義書4.7.2章)。
 * 週次の摂取カロリーと体重変化から実際の消費カロリーを逆算する:
 *   実測TDEE ≈ 週の平均摂取kcal − (週平均体重の前週比変化kg × 7700 ÷ 7)
 * 体重は日々のノイズ(水分等)を消すため、単日の値ではなく週平均同士で比較する。
 */

/** 有効週の条件: 食事記録がこの日数以上ある週のみを計算対象にする(データ品質ゲート) */
export const TDEE_MIN_MEAL_RECORDED_DAYS = 5;
/** 有効週の条件: 当該週・前週の両方に体重記録がこの件数以上あること */
export const TDEE_MIN_WEIGHT_RECORDS = 2;
/** 平滑化: 直近の有効週 最大この週数の平均を「現在の実測TDEE」とする */
export const TDEE_SMOOTHING_WEEKS = 3;

/** 1週分の集計値(体重・食事)。週の切り出し・集計は呼び出し側(src/db/weeklyReview.ts)で行う */
export interface WeeklyNutritionSummary {
  /** 食事記録がある日の平均摂取kcal(記録が無い週はnull) */
  avgIntakeKcal: number | null;
  /** 食事記録がある日数(0〜7) */
  mealRecordedDays: number;
  /** 体重記録の件数 */
  weightCount: number;
  /** 週平均体重(記録が無い週はnull) */
  weekAvgKg: number | null;
}

/** 体重記録の週平均(kg)。記録が無ければnull */
export function averageWeightKg(weights: { weightKg: number }[]): number | null {
  if (weights.length === 0) return null;
  return weights.reduce((sum, w) => sum + w.weightKg, 0) / weights.length;
}

/**
 * 1週分の実測TDEE(kcal/日)。有効週の条件を満たさない週はnull:
 * 食事記録が5日以上、かつ当該週・前週の両方に体重記録が2件以上あること。
 */
export function weeklyMeasuredTdee(
  week: WeeklyNutritionSummary,
  prevWeek: Pick<WeeklyNutritionSummary, "weightCount" | "weekAvgKg">,
): number | null {
  if (week.mealRecordedDays < TDEE_MIN_MEAL_RECORDED_DAYS) return null;
  if (week.weightCount < TDEE_MIN_WEIGHT_RECORDS || prevWeek.weightCount < TDEE_MIN_WEIGHT_RECORDS) return null;
  if (week.avgIntakeKcal === null || week.weekAvgKg === null || prevWeek.weekAvgKg === null) return null;

  const weeklyChangeKg = week.weekAvgKg - prevWeek.weekAvgKg;
  return Math.round(week.avgIntakeKcal - (weeklyChangeKg * KCAL_PER_KG) / 7);
}

/**
 * 「現在の実測TDEE」= 直近の有効週 最大3週の平均(kcal/日)。
 * 入力は古い週→新しい週の順の週次TDEE(無効週はnull)。有効週が1つも無ければnull(データ蓄積中)。
 */
export function smoothedMeasuredTdee(weeklyTdeesOldestFirst: (number | null)[]): number | null {
  const valid = weeklyTdeesOldestFirst.filter((tdee): tdee is number => tdee !== null);
  if (valid.length === 0) return null;
  const recent = valid.slice(-TDEE_SMOOTHING_WEEKS);
  return Math.round(recent.reduce((sum, tdee) => sum + tdee, 0) / recent.length);
}
