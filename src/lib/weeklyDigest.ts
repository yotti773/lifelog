import { addDaysToDateString, daysBetween } from "./date";
import { averageWeightKg } from "./tdee";
import type { DiaryMood, DigestFlag, WeeklyDigest } from "@/types";

/**
 * WeeklyDigestの生成(Issue #45。AIコンサルティング設計書3章)。
 * 数値の計算・集計・安全判定はすべてここで決定論的に行い、AIには計算済みの事実の解釈だけをさせる。
 * 週次レビュー画面もこの値をそのまま表示する(画面とAIが同じ事実を見る)。
 */

/** LOW_RECORDING_RATE: 記録した日がこの日数未満の週は記録率低下とみなす */
export const LOW_RECORDING_THRESHOLD_DAYS = 5;
/** INSUFFICIENT_DATA: 記録した日がこの日数未満の週は評価に適さないとみなす(利用開始直後など) */
export const INSUFFICIENT_DATA_THRESHOLD_DAYS = 2;

/** 食事の日別合計(食事記録がある日のみ)。src/db/weeklyNutrition.tsのMealDailyTotalと同形 */
export interface DigestMealDailyTotal {
  date: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface WeeklyDigestSource {
  weekStart: string; // 月曜(YYYY-MM-DD)
  today: string;
  goalWeightKg: number;
  goalDate: string;
  calorieTargetKcal: number;
  pfcTargets: { proteinG: number; fatG: number; carbsG: number } | null;
  bmrKcal: number | null;
  weekWeights: { weightKg: number }[];
  prevWeekWeights: { weightKg: number }[];
  /** 全期間の最新体重。週内に記録が無くても必要ペースを計算できるようにするためのフォールバック */
  latestWeightKg: number | null;
  mealDailyTotals: DigestMealDailyTotal[];
  /** 「記録した日」(食事1件以上または体重記録あり)の週内日数(Issue #46) */
  recordedDays: number;
  currentStreakDays: number;
  /** 実測TDEE(Issue #44)。有効週が無い間はnull */
  estimatedTdeeKcal: number | null;
  /** 現在ペースでの着地予測(Issue #25の線形予測)。予測できない場合はnull */
  projectedKg: number | null;
  /** 週内の日記の気分タグ(本文は含めない。AIコンサルティング設計書7章) */
  moods: DiaryMood[];
  /** 週内のGarmin活動記録(Issue #82)。1日1件。項目ごとに欠測しうる */
  activityDays: { steps?: number; totalKcal?: number; sleepMinutes?: number }[];
  /** 週内の筋トレ記録(1セット=1件。Issue #103) */
  workoutSets: { date: string; exerciseName: string }[];
  /** 週内の日別水分合計(記録の無い日は0mlで埋まっていてよい。Issue #103) */
  waterDailyTotals: { date: string; amountMl: number }[];
  waterTargetMl: number | null;
  /**
   * AIに読ませる週内の日記本文(Issue #103)。オプトイン(Settings.sendDiaryTextToAi)がOFFの週はnullを渡し、
   * digestのdiaryEntriesを省略する(本文はデフォルトで外部AIに送らない。AIコンサルティング設計書7章)
   */
  diaryTexts: { date: string; text: string }[] | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 気分タグ(5段階)をdigestの3区分に集計する:
 * 絶好調・良い → good / 普通 → normal / 眠い・不調 → bad
 */
/**
 * Garmin活動記録の週サマリーを集計する(Issue #82)。
 * 各平均は「その項目のデータがある日」の平均(時計を着けなかった日などの欠測日は分母に入れない)。
 * 活動記録が1日も無い週はundefined(digestからactivityを省く。moodと同じ扱い)
 */
export function aggregateActivity(
  activityDays: WeeklyDigestSource["activityDays"],
): WeeklyDigest["activity"] | undefined {
  if (activityDays.length === 0) return undefined;
  const avgOf = (pick: (d: WeeklyDigestSource["activityDays"][number]) => number | undefined) => {
    const values = activityDays.map(pick).filter((v): v is number => v !== undefined);
    return values.length > 0 ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null;
  };
  return {
    avgSteps: avgOf((d) => d.steps),
    avgTotalKcal: avgOf((d) => d.totalKcal),
    avgSleepMinutes: avgOf((d) => d.sleepMinutes),
    recordedDays: activityDays.length,
  };
}

/** 筋トレの週サマリーを集計する(Issue #103)。記録が無い週はundefined(digestからworkoutを省く) */
export function aggregateWorkout(
  workoutSets: WeeklyDigestSource["workoutSets"],
): WeeklyDigest["workout"] | undefined {
  if (workoutSets.length === 0) return undefined;
  return {
    activeDays: new Set(workoutSets.map((s) => s.date)).size,
    exerciseCount: new Set(workoutSets.map((s) => s.exerciseName)).size,
    totalSets: workoutSets.length,
  };
}

/**
 * 水分の週サマリーを集計する(Issue #103)。平均は「記録がある日」(合計が0mlでない日)の平均で、
 * 記録の無い日は分母に入れない(食事・活動の平均と同じ考え方)。記録が無い週はundefined
 */
export function aggregateWater(
  waterDailyTotals: WeeklyDigestSource["waterDailyTotals"],
  waterTargetMl: number | null,
): WeeklyDigest["water"] | undefined {
  const recorded = waterDailyTotals.filter((d) => d.amountMl > 0);
  if (recorded.length === 0) return undefined;
  return {
    avgIntakeMl: Math.round(recorded.reduce((s, d) => s + d.amountMl, 0) / recorded.length),
    targetMl: waterTargetMl,
    daysOnTarget: waterTargetMl !== null ? recorded.filter((d) => d.amountMl >= waterTargetMl).length : null,
    recordedDays: recorded.length,
  };
}

export function aggregateMoodCounts(moods: DiaryMood[]): { good: number; normal: number; bad: number } | undefined {
  if (moods.length === 0) return undefined;
  const counts = { good: 0, normal: 0, bad: 0 };
  for (const mood of moods) {
    if (mood === "great" || mood === "good") counts.good += 1;
    else if (mood === "ok") counts.normal += 1;
    else counts.bad += 1;
  }
  return counts;
}

export function buildWeeklyDigest(src: WeeklyDigestSource): WeeklyDigest {
  const weekEnd = addDaysToDateString(src.weekStart, 6);
  const remainingDays = Math.max(0, daysBetween(src.today, src.goalDate));

  // 体重: 週平均同士で比較する(単日比較は水分等のノイズが大きい)
  const weekAvgRaw = averageWeightKg(src.weekWeights);
  const prevWeekAvgRaw = averageWeightKg(src.prevWeekWeights);
  const weekAvgKg = weekAvgRaw !== null ? round2(weekAvgRaw) : null;
  const prevWeekAvgKg = prevWeekAvgRaw !== null ? round2(prevWeekAvgRaw) : null;
  const weeklyChangeKg =
    weekAvgRaw !== null && prevWeekAvgRaw !== null ? round2(weekAvgRaw - prevWeekAvgRaw) : null;

  // 必要ペース(kg/週)。減量が必要なら負の値。目標日超過・体重記録皆無の場合は0(フラグ側で状況を伝える)
  const paceBaseKg = weekAvgRaw ?? src.latestWeightKg;
  const requiredWeeklyPaceKg =
    remainingDays > 0 && paceBaseKg !== null
      ? round2(-(((paceBaseKg - src.goalWeightKg) / remainingDays) * 7))
      : 0;

  // カロリー・PFC: 食事記録がある日の平均
  const mealDays = src.mealDailyTotals.length;
  const avgIntakeKcal =
    mealDays > 0 ? Math.round(src.mealDailyTotals.reduce((s, d) => s + d.kcal, 0) / mealDays) : null;
  const avgOf = (pick: (d: DigestMealDailyTotal) => number) =>
    mealDays > 0 ? round1(src.mealDailyTotals.reduce((s, d) => s + pick(d), 0) / mealDays) : null;

  const mood = aggregateMoodCounts(src.moods);
  const activity = aggregateActivity(src.activityDays);
  const workout = aggregateWorkout(src.workoutSets);
  const water = aggregateWater(src.waterDailyTotals, src.waterTargetMl);
  // 本文が空の日記(気分タグのみの記録)はAIに読ませる意味が無いので除く
  const diaryEntries = src.diaryTexts?.filter((d) => d.text.trim() !== "") ?? null;

  const flags: DigestFlag[] = [];
  if (
    weeklyChangeKg !== null &&
    weekAvgRaw !== null &&
    weeklyChangeKg < 0 &&
    -weeklyChangeKg > weekAvgRaw * 0.01
  ) {
    flags.push("PACE_TOO_AGGRESSIVE");
  }
  if (avgIntakeKcal !== null && src.bmrKcal !== null && avgIntakeKcal < src.bmrKcal) {
    flags.push("INTAKE_BELOW_BMR");
  }
  if (src.projectedKg !== null && src.projectedKg > src.goalWeightKg) {
    flags.push("BEHIND_PACE");
  }
  if (src.recordedDays < LOW_RECORDING_THRESHOLD_DAYS) {
    flags.push("LOW_RECORDING_RATE");
  }
  if (src.weekWeights.length === 0) {
    flags.push("NO_WEIGHT_DATA");
  }
  if (src.recordedDays < INSUFFICIENT_DATA_THRESHOLD_DAYS) {
    flags.push("INSUFFICIENT_DATA");
  }

  return {
    period: { start: src.weekStart, end: weekEnd },
    goal: {
      targetWeightKg: src.goalWeightKg,
      targetDate: src.goalDate,
      remainingDays,
    },
    weight: {
      weekAvgKg,
      prevWeekAvgKg,
      weeklyChangeKg,
      projectedKg: src.projectedKg !== null ? round2(src.projectedKg) : null,
      requiredWeeklyPaceKg,
      paceBaseKg: paceBaseKg !== null ? round2(paceBaseKg) : null,
    },
    calories: {
      avgIntakeKcal,
      targetKcal: src.calorieTargetKcal,
      daysOnTarget: src.mealDailyTotals.filter((d) => d.kcal <= src.calorieTargetKcal).length,
      recordedDays: mealDays,
      estimatedTdeeKcal: src.estimatedTdeeKcal,
      bmrKcal: src.bmrKcal,
    },
    pfc: {
      avgProteinG: avgOf((d) => d.proteinG),
      avgFatG: avgOf((d) => d.fatG),
      avgCarbsG: avgOf((d) => d.carbsG),
      targetProteinG: src.pfcTargets?.proteinG ?? null,
      targetFatG: src.pfcTargets?.fatG ?? null,
      targetCarbsG: src.pfcTargets?.carbsG ?? null,
    },
    recording: {
      recordedDays: src.recordedDays,
      currentStreakDays: src.currentStreakDays,
    },
    flags,
    ...(mood !== undefined ? { mood } : {}),
    ...(activity !== undefined ? { activity } : {}),
    ...(workout !== undefined ? { workout } : {}),
    ...(water !== undefined ? { water } : {}),
    ...(diaryEntries !== null && diaryEntries.length > 0 ? { diaryEntries } : {}),
  };
}
