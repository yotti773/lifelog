import { addDaysToDateString, daysBetween } from "./date";
import { weeklyMeasuredTdee, type WeeklyNutritionSummary } from "./tdee";
import { buildCrossAnalysis, type DigestMealDailyTotal, type WeeklyDigestSource } from "./weeklyDigest";
import type { DigestFlag, MonthlyDigest } from "@/types";

/**
 * MonthlyDigestの生成(Issue #114)。週次(src/lib/weeklyDigest.ts)と同じ方針で、
 * 数値の計算・集計・フラグ判定はすべてここで決定論的に行い、AIには計算済みの事実の解釈だけをさせる。
 * 月次レビュー画面もこの値をそのまま表示する(画面とAIが同じ事実を見る)。
 * 月の定義は「その月に日曜が含まれる月曜始まりの週の集合」(src/lib/date.tsのweekStartsOfMonth)。
 */

/** LOW_RECORDING_RATE: 記録した日の割合がこの値未満の月は記録率低下とみなす(週次の5/7日と同じ比率) */
export const MONTHLY_LOW_RECORDING_RATIO = 5 / 7;
/** INSUFFICIENT_DATA: 記録した日がこの日数未満の月は評価に適さないとみなす(1週間分未満) */
export const MONTHLY_INSUFFICIENT_DATA_THRESHOLD_DAYS = 7;

