import { describe, expect, it } from "vitest";
import {
  aggregateActivity,
  aggregateActivityTrend,
  aggregateMoodCounts,
  aggregateWater,
  aggregateWorkout,
  buildCrossAnalysis,
  buildWeeklyDigest,
  SHORT_SLEEP_THRESHOLD_MINUTES,
  type CrossAnalysisSource,
  type WeeklyDigestSource,
} from "../weeklyDigest";

/** 順調な週(7日全記録・-0.5kg/週・目標以内5日)のベース入力 */
function goodWeekSource(): WeeklyDigestSource {
  return {
    weekStart: "2026-07-06",
    today: "2026-07-13",
    goalWeightKg: 64,
    goalDate: "2026-10-31",
    calorieTargetKcal: 1900,
    pfcTargets: { proteinG: 130, fatG: 53, carbsG: 230 },
    bmrKcal: 1639,
    weekWeights: [{ weightKg: 71.2 }, { weightKg: 71.4 }, { weightKg: 71.6 }],
    prevWeekWeights: [{ weightKg: 71.9 }],
    latestWeightKg: 71.2,
    mealDailyTotals: [
      { date: "2026-07-06", kcal: 1800, proteinG: 120, fatG: 55, carbsG: 190 },
      { date: "2026-07-07", kcal: 1850, proteinG: 125, fatG: 50, carbsG: 200 },
      { date: "2026-07-08", kcal: 1900, proteinG: 118, fatG: 60, carbsG: 185 },
      { date: "2026-07-09", kcal: 2000, proteinG: 122, fatG: 52, carbsG: 210 },
      { date: "2026-07-10", kcal: 1850, proteinG: 121, fatG: 54, carbsG: 195 },
      { date: "2026-07-11", kcal: 1800, proteinG: 119, fatG: 56, carbsG: 188 },
      { date: "2026-07-12", kcal: 1750, proteinG: 123, fatG: 51, carbsG: 192 },
    ],
    recordedDays: 7,
    currentStreakDays: 12,
    estimatedTdeeKcal: 2400,
    projectedKg: 63.5,
    diaryDays: [
      { date: "2026-07-06", mood: "great" },
      { date: "2026-07-07", mood: "good" },
      { date: "2026-07-08", mood: "ok" },
      { date: "2026-07-09", mood: "tired" },
    ],
    activityDays: [
      { date: "2026-07-06", steps: 8000, totalKcal: 2400, sleepMinutes: 420 },
      { date: "2026-07-07", steps: 10000, totalKcal: 2600, sleepMinutes: 390 },
      { date: "2026-07-08", steps: 9000, totalKcal: 2500 }, // 睡眠欠測(時計を着けず就寝)
    ],
    workoutSets: [
      { date: "2026-07-07", exerciseName: "ベンチプレス" },
      { date: "2026-07-07", exerciseName: "ベンチプレス" },
      { date: "2026-07-07", exerciseName: "スクワット" },
      { date: "2026-07-10", exerciseName: "ベンチプレス" },
    ],
    waterDailyTotals: [
      { date: "2026-07-06", amountMl: 2000 },
      { date: "2026-07-07", amountMl: 1500 },
      { date: "2026-07-08", amountMl: 0 }, // 記録なし(平均の分母に入れない)
      { date: "2026-07-09", amountMl: 2200 },
    ],
    waterTargetMl: 2000,
    bloodPressureDays: [],
    // 活動量の比較基準(Issue #174)。当該週(平均9,000歩・筋トレ2日)と同水準で、フラグが立たない状態
    prevWeeksActivity: [
      { avgSteps: 9000, stepsRecordedDays: 7, workoutDays: 2 },
      { avgSteps: 9200, stepsRecordedDays: 7, workoutDays: 2 },
      { avgSteps: 8800, stepsRecordedDays: 7, workoutDays: 1 },
      { avgSteps: 9000, stepsRecordedDays: 7, workoutDays: 3 },
    ],
    diaryTexts: null, // オプトインOFF(デフォルト)
  };
}

