import { getMealRecordsByDateRange } from "./mealRecords";
import { getWeightRecordsByDateRange } from "./weightRecords";
import { addDaysToDateString, formatDate } from "@/lib/date";
import {
  averageWeightKg,
  smoothedMeasuredTdee,
  weeklyMeasuredTdee,
  type WeeklyNutritionSummary,
} from "@/lib/tdee";

/**
 * 週次(月曜〜日曜)の栄養・体重集計と実測TDEE(Issue #44)のDB向けオーケストレータ。
 * 計算そのものはsrc/lib/tdee.tsの純関数で行い、ここではレコードの取得と週への切り出しだけを担う。
 */

/** 実測TDEEの平滑化対象を探す週数。表示週を含む直近この週数の中から有効週(最大3週)を拾う */
export const TDEE_LOOKBACK_WEEKS = 6;

export interface MealDailyTotal {
  date: string; // YYYY-MM-DD
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

/** 指定週の食事の日別合計(食事記録がある日のみ。日付昇順) */
export async function getMealDailyTotalsForWeek(weekStart: string): Promise<MealDailyTotal[]> {
  const weekEnd = addDaysToDateString(weekStart, 6);
  const records = await getMealRecordsByDateRange(weekStart, weekEnd);

  const byDate = new Map<string, MealDailyTotal>();
  for (const record of records) {
    const date = formatDate(new Date(record.timestamp));
    const total = byDate.get(date) ?? { date, kcal: 0, proteinG: 0, fatG: 0, carbsG: 0 };
    total.kcal += record.confirmedKcal;
    total.proteinG += record.confirmedProteinG;
    total.fatG += record.confirmedFatG;
    total.carbsG += record.confirmedCarbsG;
    byDate.set(date, total);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** 指定週のWeeklyNutritionSummary(実測TDEE計算の入力)を集計する */
export async function getWeeklyNutritionSummary(weekStart: string): Promise<WeeklyNutritionSummary> {
  const weekEnd = addDaysToDateString(weekStart, 6);
  const [weights, dailyTotals] = await Promise.all([
    getWeightRecordsByDateRange(weekStart, weekEnd),
    getMealDailyTotalsForWeek(weekStart),
  ]);

  const avgIntakeKcal =
    dailyTotals.length > 0
      ? dailyTotals.reduce((sum, day) => sum + day.kcal, 0) / dailyTotals.length
      : null;

  return {
    avgIntakeKcal,
    mealRecordedDays: dailyTotals.length,
    weightCount: weights.length,
    weekAvgKg: averageWeightKg(weights),
  };
}

/**
 * 指定週の時点の「現在の実測TDEE」(kcal/日)。
 * 表示週を含む直近TDEE_LOOKBACK_WEEKS週を対象に週次TDEEを逆算し、有効週(最大3週)を平滑化する。
 * 有効週が1つも無ければnull(データ蓄積中)。
 */
export async function getMeasuredTdeeAsOfWeek(weekStart: string): Promise<number | null> {
  // 最古の候補週の前週も体重平均の比較に必要なため、+1週分さかのぼって集計する
  const summaries = await Promise.all(
    Array.from({ length: TDEE_LOOKBACK_WEEKS + 1 }, (_, i) =>
      getWeeklyNutritionSummary(addDaysToDateString(weekStart, -7 * (TDEE_LOOKBACK_WEEKS - i))),
    ),
  );

  const weeklyTdees = summaries
    .slice(1)
    .map((summary, i) => weeklyMeasuredTdee(summary, summaries[i]));
  return smoothedMeasuredTdee(weeklyTdees);
}