export interface MonthlyDigestSource {
  month: string; // YYYY-MM
  /** 月内の週の開始日(月曜)の昇順一覧(weekStartsOfMonth(month)と同値) */
  weekStarts: string[];
  /**
   * 月内各週とその前週の週次集計。長さはweekStarts.length + 1で、
   * index 0が月の直前週(週次TDEE逆算の比較用)、index i+1がweekStarts[i]の週
   */
  weekSummaries: WeeklyNutritionSummary[];
  today: string;
  goalWeightKg: number;
  goalDate: string;
  calorieTargetKcal: number;
  bmrKcal: number | null;
  /** 全期間の最新体重。月内に記録が無くても必要ペースを計算できるようにするためのフォールバック */
  latestWeightKg: number | null;
  /** 月内全日の食事の日別合計(食事記録がある日のみ) */
  mealDailyTotals: DigestMealDailyTotal[];
  /** 「記録した日」(食事1件以上または体重記録あり)の月内日数 */
  recordedDays: number;
  diaryDays: WeeklyDigestSource["diaryDays"];
  activityDays: WeeklyDigestSource["activityDays"];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildMonthlyDigest(src: MonthlyDigestSource): MonthlyDigest {
  const periodStart = src.weekStarts[0];
  const periodEnd = addDaysToDateString(src.weekStarts[src.weekStarts.length - 1], 6);
  const totalDays = src.weekStarts.length * 7;
  const remainingDays = Math.max(0, daysBetween(src.today, src.goalDate));
  // 記録率の判定に使う「これまでに経過した日数」。進行中の当月は月全体ではなくtodayまでの経過日数で測る
  // (月の序盤に毎日記録していても「7割未満=記録不足」と誤判定しないため)。完了済みの月では総日数と一致する
  const elapsedDays = Math.min(totalDays, Math.max(0, daysBetween(periodStart, src.today) + 1));

  // 週平均体重・週平均摂取の系列(グラフとペース計算の元)。index 0の前週分は含めない
  const weeks = src.weekStarts.map((weekStart, i) => {
    const summary = src.weekSummaries[i + 1];
    return {
      weekStart,
      weekAvgKg: summary.weekAvgKg !== null ? round2(summary.weekAvgKg) : null,
      avgIntakeKcal: summary.avgIntakeKcal !== null ? Math.round(summary.avgIntakeKcal) : null,
    };
  });

  // 月間の変化・ペースは「記録がある最初の週」と「記録がある最後の週」の週平均同士で比較する
  // (端の週に記録が無くても、その間の週数差で割ることでペースの意味を保つ)
  const weeksWithData = weeks.filter((w) => w.weekAvgKg !== null);
  const startWeek = weeksWithData[0] ?? null;
  const endWeek = weeksWithData.length > 1 ? weeksWithData[weeksWithData.length - 1] : null;
  const startWeekAvgKg = startWeek?.weekAvgKg ?? null;
  const endWeekAvgKg = endWeek?.weekAvgKg ?? startWeekAvgKg;
  const spanWeeks =
    startWeek !== null && endWeek !== null ? daysBetween(startWeek.weekStart, endWeek.weekStart) / 7 : 0;
  const monthlyChangeKg =
    startWeekAvgKg !== null && endWeek !== null ? round2(endWeek.weekAvgKg! - startWeekAvgKg) : null;
  const avgWeeklyPaceKg =
    monthlyChangeKg !== null && spanWeeks > 0 ? round2(monthlyChangeKg / spanWeeks) : null;

  // 必要ペース(kg/週)。週次と同じ計算(基準体重が無い・目標日超過なら0。フラグ側で状況を伝える)
  const paceBaseKg = endWeekAvgKg ?? src.latestWeightKg;
  const requiredWeeklyPaceKg =
    remainingDays > 0 && paceBaseKg !== null
      ? round2(-(((paceBaseKg - src.goalWeightKg) / remainingDays) * 7))
      : 0;

  // マイルストーン: 今月の平均ペースを維持した場合の目標日時点の見込み体重
  const projectedAtGoalDateKg =
    avgWeeklyPaceKg !== null && endWeekAvgKg !== null && remainingDays > 0
      ? round2(endWeekAvgKg + (avgWeeklyPaceKg * remainingDays) / 7)
      : null;

  // カロリー: 月内の食事記録がある日の平均
  const mealDays = src.mealDailyTotals.length;
  const avgIntakeKcal =
    mealDays > 0 ? Math.round(src.mealDailyTotals.reduce((s, d) => s + d.kcal, 0) / mealDays) : null;

  // 月窓の実測TDEE: 月内の全有効週の週次逆算値の平均(週次の「直近3週」より窓が広く安定する)
  const weeklyTdees = src.weekSummaries
    .slice(1)
    .map((summary, i) => weeklyMeasuredTdee(summary, src.weekSummaries[i]))
    .filter((tdee): tdee is number => tdee !== null);
  const monthlyTdeeKcal =
    weeklyTdees.length > 0 ? Math.round(weeklyTdees.reduce((s, v) => s + v, 0) / weeklyTdees.length) : null;

  const crossAnalysis = buildCrossAnalysis({
    periodStart,
    periodEnd,
    mealDailyTotals: src.mealDailyTotals,
    diaryDays: src.diaryDays,
    activityDays: src.activityDays,
  });

  // フラグは週次と同じ語彙(DigestFlag)を月窓の閾値で判定する
  const flags: DigestFlag[] = [];
  if (
    avgWeeklyPaceKg !== null &&
    endWeekAvgKg !== null &&
    avgWeeklyPaceKg < 0 &&
    -avgWeeklyPaceKg > endWeekAvgKg * 0.01
  ) {
    flags.push("PACE_TOO_AGGRESSIVE");
  }
  if (avgIntakeKcal !== null && src.bmrKcal !== null && avgIntakeKcal < src.bmrKcal) {
    flags.push("INTAKE_BELOW_BMR");
  }
  if (projectedAtGoalDateKg !== null && projectedAtGoalDateKg > src.goalWeightKg) {
    flags.push("BEHIND_PACE");
  }
  // 記録率は経過日数(進行中の当月はtodayまで)に対する割合で判定する。総日数で測ると当月の序盤で常に立つため
  if (src.recordedDays < elapsedDays * MONTHLY_LOW_RECORDING_RATIO) {
    flags.push("LOW_RECORDING_RATE");
  }
  if (weeksWithData.length === 0) {
    flags.push("NO_WEIGHT_DATA");
  }
  if (src.recordedDays < MONTHLY_INSUFFICIENT_DATA_THRESHOLD_DAYS) {
    flags.push("INSUFFICIENT_DATA");
  }

  return {
    month: src.month,
    period: { start: periodStart, end: periodEnd },
    goal: {
      targetWeightKg: src.goalWeightKg,
      targetDate: src.goalDate,
      remainingDays,
    },
    weeks,
    weight: {
      startWeekAvgKg,
      endWeekAvgKg,
      monthlyChangeKg,
      avgWeeklyPaceKg,
      requiredWeeklyPaceKg,
      projectedAtGoalDateKg,
      weeksWithData: weeksWithData.length,
    },
    calories: {
      avgIntakeKcal,
      targetKcal: src.calorieTargetKcal,
      daysOnTarget: src.mealDailyTotals.filter((d) => d.kcal <= src.calorieTargetKcal).length,
      recordedDays: mealDays,
      monthlyTdeeKcal,
      tdeeValidWeeks: weeklyTdees.length,
      tdeeMinKcal: weeklyTdees.length > 0 ? Math.min(...weeklyTdees) : null,
      tdeeMaxKcal: weeklyTdees.length > 0 ? Math.max(...weeklyTdees) : null,
      bmrKcal: src.bmrKcal,
    },
    recording: {
      recordedDays: src.recordedDays,
      totalDays,
    },
    flags,
    ...(crossAnalysis !== undefined ? { crossAnalysis } : {}),
  };
}