describe("buildWeeklyDigest", () => {
  it("順調な週: 集計値が正しくフラグが立たない", () => {
    const digest = buildWeeklyDigest(goodWeekSource());

    expect(digest.period).toEqual({ start: "2026-07-06", end: "2026-07-12" });
    expect(digest.goal.remainingDays).toBe(110);
    expect(digest.weight.weekAvgKg).toBe(71.4);
    expect(digest.weight.prevWeekAvgKg).toBe(71.9);
    expect(digest.weight.weeklyChangeKg).toBe(-0.5);
    // 必要ペース = -(71.4-64)/110*7 ≈ -0.47kg/週
    expect(digest.weight.requiredWeeklyPaceKg).toBeCloseTo(-0.47, 2);
    // 基準体重は週平均を優先する(latestWeightKg=71.2ではなくweekAvgKg=71.4)
    expect(digest.weight.paceBaseKg).toBe(71.4);
    expect(digest.calories.avgIntakeKcal).toBe(1850);
    expect(digest.calories.daysOnTarget).toBe(6); // 2000kcalの1日だけ超過
    expect(digest.calories.recordedDays).toBe(7);
    expect(digest.pfc.avgProteinG).toBeCloseTo(121.1, 1);
    expect(digest.pfc.targetProteinG).toBe(130);
    expect(digest.recording).toEqual({ recordedDays: 7, currentStreakDays: 12 });
    expect(digest.flags).toEqual([]);
    expect(digest.mood).toEqual({ good: 2, normal: 1, bad: 1 });
    // 活動: 平均は「その項目のデータがある日」の平均(睡眠は2日分の平均)
    expect(digest.activity).toEqual({
      avgSteps: 9000,
      avgTotalKcal: 2500,
      avgSleepMinutes: 405,
      recordedDays: 3,
    });
    // 筋トレ: 日数はdateの異なり数、種目数は種目名の異なり数、セット数は件数(Issue #103)
    expect(digest.workout).toEqual({ activeDays: 2, exerciseCount: 2, totalSets: 4 });
    // 水分: 0mlの日(記録なし)は平均・記録日数の分母に入れない
    expect(digest.water).toEqual({ avgIntakeMl: 1900, targetMl: 2000, daysOnTarget: 2, recordedDays: 3 });
    // 日記本文はオプトインOFF(diaryTexts=null)なので含まれない(AIコンサルティング設計書7章)
    expect(digest.diaryEntries).toBeUndefined();
    // クロス分析(Issue #112): 睡眠不足の日・飲酒日が無いのでmoodIntakeのみ
    expect(digest.crossAnalysis).toEqual({
      moodIntake: {
        goodMoodDays: 2, // 7/6(1800)・7/7(1850)
        badMoodDays: 1, // 7/9(2000)
        avgIntakeOnGoodMoodDays: 1825,
        avgIntakeOnBadMoodDays: 2000,
      },
    });
  });

  it("オプトインONの週は日記本文を含める(本文が空の日は除く)", () => {
    const src = goodWeekSource();
    src.diaryTexts = [
      { date: "2026-07-06", text: "仕事が忙しくて外食続きだった" },
      { date: "2026-07-07", text: "  " }, // 気分タグのみの日(本文なし)
    ];
    expect(buildWeeklyDigest(src).diaryEntries).toEqual([
      { date: "2026-07-06", text: "仕事が忙しくて外食続きだった" },
    ]);
  });

  it("オプトインONでも本文のある日記が無ければdiaryEntriesを省く", () => {
    const src = goodWeekSource();
    src.diaryTexts = [{ date: "2026-07-06", text: "" }];
    expect(buildWeeklyDigest(src).diaryEntries).toBeUndefined();
  });

  it("筋トレ・水分の記録が無い週はworkout・waterを省く", () => {
    const src = goodWeekSource();
    src.workoutSets = [];
    src.waterDailyTotals = [{ date: "2026-07-06", amountMl: 0 }];
    const digest = buildWeeklyDigest(src);
    expect(digest.workout).toBeUndefined();
    expect(digest.water).toBeUndefined();
  });

  it("活動記録が1日も無い週はactivityを省く(Garmin未連携ユーザーのdigestを変えない)", () => {
    const src = goodWeekSource();
    src.activityDays = [];
    expect(buildWeeklyDigest(src).activity).toBeUndefined();
  });

  it("PACE_TOO_AGGRESSIVE: 週の減少幅が週平均体重の1%を超える", () => {
    const src = goodWeekSource();
    src.prevWeekWeights = [{ weightKg: 72.5 }]; // -1.1kg > 71.4×1% = 0.714kg
    expect(buildWeeklyDigest(src).flags).toContain("PACE_TOO_AGGRESSIVE");
  });

  it("体重増加の週はPACE_TOO_AGGRESSIVEにならない", () => {
    const src = goodWeekSource();
    src.prevWeekWeights = [{ weightKg: 70.0 }]; // +1.4kg増
    expect(buildWeeklyDigest(src).flags).not.toContain("PACE_TOO_AGGRESSIVE");
  });

  it("INTAKE_BELOW_BMR: 週平均摂取が基礎代謝を下回る", () => {
    const src = goodWeekSource();
    src.mealDailyTotals = src.mealDailyTotals.map((d) => ({ ...d, kcal: 1500 }));
    expect(buildWeeklyDigest(src).flags).toContain("INTAKE_BELOW_BMR");
  });

  it("BMR未設定(身体プロフィール無し)ならINTAKE_BELOW_BMRは判定しない", () => {
    const src = goodWeekSource();
    src.bmrKcal = null;
    src.mealDailyTotals = src.mealDailyTotals.map((d) => ({ ...d, kcal: 1200 }));
    expect(buildWeeklyDigest(src).flags).not.toContain("INTAKE_BELOW_BMR");
  });

  it("BEHIND_PACE: 着地予測が目標体重を上回る", () => {
    const src = goodWeekSource();
    src.projectedKg = 66.2;
    expect(buildWeeklyDigest(src).flags).toContain("BEHIND_PACE");
  });

  it("記録サボり週: LOW_RECORDING_RATE(5日未満)", () => {
    const src = goodWeekSource();
    src.recordedDays = 3;
    const digest = buildWeeklyDigest(src);
    expect(digest.flags).toContain("LOW_RECORDING_RATE");
    expect(digest.flags).not.toContain("INSUFFICIENT_DATA");
  });

  it("データ不足週: NO_WEIGHT_DATA + INSUFFICIENT_DATA(2日未満)", () => {
    const src = goodWeekSource();
    src.weekWeights = [];
    src.prevWeekWeights = [];
    src.mealDailyTotals = [];
    src.recordedDays = 0;
    src.diaryDays = [];
    const digest = buildWeeklyDigest(src);
    expect(digest.flags).toEqual(["LOW_RECORDING_RATE", "NO_WEIGHT_DATA", "INSUFFICIENT_DATA"]);
    expect(digest.weight.weekAvgKg).toBeNull();
    expect(digest.calories.avgIntakeKcal).toBeNull();
    expect(digest.pfc.avgProteinG).toBeNull();
    // 週平均が無い場合は最新体重でフォールバックして必要ペースを出す
    expect(digest.weight.requiredWeeklyPaceKg).toBeCloseTo(-((71.2 - 64) / 110) * 7, 2);
    expect(digest.weight.paceBaseKg).toBe(71.2);
    expect(digest.mood).toBeUndefined();
  });

  it("体重記録が1件も無い(latestWeightKgもnull)場合の必要ペースは0・paceBaseKgもnull", () => {
    const src = goodWeekSource();
    src.weekWeights = [];
    src.latestWeightKg = null;
    const digest = buildWeeklyDigest(src);
    expect(digest.weight.requiredWeeklyPaceKg).toBe(0);
    expect(digest.weight.paceBaseKg).toBeNull();
  });

  it("目標日を過ぎている場合はremainingDays=0・必要ペース0", () => {
    const src = goodWeekSource();
    src.today = "2026-11-05";
    const digest = buildWeeklyDigest(src);
    expect(digest.goal.remainingDays).toBe(0);
    expect(digest.weight.requiredWeeklyPaceKg).toBe(0);
  });

  it("PFC目標未設定ならtarget側はnull", () => {
    const src = goodWeekSource();
    src.pfcTargets = null;
    const digest = buildWeeklyDigest(src);
    expect(digest.pfc.targetProteinG).toBeNull();
    expect(digest.pfc.avgProteinG).not.toBeNull();
  });
});

