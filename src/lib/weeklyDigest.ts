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
/**
 * 家庭血圧の高値の目安(Issue #117)。高血圧治療ガイドラインの家庭血圧135/85mmHgを閾値に使うが、
 * アプリは医療機器ではないため「この値以上の日が何日」という事実の提示にのみ使い、医学的判断はしない。
 */
export const HOME_BP_HIGH_SYSTOLIC = 135;
export const HOME_BP_HIGH_DIASTOLIC = 85;
/** INSUFFICIENT_DATA: 記録した日がこの日数未満の週は評価に適さないとみなす(利用開始直後など) */
export const INSUFFICIENT_DATA_THRESHOLD_DAYS = 2;

/**
 * 活動量低下の検知(Issue #174)の閾値。実測TDEEが落ちたとき、原因が摂取ではなく消費側にあることを
 * 事実として示すために使う。数字は運用しながら調整する前提の初期値。
 */
/**
 * 歩数の比較対象にする週の条件: **歩数の値がある日**がこの日数以上ある週
 * (LOW_RECORDING_THRESHOLD_DAYSと同じデータ品質の考え方)。
 * Garmin連携のcronは歩数が取れなかった日も空欄の行を書くため、活動記録の「行数」ではなく
 * 歩数が入っている日数で数えないとゲートが機能しない(scripts/garmin/garmin_to_sheet.py)
 */
export const ACTIVITY_MIN_RECORDED_DAYS = 5;
/** 歩数・筋トレの比較基準に使う過去週の最大数(当該週は含まない) */
export const ACTIVITY_BASELINE_WEEKS = 4;
/** 比較基準が揃ったとみなす過去週の最小数。これ未満なら判定しない(利用開始直後の誤検知を防ぐ) */
export const ACTIVITY_BASELINE_MIN_WEEKS = 2;
/** ACTIVITY_DROP: 週平均歩数が基準をこの割合以上下回ったら低下とみなす */
export const ACTIVITY_DROP_RATIO = 0.2;

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
  goalWeightKg: number; // 減量目標。未設定時はダミー値(0)を渡す(呼び出し側で対応)
  goalDate: string; // 目標日。未設定時はダミー値("1900-01-01")を渡す
  calorieTargetKcal: number; // 目標カロリー。未設定時はダミー値(1)を渡す(0で除算を避けるため)
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
  /**
   * 週内の日記の記録(本文は含めない。AIコンサルティング設計書7章)。1日1件。
   * dateは気分・飲酒×摂取カロリーのクロス分析(Issue #112)で食事の日別合計と突き合わせるために持つ
   */
  diaryDays: { date: string; mood?: DiaryMood; alcohol?: boolean }[];
  /** 週内のGarmin活動記録(Issue #82)。1日1件。項目ごとに欠測しうる。dateはクロス分析(Issue #112)用 */
  activityDays: { date: string; steps?: number; totalKcal?: number; sleepMinutes?: number }[];
  /**
   * 活動量低下の判定(Issue #174)に使う、当該週の直前ACTIVITY_BASELINE_WEEKS週の週次サマリー。
   * 1要素=1週で、順序は問わない。当該週は含まない。アプリ利用開始前にあたる週は呼び出し側で除いてよい
   */
  prevWeeksActivity: {
    avgSteps: number | null; // その週の平均歩数(歩数データがある日の平均。無ければnull)
    stepsRecordedDays: number; // その週に歩数の値があった日数(データ品質ゲート用。行数ではない)
    workoutDays: number; // その週に筋トレを記録した日数
  }[];
  /** 週内の筋トレ記録(1セット=1件。Issue #103) */
  workoutSets: { date: string; exerciseName: string }[];
  /** 週内の日別水分合計(記録の無い日は0mlで埋まっていてよい。Issue #103) */
  waterDailyTotals: { date: string; amountMl: number }[];
  waterTargetMl: number | null;
  /** 週内の血圧記録(1日1件。Issue #117)。記録が無ければ空配列 */
  bloodPressureDays: { systolic: number; diastolic: number }[];
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

