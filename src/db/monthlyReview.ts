import { db } from "./db";
import { getActivityRecordsByDateRange } from "./activityRecords";
import { getBloodPressureRecordsByDateRange } from "./bloodPressureRecords";
import { getDiaryRecordsByDateRange } from "./diaryRecords";
import { getRecordedDateSet } from "./recordedDays";
import { getSettings } from "./settings";
import { getMealDailyTotals, getWeeklyNutritionSummary } from "./weeklyNutrition";
import { addDaysToDateString, todayDateString, weekStartsOfMonth } from "@/lib/date";
import { buildMonthlyDigest } from "@/lib/monthlyDigest";
import { calcBmr } from "@/lib/nutritionCalc";
import { countRecordedDaysInRange } from "@/lib/recording";
import type { MonthlyDigest } from "@/types";

/**
 * 指定月のMonthlyDigestを組み立てる(Issue #114)。
 * 週次(src/db/weeklyReview.ts)と同じ分担: レコードの取得だけをここで行い、
 * 集計・フラグ判定はsrc/lib/monthlyDigest.tsの純関数に委ねる。
 * monthはYYYY-MMで、月の範囲は「その月に日曜が含まれる週」(weekStartsOfMonth)。
 * todayは残り日数の基準日(テストからの注入用。通常は省略する)。
 */
export async function getMonthlyDigest(month: string, today: string = todayDateString()): Promise<MonthlyDigest> {
  const weekStarts = weekStartsOfMonth(month);
  const periodStart = weekStarts[0];
  const periodEnd = addDaysToDateString(weekStarts[weekStarts.length - 1], 6);

  const settings = await getSettings();
  const [weekSummaries, mealDailyTotals, recordedDates, diaries, activityRecords, bloodPressureRecords, latestWeight] =
    await Promise.all([
      // index 0は月の直前週(週次TDEE逆算の比較用)、以降が月内の各週
      Promise.all(
        [addDaysToDateString(periodStart, -7), ...weekStarts].map((weekStart) =>
          getWeeklyNutritionSummary(weekStart),
        ),
      ),
      getMealDailyTotals(periodStart, periodEnd),
      getRecordedDateSet(),
      getDiaryRecordsByDateRange(periodStart, periodEnd),
      getActivityRecordsByDateRange(periodStart, periodEnd),
      getBloodPressureRecordsByDateRange(periodStart, periodEnd),
      db.weightRecords.orderBy("date").last(),
    ]);

  // 基礎代謝は身体プロフィール(Issue #43)と直近体重が揃っているときのみ計算できる(週次と同じ)
  const bmrKcal =
    settings.heightCm !== undefined &&
    settings.birthYear !== undefined &&
    settings.sex !== undefined &&
    latestWeight
      ? calcBmr(
          { heightCm: settings.heightCm, birthYear: settings.birthYear, sex: settings.sex },
          latestWeight.weightKg,
          today,
        )
      : null;

  return buildMonthlyDigest({
    month,
    weekStarts,
    weekSummaries,
    today,
    goalWeightKg: settings.goalWeightKg,
    goalDate: settings.goalDate,
    calorieTargetKcal: settings.dailyCalorieTarget,
    bmrKcal,
    latestWeightKg: latestWeight?.weightKg ?? null,
    mealDailyTotals,
    recordedDays: countRecordedDaysInRange(recordedDates, periodStart, periodEnd),
    diaryDays: diaries.map((d) => ({
      date: d.date,
      ...(d.mood !== undefined && { mood: d.mood }),
      ...(d.alcohol !== undefined && { alcohol: d.alcohol }),
    })),
    activityDays: activityRecords.map((r) => ({
      date: r.date,
      ...(r.steps !== undefined && { steps: r.steps }),
      ...(r.totalKcal !== undefined && { totalKcal: r.totalKcal }),
      ...(r.sleepMinutes !== undefined && { sleepMinutes: r.sleepMinutes }),
    })),
    bloodPressureDays: bloodPressureRecords.map((r) => ({ systolic: r.systolic, diastolic: r.diastolic })),
  });
}