describe("aggregateActivity", () => {
  it("全日欠測の項目はnull(recordedDaysは活動記録がある日数)", () => {
    expect(
      aggregateActivity([
        { date: "2026-07-06", steps: 5000 },
        { date: "2026-07-07", steps: 7000 },
      ]),
    ).toEqual({
      avgSteps: 6000,
      avgTotalKcal: null,
      avgSleepMinutes: null,
      recordedDays: 2,
    });
  });

  it("活動記録が無ければundefined", () => {
    expect(aggregateActivity([])).toBeUndefined();
  });
});

describe("aggregateWorkout", () => {
  it("記録が無ければundefined(digestからworkoutを省く)", () => {
    expect(aggregateWorkout([])).toBeUndefined();
  });
});

describe("aggregateWater", () => {
  it("目標未設定ならtargetMl・daysOnTargetはnull", () => {
    expect(aggregateWater([{ date: "2026-07-06", amountMl: 1800 }], null)).toEqual({
      avgIntakeMl: 1800,
      targetMl: null,
      daysOnTarget: null,
      recordedDays: 1,
    });
  });

  it("記録が無ければundefined(0mlの日だけでも同様)", () => {
    expect(aggregateWater([], 2000)).toBeUndefined();
    expect(aggregateWater([{ date: "2026-07-06", amountMl: 0 }], 2000)).toBeUndefined();
  });
});

