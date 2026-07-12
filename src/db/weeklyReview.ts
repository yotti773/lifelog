import { db } from "./db";
import { getActivityRecordsByDateRange } from "./activityRecords";
import { getDiaryRecordsByDateRange } from "./diaryRecords";
import { getRecordedDateSet } from "./recordedDays";
import { getSettings } from "./settings";
import { getDailyWaterTotals } from "./waterRecords";
import { getWeightRecord, getWeightRecordsByDateRange } from "./weightRecords";
import { getMealDailyTotalsForWeek, getMeasuredTdeeAsOfWeek } from "./weeklyNutrition";
import { getWorkoutRecordsByDateRange } from "./workoutRecords";
import { addDaysToDateString, todayDateString } from "@/lib/date";
import { calcBmr } from "@/lib/nutritionCalc";
import { countRecordedDaysInRange, currentStreakDays } from "@/lib/recording";
import { buildWeeklyDigest } from "@/lib/weeklyDigest";
import { projectWeightAtDate } from "@/lib/weightProjection";
import type { DiaryMood, WeeklyDigest } from "@/types";

/**
 * 指定週(月曜起点)のWeeklyDigestを組み立てる(Issue #45)。
 * レコードの取得だけをここで行い、集計・フラグ判定はsrc/lib/weeklyDigest.tsの純関数に委ねる。
 * todayは残り日数・連続記録日数の基準日(テストからの注入用。通常は省略する)。
 */
export async function getWeeklyDigest(weekStart: string, today: string = todayDateString()): Promise<WeeklyDigest> {
  const weekEnd = addDaysToDateString(weekStart, 6);
  const prevWeekStart = addDaysToDateString(weekStart, -7);

  const settings = await getSettings();
  const [
    weekWeights,
    prevWeekWeights,
    mealDailyTotals,
    estimatedTdeeKcal,
    recordedDates,
    diaries,
    activityRecords,
    workoutRecords,
    waterDailyTotals,
    firstWeight,
    latestWeight,
    baselineWeight,
  ] = await Promise.all([
    getWeightRecordsByDateRange(weekStart, weekEnd),
    getWeightRecordsByDateRange(prevWeekStart, addDaysToDateString(weekStart, -1)),
    getMealDailyTotalsForWeek(weekStart),
    getMeasuredTdeeAsOfWeek(weekStart),
    getRecordedDateSet(),
    getDiaryRecordsByDateRange(weekStart, weekEnd),
    getActivityRecordsByDateRange(weekStart, weekEnd),
    getWorkoutRecordsByDateRange(weekStart, weekEnd),
    getDailyWaterTotals(weekStart, weekEnd),
    db.weightRecords.orderBy("date").first(),
    db.weightRecords.orderBy("date").last(),
    settings.baselineDate ? getWeightRecord(settings.baselineDate) : Promise.resolve(undefined),
  ]);

  // 基礎代謝は身体プロフィール(Issue #43)と直近体重が揃っているときのみ計算できる
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

  // 着地予測は推移画面と同じ計算(起点=基準日の記録、なければ最古の記録。Issue #25)
  const projectionStart = baselineWeight ?? firstWeight;
  const projectedKg =
    projectionStart && latestWeight
      ? projectWeightAtDate(
          { date: projectionStart.date, weightKg: projectionStart.weightKg },
          { date: latestWeight.date, weightKg: latestWeight.weightKg },
          settings.goalDate,
        )
      : null;

  return buildWeeklyDigest({
    weekStart,
    today,
    goalWeightKg: settings.goalWeightKg,
    goalDate: settings.goalDate,
    calorieTargetKcal: settings.dailyCalorieTarget,
    pfcTargets:
      settings.dailyProteinTargetG !== undefined &&
      settings.dailyFatTargetG !== undefined &&
      settings.dailyCarbsTargetG !== undefined
        ? {
            proteinG: settings.dailyProteinTargetG,
            fatG: settings.dailyFatTargetG,
            carbsG: settings.dailyCarbsTargetG,
          }
        : null,
    bmrKcal,
    weekWeights,
    prevWeekWeights,
    latestWeightKg: latestWeight?.weightKg ?? null,
    mealDailyTotals,
    recordedDays: countRecordedDaysInRange(recordedDates, weekStart, weekEnd),
    currentStreakDays: currentStreakDays(recordedDates, today),
    estimatedTdeeKcal,
    projectedKg,
    moods: diaries.map((d) => d.mood).filter((mood): mood is DiaryMood => mood !== undefined),
    activityDays: activityRecords.map((r) => ({
      ...(r.steps !== undefined && { steps: r.steps }),
      ...(r.totalKcal !== undefined && { totalKcal: r.totalKcal }),
      ...(r.sleepMinutes !== undefined && { sleepMinutes: r.sleepMinutes }),
    })),
    workoutSets: workoutRecords.map((r) => ({ date: r.date, exerciseName: r.exerciseName })),
    waterDailyTotals,
    waterTargetMl: settings.dailyWaterTargetMl ?? null,
    // 日記本文はオプトイン(Issue #103)がONの週だけAI入力(digest)へ含める(AIコンサルティング設計書7章)
    diaryTexts: settings.sendDiaryTextToAi
      ? diaries.map((d) => ({ date: d.date, text: d.text }))
      : null,
  });
}
