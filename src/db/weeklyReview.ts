import { db } from "./db";
import { getActivityRecordsByDateRange } from "./activityRecords";
import { getBloodPressureRecordsByDateRange } from "./bloodPressureRecords";
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
import { ACTIVITY_BASELINE_WEEKS, buildWeeklyDigest } from "@/lib/weeklyDigest";
import { projectWeightAtDate } from "@/lib/weightProjection";
import type { WeeklyDigest } from "@/types";

/**
 * 指定週(月曜起点)のWeeklyDigestを組み立てる(Issue #45)。
 * レコードの取得だけをここで行い、集計・フラグ判定はsrc/lib/weeklyDigest.tsの純関数に委ねる。
 * todayは残り日数・連続記録日数の基準日(テストからの注入用。通常は省略する)。
 */
export async function getWeeklyDigest(weekStart: string, today: string = todayDateString()): Promise<WeeklyDigest> {
  const weekEnd = addDaysToDateString(weekStart, 6);
  const prevWeekStart = addDaysToDateString(weekStart, -7);
  // 活動量低下の判定(Issue #174)に使う比較基準の期間。当該週の直前ACTIVITY_BASELINE_WEEKS週
  const baselineStart = addDaysToDateString(weekStart, -7 * ACTIVITY_BASELINE_WEEKS);
  const baselineEnd = addDaysToDateString(weekStart, -1);

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
    bloodPressureRecords,
    firstWeight,
    latestWeight,
    baselineWeight,
    baselineActivityRecords,
    baselineWorkoutRecords,
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
    getBloodPressureRecordsByDateRange(weekStart, weekEnd),
    db.weightRecords.orderBy("date").first(),
    db.weightRecords.orderBy("date").last(),
    settings.baselineDate ? getWeightRecord(settings.baselineDate) : Promise.resolve(undefined),
    getActivityRecordsByDateRange(baselineStart, baselineEnd),
    getWorkoutRecordsByDateRange(baselineStart, baselineEnd),
  ]);

  // 直近4週を週単位(月曜起点)に畳んで比較基準にする(Issue #174)。
  // **記録の無い週も落とさずそのまま渡す** — 筋トレ日数の平均はこの配列の長さを分母にするため、
  // 「やらなかった週」を間引くと平均が実態より高く出て、通常の休養週でWORKOUT_STOPPEDが誤発火する。
  // 歩数が無いだけの週は純関数側の品質ゲートで基準から外れる
  const prevWeeksActivity = Array.from({ length: ACTIVITY_BASELINE_WEEKS }, (_, i) => {
    const start = addDaysToDateString(weekStart, -7 * (ACTIVITY_BASELINE_WEEKS - i));
    const end = addDaysToDateString(start, 6);
    const inWeek = <T extends { date: string }>(rs: T[]) => rs.filter((r) => r.date >= start && r.date <= end);
    // Garmin連携は歩数が取れなかった日も行を書くため、行数ではなく歩数の値がある日数で数える
    const stepDays = inWeek(baselineActivityRecords)
      .map((r) => r.steps)
      .filter((s): s is number => s !== undefined);
    return {
      avgSteps:
        stepDays.length > 0 ? Math.round(stepDays.reduce((s, v) => s + v, 0) / stepDays.length) : null,
      stepsRecordedDays: stepDays.length,
      workoutDays: new Set(inWeek(baselineWorkoutRecords).map((r) => r.date)).size,
    };
  });

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
  // 目標日が未設定(Issue #217)なら予測しない
  const projectionStart = baselineWeight ?? firstWeight;
  const projectedKg =
    projectionStart && latestWeight && settings.goalDate
      ? projectWeightAtDate(
          { date: projectionStart.date, weightKg: projectionStart.weightKg },
          { date: latestWeight.date, weightKg: latestWeight.weightKg },
          settings.goalDate,
        )
      : null;

  return buildWeeklyDigest({
    weekStart,
    today,
    // 未設定はnullのまま純関数へ渡す(ダミー値を被せない。Issue #217)
    goalWeightKg: settings.goalWeightKg ?? null,
    goalDate: settings.goalDate ?? null,
    calorieTargetKcal: settings.dailyCalorieTarget ?? null,
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
    prevWeeksActivity,
    workoutSets: workoutRecords.map((r) => ({ date: r.date, exerciseName: r.exerciseName })),
    waterDailyTotals,
    waterTargetMl: settings.dailyWaterTargetMl ?? null,
    bloodPressureDays: bloodPressureRecords.map((r) => ({ systolic: r.systolic, diastolic: r.diastolic })),
    // 日記本文はオプトイン(Issue #103)がONの週だけAI入力(digest)へ含める(AIコンサルティング設計書7章)
    diaryTexts: settings.sendDiaryTextToAi
      ? diaries.map((d) => ({ date: d.date, text: d.text }))
      : null,
  });
}