describe("buildCrossAnalysis", () => {
  /** クロス分析用の最小ソース(食事は月〜日の7日分) */
  function crossSource(): CrossAnalysisSource {
    return {
      periodStart: "2026-07-06",
      periodEnd: "2026-07-12",
      mealDailyTotals: [
        { date: "2026-07-06", kcal: 1800, proteinG: 0, fatG: 0, carbsG: 0 },
        { date: "2026-07-07", kcal: 2200, proteinG: 0, fatG: 0, carbsG: 0 },
        { date: "2026-07-08", kcal: 1900, proteinG: 0, fatG: 0, carbsG: 0 },
        { date: "2026-07-09", kcal: 2100, proteinG: 0, fatG: 0, carbsG: 0 },
        { date: "2026-07-10", kcal: 1700, proteinG: 0, fatG: 0, carbsG: 0 },
        { date: "2026-07-11", kcal: 2000, proteinG: 0, fatG: 0, carbsG: 0 },
        { date: "2026-07-12", kcal: 1600, proteinG: 0, fatG: 0, carbsG: 0 },
      ],
      diaryDays: [],
      activityDays: [],
    };
  }

  it("睡眠6時間未満の日がある週は、その日とそれ以外の日の同日摂取カロリーを比較する", () => {
    const src = crossSource();
    src.activityDays = [
      { date: "2026-07-07", sleepMinutes: 300 }, // 睡眠不足 → 当日2200kcal
      { date: "2026-07-09", sleepMinutes: 350 }, // 睡眠不足 → 当日2100kcal
      { date: "2026-07-10", sleepMinutes: 420 }, // 十分 → 当日1700kcal
      { date: "2026-07-11", steps: 8000 }, // 睡眠欠測(分母に入れない)
    ];
    expect(buildCrossAnalysis(src)?.sleepIntake).toEqual({
      thresholdMinutes: SHORT_SLEEP_THRESHOLD_MINUTES,
      shortSleepDays: 2,
      sleepRecordedDays: 3,
      avgIntakeOnShortSleepDays: 2150,
      avgIntakeOnOtherDays: 1700,
    });
  });

  it("睡眠不足の日に食事記録が無い週はsleepIntakeを省く(比較が成立しない)", () => {
    const src = crossSource();
    src.mealDailyTotals = src.mealDailyTotals.filter((d) => d.date !== "2026-07-07");
    src.activityDays = [{ date: "2026-07-07", sleepMinutes: 300 }];
    expect(buildCrossAnalysis(src)?.sleepIntake).toBeUndefined();
  });

  it("飲酒日がある週は、当日・それ以外の日・翌日(週内のみ)の摂取カロリーを集計する", () => {
    const src = crossSource();
    src.diaryDays = [
      { date: "2026-07-07", alcohol: true }, // 当日2200・翌日(7/8)1900
      { date: "2026-07-12", alcohol: true }, // 日曜: 翌日は週外なので翌日平均に入れない。当日1600
      { date: "2026-07-10" }, // タグ無し
    ];
    expect(buildCrossAnalysis(src)?.alcohol).toEqual({
      alcoholDays: 2,
      avgIntakeOnAlcoholDays: 1900, // (2200+1600)/2
      avgIntakeOnOtherDays: 1900, // (1800+1900+2100+1700+2000)/5
      avgIntakeNextDay: 1900, // 7/8のみ
    });
  });

  it("飲酒日があれば食事記録が無くても日数を事実として出す(平均はnull)", () => {
    const src = crossSource();
    src.mealDailyTotals = [];
    src.diaryDays = [{ date: "2026-07-08", alcohol: true }];
    expect(buildCrossAnalysis(src)?.alcohol).toEqual({
      alcoholDays: 1,
      avgIntakeOnAlcoholDays: null,
      avgIntakeOnOtherDays: null,
      avgIntakeNextDay: null,
    });
  });

  it("気分の良い群・悪い群の片方にしか食事記録が無い週はmoodIntakeを省く", () => {
    const src = crossSource();
    src.diaryDays = [
      { date: "2026-07-06", mood: "great" },
      { date: "2026-07-08", mood: "ok" }, // 普通はどちらの群にも入らない
    ];
    expect(buildCrossAnalysis(src)?.moodIntake).toBeUndefined();
  });

  it("比較が1つも成立しない週はundefined(digestからcrossAnalysis自体を省く)", () => {
    expect(buildCrossAnalysis(crossSource())).toBeUndefined();
  });
});