/**
 * 活動量の週次比較を組み立てる(Issue #174)。
 *
 * 摂取を減らしているのに減量が進まないとき、原因が消費側の低下にあることを示すための比較。
 * 歩数は「その週の活動記録がACTIVITY_MIN_RECORDED_DAYS日以上」という品質ゲートを当該週・基準週の
 * 双方に課す(時計を数日着けなかっただけの週を「活動量が落ちた週」と誤判定しないため)。
 * 筋トレ日数はアプリ自身の記録で欠測の概念が無いため、ゲートを課さずそのまま平均する。
 *
 * 比較できる過去週がACTIVITY_BASELINE_MIN_WEEKS未満、または過去に歩数・筋トレの実績が
 * どちらも無い場合はundefined(digestからactivityTrendを省く)
 */
export function aggregateActivityTrend(params: {
  /** 当該週の平均歩数(歩数の値がある日の平均) */
  weekAvgSteps: number | null;
  /** 当該週に歩数の値があった日数(活動記録の行数ではない) */
  weekStepsRecordedDays: number;
  /** 当該週に筋トレを記録した日数 */
  weekWorkoutDays: number;
  prevWeeksActivity: WeeklyDigestSource["prevWeeksActivity"];
}): WeeklyDigest["activityTrend"] | undefined {
  const { weekAvgSteps, weekStepsRecordedDays, weekWorkoutDays, prevWeeksActivity } = params;
  if (prevWeeksActivity.length < ACTIVITY_BASELINE_MIN_WEEKS) return undefined;

  const baselineStepWeeks = prevWeeksActivity.filter(
    (w): w is (typeof prevWeeksActivity)[number] & { avgSteps: number } =>
      w.avgSteps !== null && w.stepsRecordedDays >= ACTIVITY_MIN_RECORDED_DAYS,
  );
  const prevWeeksAvgSteps =
    baselineStepWeeks.length >= ACTIVITY_BASELINE_MIN_WEEKS
      ? Math.round(baselineStepWeeks.reduce((s, w) => s + w.avgSteps, 0) / baselineStepWeeks.length)
      : null;

  // 筋トレは欠測の概念が無いため、渡された全週を分母にする(記録が無い週=やらなかった週)
  const prevWeeksAvgWorkoutDays =
    round1(prevWeeksActivity.reduce((s, w) => s + w.workoutDays, 0) / prevWeeksActivity.length);

  // 当該週の歩数は、品質ゲートを満たすときだけ比較に載せる(欠測の多い週は比較そのものを出さない)
  const comparableWeekSteps = weekStepsRecordedDays >= ACTIVITY_MIN_RECORDED_DAYS ? weekAvgSteps : null;
  const stepsChangeRatio =
    comparableWeekSteps !== null && prevWeeksAvgSteps !== null && prevWeeksAvgSteps > 0
      ? round2((comparableWeekSteps - prevWeeksAvgSteps) / prevWeeksAvgSteps)
      : null;

  // 比較する実績が過去に何も無い(歩数の基準が立たず、筋トレも一度もしていない)週は比較を出さない
  if (prevWeeksAvgSteps === null && prevWeeksAvgWorkoutDays === 0) return undefined;

  return {
    weekAvgSteps: comparableWeekSteps,
    prevWeeksAvgSteps,
    stepsChangeRatio,
    // 歩数と筋トレで分母が違う(歩数は品質ゲートを通った週だけ)ため、基準の週数も別々に持つ。
    // まとめると画面のラベル・AIへの説明が実際の基準を偽ることになる
    stepsComparedWeeks: baselineStepWeeks.length,
    weekWorkoutDays,
    prevWeeksAvgWorkoutDays,
    comparedWeeks: prevWeeksActivity.length,
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

/**
 * 血圧の週サマリーを集計する(Issue #117)。記録が無い週はundefined(digestからbloodPressureを省く)。
 * highReadingDaysは家庭血圧135/85以上の日数の事実提示のみで、医学的判断はしない。
 * weekAvgWeightKgを併記し、体重×血圧を並べて見せる(#112のクロス分析の軸)。
 */
export function aggregateBloodPressure(
  bloodPressureDays: WeeklyDigestSource["bloodPressureDays"],
  weekAvgWeightKg: number | null,
): WeeklyDigest["bloodPressure"] | undefined {
  if (bloodPressureDays.length === 0) return undefined;
  const n = bloodPressureDays.length;
  return {
    avgSystolic: Math.round(bloodPressureDays.reduce((s, d) => s + d.systolic, 0) / n),
    avgDiastolic: Math.round(bloodPressureDays.reduce((s, d) => s + d.diastolic, 0) / n),
    recordedDays: n,
    highReadingDays: bloodPressureDays.filter(
      (d) => d.systolic >= HOME_BP_HIGH_SYSTOLIC || d.diastolic >= HOME_BP_HIGH_DIASTOLIC,
    ).length,
    weekAvgWeightKg,
  };
}

/** クロス分析(Issue #112)で「睡眠不足」とみなす閾値(6時間)。Garminの睡眠時間(分)と比較する */
export const SHORT_SLEEP_THRESHOLD_MINUTES = 360;

/** 気分タグのうちクロス分析で「気分が良い日」に数える値(aggregateMoodCountsのgood区分と同じ) */
const GOOD_MOODS: DiaryMood[] = ["great", "good"];
/** 気分タグのうちクロス分析で「眠い・不調の日」に数える値(aggregateMoodCountsのbad区分と同じ) */
const BAD_MOODS: DiaryMood[] = ["tired", "bad"];

/** クロス集計の入力(期間はperiodStart〜periodEnd)。週次・月次(Issue #114)で同じ集計を窓幅だけ変えて使う */
export interface CrossAnalysisSource {
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD(この日を含む)
  mealDailyTotals: DigestMealDailyTotal[];
  diaryDays: WeeklyDigestSource["diaryDays"];
  activityDays: WeeklyDigestSource["activityDays"];
}

/**
 * 期間内データのクロス集計(Issue #112)。睡眠不足・気分・飲酒の各条件に当てはまる日と
 * それ以外の日で、食事の日別合計カロリーを突き合わせる。計算はすべてここで行い、
 * 画面・AIとも事実の提示に留める(サンプル数が少なく「相関」とは言い切れないため)。
 * 各項目は比較が成立する期間だけ含め、1つも成立しない期間はundefined(digestから省く)。
 * 期間は週(週次レビュー)にも月(月次レビュー。Issue #114)にも取れる。
 */
export function buildCrossAnalysis(src: CrossAnalysisSource): WeeklyDigest["crossAnalysis"] | undefined {
  const kcalByDate = new Map(src.mealDailyTotals.map((d) => [d.date, d.kcal]));
  // 指定した日付集合のうち食事記録がある日の平均摂取カロリー。1日も無ければavg=null
  const avgIntake = (dates: string[]): { avg: number | null; days: number } => {
    const kcals = dates.filter((date) => kcalByDate.has(date)).map((date) => kcalByDate.get(date)!);
    return {
      avg: kcals.length > 0 ? Math.round(kcals.reduce((s, v) => s + v, 0) / kcals.length) : null,
      days: kcals.length,
    };
  };

  // 睡眠×摂取: Garminの睡眠時間は「その日の朝までの夜間睡眠」のため、同じ日付の食事と
  // 突き合わせれば「睡眠不足明けの日の摂取」になる(翌日ではなく同日でペアリングする)
  const sleepDays = src.activityDays.filter((d) => d.sleepMinutes !== undefined);
  const shortSleepDates = sleepDays
    .filter((d) => d.sleepMinutes! < SHORT_SLEEP_THRESHOLD_MINUTES)
    .map((d) => d.date);
  const enoughSleepDates = sleepDays
    .filter((d) => d.sleepMinutes! >= SHORT_SLEEP_THRESHOLD_MINUTES)
    .map((d) => d.date);
  const shortSleepIntake = avgIntake(shortSleepDates);
  const sleepIntake =
    shortSleepIntake.avg !== null
      ? {
          thresholdMinutes: SHORT_SLEEP_THRESHOLD_MINUTES,
          shortSleepDays: shortSleepDates.length,
          sleepRecordedDays: sleepDays.length,
          avgIntakeOnShortSleepDays: shortSleepIntake.avg,
          avgIntakeOnOtherDays: avgIntake(enoughSleepDates).avg,
        }
      : undefined;

  // 気分×摂取: 良い群・悪い群の両方に食事記録がある日が無ければ比較にならないので省く
  const goodMoodIntake = avgIntake(
    src.diaryDays.filter((d) => d.mood !== undefined && GOOD_MOODS.includes(d.mood)).map((d) => d.date),
  );
  const badMoodIntake = avgIntake(
    src.diaryDays.filter((d) => d.mood !== undefined && BAD_MOODS.includes(d.mood)).map((d) => d.date),
  );
  const moodIntake =
    goodMoodIntake.avg !== null && badMoodIntake.avg !== null
      ? {
          goodMoodDays: goodMoodIntake.days,
          badMoodDays: badMoodIntake.days,
          avgIntakeOnGoodMoodDays: goodMoodIntake.avg,
          avgIntakeOnBadMoodDays: badMoodIntake.avg,
        }
      : undefined;

  // 飲酒×摂取: 飲酒タグが1日でもあれば日数だけでも事実として出す(平均はnull許容)。
  // 「それ以外の日」はタグの無い日全体(未記録の日を含む)で、「飲酒なしと記録した日」ではない
  const alcoholDates = src.diaryDays.filter((d) => d.alcohol === true).map((d) => d.date);
  const alcoholDateSet = new Set(alcoholDates);
  const nextDayDates = alcoholDates
    .map((date) => addDaysToDateString(date, 1))
    .filter((date) => date <= src.periodEnd);
  const alcohol =
    alcoholDates.length > 0
      ? {
          alcoholDays: alcoholDates.length,
          avgIntakeOnAlcoholDays: avgIntake(alcoholDates).avg,
          avgIntakeOnOtherDays: avgIntake(
            src.mealDailyTotals.map((d) => d.date).filter((date) => !alcoholDateSet.has(date)),
          ).avg,
          avgIntakeNextDay: avgIntake(nextDayDates).avg,
        }
      : undefined;

  if (sleepIntake === undefined && moodIntake === undefined && alcohol === undefined) {
    return undefined;
  }
  return {
    ...(sleepIntake !== undefined ? { sleepIntake } : {}),
    ...(moodIntake !== undefined ? { moodIntake } : {}),
    ...(alcohol !== undefined ? { alcohol } : {}),
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
  // 目標日がダミー値("1900-01-01")の場合は残り日数を0に設定して必要ペース計算をスキップ
  const isGoalUnset = src.goalDate === "1900-01-01";
  const remainingDays = !isGoalUnset ? Math.max(0, daysBetween(src.today, src.goalDate)) : 0;

  // 体重: 週平均同士で比較する(単日比較は水分等のノイズが大きい)
  const weekAvgRaw = averageWeightKg(src.weekWeights);
  const prevWeekAvgRaw = averageWeightKg(src.prevWeekWeights);
  const weekAvgKg = weekAvgRaw !== null ? round2(weekAvgRaw) : null;
  const prevWeekAvgKg = prevWeekAvgRaw !== null ? round2(prevWeekAvgRaw) : null;
  const weeklyChangeKg =
    weekAvgRaw !== null && prevWeekAvgRaw !== null ? round2(weekAvgRaw - prevWeekAvgRaw) : null;

  // 必要ペース(kg/週)。減量が必要なら負の値。目標日超過・体重記録皆無・目標値未設定(ダミー値)の場合は0(フラグ側で状況を伝える)
  const paceBaseKg = weekAvgRaw ?? src.latestWeightKg;
  const requiredWeeklyPaceKg =
    remainingDays > 0 && paceBaseKg !== null && !isGoalUnset
      ? round2(-(((paceBaseKg - src.goalWeightKg) / remainingDays) * 7))
      : 0;

  // カロリー・PFC: 食事記録がある日の平均
  const mealDays = src.mealDailyTotals.length;
  const avgIntakeKcal =
    mealDays > 0 ? Math.round(src.mealDailyTotals.reduce((s, d) => s + d.kcal, 0) / mealDays) : null;
  const avgOf = (pick: (d: DigestMealDailyTotal) => number) =>
    mealDays > 0 ? round1(src.mealDailyTotals.reduce((s, d) => s + pick(d), 0) / mealDays) : null;

  const mood = aggregateMoodCounts(
    src.diaryDays.map((d) => d.mood).filter((m): m is DiaryMood => m !== undefined),
  );
  const activity = aggregateActivity(src.activityDays);
  const workout = aggregateWorkout(src.workoutSets);
  const weekWorkoutDays = new Set(src.workoutSets.map((s) => s.date)).size;
  const activityTrend = aggregateActivityTrend({
    weekAvgSteps: activity?.avgSteps ?? null,
    weekStepsRecordedDays: src.activityDays.filter((d) => d.steps !== undefined).length,
    weekWorkoutDays,
    prevWeeksActivity: src.prevWeeksActivity,
  });
  // 進行中の週は「まだやっていない」だけの可能性があるため、活動量の判定には経過日数の下限を課す
  // (歩数側は品質ゲートが同じ役割を果たすが、筋トレ日数には欠測の概念が無くゲートが効かない)
  const weekElapsedDays = Math.min(7, Math.max(0, daysBetween(src.weekStart, src.today) + 1));
  const water = aggregateWater(src.waterDailyTotals, src.waterTargetMl);
  const bloodPressure = aggregateBloodPressure(src.bloodPressureDays, weekAvgKg);
  const crossAnalysis = buildCrossAnalysis({
    periodStart: src.weekStart,
    periodEnd: weekEnd,
    mealDailyTotals: src.mealDailyTotals,
    diaryDays: src.diaryDays,
    activityDays: src.activityDays,
  });
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
  if (src.projectedKg !== null && !isGoalUnset && src.projectedKg > src.goalWeightKg) {
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
  // 活動量の低下(Issue #174)。実測TDEEの下落の要因を、摂取ではなく消費側として名指しするためのフラグ。
  // 歩数と筋トレを別フラグにしているのは、取るべき行動(歩く / トレーニングを再開する)が別だから
  if (
    activityTrend !== undefined &&
    activityTrend.stepsChangeRatio !== null &&
    activityTrend.stepsChangeRatio <= -ACTIVITY_DROP_RATIO
  ) {
    flags.push("ACTIVITY_DROP");
  }
  // 「過去に筋トレの習慣があった」ことを条件に入れることで、元々やっていない人には出ないようにする。
  // 週の途中(経過日数がACTIVITY_MIN_RECORDED_DAYS未満)は、まだやっていないだけなので判定しない
  if (
    activityTrend !== undefined &&
    weekElapsedDays >= ACTIVITY_MIN_RECORDED_DAYS &&
    activityTrend.prevWeeksAvgWorkoutDays !== null &&
    activityTrend.prevWeeksAvgWorkoutDays >= 1 &&
    activityTrend.weekWorkoutDays === 0
  ) {
    flags.push("WORKOUT_STOPPED");
  }

  return {
    period: { start: src.weekStart, end: weekEnd },
    goal: {
      targetWeightKg: src.goalWeightKg,
      targetDate: src.goalDate,
      remainingDays,
    } as const,
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
      daysOnTarget: src.calorieTargetKcal > 1 ? src.mealDailyTotals.filter((d) => d.kcal <= src.calorieTargetKcal).length : 0,
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
    ...(activityTrend !== undefined ? { activityTrend } : {}),
    ...(workout !== undefined ? { workout } : {}),
    ...(water !== undefined ? { water } : {}),
    ...(bloodPressure !== undefined ? { bloodPressure } : {}),
    ...(diaryEntries !== null && diaryEntries.length > 0 ? { diaryEntries } : {}),
    ...(crossAnalysis !== undefined ? { crossAnalysis } : {}),
  };
}