describe("aggregateMoodCounts", () => {
  it("5段階の気分タグを3区分(good/normal/bad)に集計する", () => {
    expect(aggregateMoodCounts(["great", "good", "ok", "tired", "bad"])).toEqual({
      good: 2,
      normal: 1,
      bad: 2,
    });
  });

  it("日記が無い週はundefined(digestからmoodを省く)", () => {
    expect(aggregateMoodCounts([])).toBeUndefined();
  });
});

/** 週内7日すべてに歩数がある週にする(2026-07-06〜07-12)。歩数の品質ゲートを満たすため比較の対象になる */
function withFullActivityWeek(steps: number): WeeklyDigestSource {
  const src = goodWeekSource();
  src.activityDays = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-07-${String(6 + i).padStart(2, "0")}`,
    steps,
    totalKcal: 2400,
    sleepMinutes: 420,
  }));
  return src;
}

describe("aggregateActivityTrend(Issue #174)", () => {
  const baseline = (weeks: number, avgSteps: number | null, workoutDays: number, stepsRecordedDays = 7) =>
    Array.from({ length: weeks }, () => ({ avgSteps, stepsRecordedDays, workoutDays }));

  it("直近週の平均と変化率を算出する", () => {
    const trend = aggregateActivityTrend({
      weekAvgSteps: 8000,
      weekStepsRecordedDays: 7,
      weekWorkoutDays: 2,
      prevWeeksActivity: baseline(4, 10000, 2),
    });
    expect(trend).toEqual({
      weekAvgSteps: 8000,
      prevWeeksAvgSteps: 10000,
      stepsChangeRatio: -0.2,
      stepsComparedWeeks: 4,
      weekWorkoutDays: 2,
      prevWeeksAvgWorkoutDays: 2,
      comparedWeeks: 4,
    });
  });

  it("比較できる過去週が2週未満なら判定しない(利用開始直後の誤検知を防ぐ)", () => {
    expect(
      aggregateActivityTrend({
        weekAvgSteps: 8000,
        weekStepsRecordedDays: 7,
        weekWorkoutDays: 0,
        prevWeeksActivity: baseline(1, 10000, 2),
      }),
    ).toBeUndefined();
  });

  it("歩数が5日未満の基準週は歩数の基準から外し、基準週数もその実数で返す", () => {
    // 4週のうち2週だけが品質ゲートを満たす → その2週だけで基準を作る
    const trend = aggregateActivityTrend({
      weekAvgSteps: 8000,
      weekStepsRecordedDays: 7,
      weekWorkoutDays: 1,
      prevWeeksActivity: [
        ...baseline(2, 10000, 1),
        ...baseline(2, 3000, 1, 2), // 歩数が2日だけの週(基準から除外)
      ],
    });
    expect(trend?.prevWeeksAvgSteps).toBe(10000);
    // 歩数の基準は2週、筋トレは欠測の概念が無いため4週すべて。ラベルが実際の基準を偽らないよう別々に持つ
    expect(trend?.stepsComparedWeeks).toBe(2);
    expect(trend?.comparedWeeks).toBe(4);
  });

  it("当該週の歩数が5日未満なら歩数の比較は行わない(筋トレの比較は残る)", () => {
    const trend = aggregateActivityTrend({
      weekAvgSteps: 3000,
      weekStepsRecordedDays: 3,
      weekWorkoutDays: 0,
      prevWeeksActivity: baseline(4, 10000, 2),
    });
    expect(trend?.weekAvgSteps).toBeNull();
    expect(trend?.stepsChangeRatio).toBeNull();
    expect(trend?.prevWeeksAvgWorkoutDays).toBe(2);
  });

  it("筋トレの平均は記録の無い週も分母に含める(隔週トレーニングを毎週継続と誤らない)", () => {
    const trend = aggregateActivityTrend({
      weekAvgSteps: 9000,
      weekStepsRecordedDays: 7,
      weekWorkoutDays: 0,
      prevWeeksActivity: [...baseline(2, 9000, 2), ...baseline(2, 9000, 0)],
    });
    expect(trend?.prevWeeksAvgWorkoutDays).toBe(1);
  });

  it("過去に歩数の基準も筋トレの実績も無ければ比較そのものを出さない", () => {
    expect(
      aggregateActivityTrend({
        weekAvgSteps: 8000,
        weekStepsRecordedDays: 7,
        weekWorkoutDays: 0,
        prevWeeksActivity: baseline(4, null, 0, 0),
      }),
    ).toBeUndefined();
  });
});

describe("buildWeeklyDigest: 活動量低下のフラグ(Issue #174)", () => {
  it("歩数が基準を20%以上下回るとACTIVITY_DROPが立つ", () => {
    const src = withFullActivityWeek(8000);
    src.prevWeeksActivity = Array.from({ length: 4 }, () => ({
      avgSteps: 10000,
      stepsRecordedDays: 7,
      workoutDays: 2,
    }));
    const digest = buildWeeklyDigest(src);
    expect(digest.flags).toContain("ACTIVITY_DROP");
    expect(digest.activityTrend?.stepsChangeRatio).toBe(-0.2);
  });

  it("低下が閾値未満(19%減)ならフラグは立たない", () => {
    const src = withFullActivityWeek(8100);
    src.prevWeeksActivity = Array.from({ length: 4 }, () => ({
      avgSteps: 10000,
      stepsRecordedDays: 7,
      workoutDays: 2,
    }));
    expect(buildWeeklyDigest(src).flags).not.toContain("ACTIVITY_DROP");
  });

  it("直近数週は継続していた筋トレが0日になるとWORKOUT_STOPPEDが立つ", () => {
    const src = goodWeekSource();
    src.workoutSets = [];
    src.prevWeeksActivity = Array.from({ length: 4 }, () => ({
      avgSteps: 9000,
      stepsRecordedDays: 7,
      workoutDays: 2,
    }));
    expect(buildWeeklyDigest(src).flags).toContain("WORKOUT_STOPPED");
  });

  it("もともと筋トレの習慣が無ければ0日でもWORKOUT_STOPPEDは立たない", () => {
    const src = goodWeekSource();
    src.workoutSets = [];
    src.prevWeeksActivity = Array.from({ length: 4 }, () => ({
      avgSteps: 9000,
      stepsRecordedDays: 7,
      workoutDays: 0,
    }));
    expect(buildWeeklyDigest(src).flags).not.toContain("WORKOUT_STOPPED");
  });

  it("摂取が基礎代謝を下回りつつ活動量も落ちた週は、両方のフラグが並んで立つ", () => {
    // 実測TDEEの下落局面(Issue #174の背景)を再現する。摂取を削っても消費が落ちていて進まない状態
    const src = withFullActivityWeek(7000);
    src.mealDailyTotals = src.mealDailyTotals.map((d) => ({ ...d, kcal: 1500 }));
    src.workoutSets = [];
    src.prevWeeksActivity = Array.from({ length: 4 }, () => ({
      avgSteps: 12000,
      stepsRecordedDays: 7,
      workoutDays: 2,
    }));
    const digest = buildWeeklyDigest(src);
    expect(digest.flags).toContain("INTAKE_BELOW_BMR");
    expect(digest.flags).toContain("ACTIVITY_DROP");
    expect(digest.flags).toContain("WORKOUT_STOPPED");
  });

  it("比較基準が無い週はactivityTrendを省く(フラグも立たない)", () => {
    const src = withFullActivityWeek(3000);
    src.prevWeeksActivity = [];
    const digest = buildWeeklyDigest(src);
    expect(digest.activityTrend).toBeUndefined();
    expect(digest.flags).not.toContain("ACTIVITY_DROP");
    expect(digest.flags).not.toContain("WORKOUT_STOPPED");
  });
});

describe("buildWeeklyDigest: 進行中の週での誤検知(Issue #174のレビュー指摘)", () => {
  /** 直近4週は週2日の筋トレを継続していた基準 */
  const trainedBaseline = () =>
    Array.from({ length: 4 }, () => ({ avgSteps: 9000, stepsRecordedDays: 7, workoutDays: 2 }));

  it("週の途中(月曜時点)はまだ筋トレしていないだけなのでWORKOUT_STOPPEDを立てない", () => {
    const src = goodWeekSource();
    src.today = "2026-07-06"; // 週初日(月曜)
    src.workoutSets = [];
    src.prevWeeksActivity = trainedBaseline();
    expect(buildWeeklyDigest(src).flags).not.toContain("WORKOUT_STOPPED");
  });

  it("週の経過が5日に達すればWORKOUT_STOPPEDを立てる", () => {
    const src = goodWeekSource();
    src.today = "2026-07-10"; // 週の5日目(金曜)
    src.workoutSets = [];
    src.prevWeeksActivity = trainedBaseline();
    expect(buildWeeklyDigest(src).flags).toContain("WORKOUT_STOPPED");
  });

  it("歩数が1日しか無い週は、その日が低くてもACTIVITY_DROPを立てない(Garminは欠測日も行を書く)", () => {
    const src = goodWeekSource();
    // 活動記録は7日分あるが、歩数の値があるのは1日だけ(時計を着けなかった週)
    src.activityDays = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-07-${String(6 + i).padStart(2, "0")}`,
      totalKcal: 2400,
      ...(i === 0 ? { steps: 1000 } : {}),
    }));
    src.prevWeeksActivity = Array.from({ length: 4 }, () => ({
      avgSteps: 12000,
      stepsRecordedDays: 7,
      workoutDays: 2,
    }));
    const digest = buildWeeklyDigest(src);
    expect(digest.flags).not.toContain("ACTIVITY_DROP");
    expect(digest.activityTrend?.weekAvgSteps).toBeNull();
  });
});
