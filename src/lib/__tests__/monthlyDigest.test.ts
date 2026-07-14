import { describe, expect, it } from "vitest";
import { buildMonthlyDigest, type MonthlyDigestSource } from "../monthlyDigest";
import { weekStartsOfMonth } from "../date";
import type { WeeklyNutritionSummary } from "../tdee";

/**
 * buildMonthlyDigest(Issue #114)の純関数テスト。
 * 月は2026年7月(日曜が7月に落ちる週= 6/29・7/6・7/13・7/20週の4週。期間は6/29〜7/26)。
 * weekSummariesはindex0が月の直前週(6/22週)、index1〜4が月内の各週。
 */

const MONTH = "2026-07";
const WEEK_STARTS = weekStartsOfMonth(MONTH); // 6/29, 7/6, 7/13, 7/20
const TODAY = "2026-08-03";

/** 有効週(食事5日以上・体重2件以上)のサマリーを作るヘルパー */
function week(weekAvgKg: number | null, avgIntakeKcal: number | null, opts?: {
  mealRecordedDays?: number;
  weightCount?: number;
}): WeeklyNutritionSummary {
  return {
    weekAvgKg,
    avgIntakeKcal,
    mealRecordedDays: opts?.mealRecordedDays ?? (avgIntakeKcal !== null ? 6 : 0),
    weightCount: opts?.weightCount ?? (weekAvgKg !== null ? 3 : 0),
  };
}

function baseSource(overrides?: Partial<MonthlyDigestSource>): MonthlyDigestSource {
  return {
    month: MONTH,
    weekStarts: WEEK_STARTS,
    // index0=直前週(6/22)、以降が月内各週(6/29・7/6・7/13・7/20)
    weekSummaries: [
      week(78.5, 1900), // 6/22(前週)
      week(78.0, 1850), // 6/29
      week(77.7, 1820), // 7/6
      week(77.4, 1830), // 7/13
      week(77.1, 1810), // 7/20
    ],
    today: TODAY,
    goalWeightKg: 73,
    goalDate: "2026-10-31",
    calorieTargetKcal: 1900,
    bmrKcal: 1600,
    latestWeightKg: 77.1,
    mealDailyTotals: [],
    recordedDays: 33,
    diaryDays: [],
    activityDays: [],
    ...overrides,
  };
}

describe("buildMonthlyDigest", () => {
  it("期間は最初の週の月曜〜最後の週の日曜、総日数は週数×7", () => {
    const digest = buildMonthlyDigest(baseSource());
    expect(digest.month).toBe("2026-07");
    expect(digest.period).toEqual({ start: "2026-06-29", end: "2026-07-26" });
    expect(digest.recording.totalDays).toBe(28); // 4週
  });

  it("週平均体重の系列(weeks)は月内の各週のみ(直前週を含めない)", () => {
    const digest = buildMonthlyDigest(baseSource());
    expect(digest.weeks.map((w) => w.weekStart)).toEqual(WEEK_STARTS);
    expect(digest.weeks.map((w) => w.weekAvgKg)).toEqual([78.0, 77.7, 77.4, 77.1]);
    expect(digest.weeks.map((w) => w.avgIntakeKcal)).toEqual([1850, 1820, 1830, 1810]);
  });

  it("月間変化・平均ペースは、記録がある最初と最後の週の週平均で計算する", () => {
    const digest = buildMonthlyDigest(baseSource());
    expect(digest.weight.startWeekAvgKg).toBe(78.0);
    expect(digest.weight.endWeekAvgKg).toBe(77.1);
    expect(digest.weight.monthlyChangeKg).toBe(-0.9);
    // 78.0→77.1で週スパンは3週(6/29→7/20)。-0.9/3 = -0.3
    expect(digest.weight.avgWeeklyPaceKg).toBe(-0.3);
    expect(digest.weight.weeksWithData).toBe(4);
  });

  it("端の週に体重記録が無くても、記録のある週同士でペースを計算する", () => {
    const summaries = baseSource().weekSummaries.slice();
    summaries[1] = week(null, 1850); // 6/29の体重欠測
    summaries[4] = week(null, 1810); // 7/20の体重欠測
    const digest = buildMonthlyDigest(baseSource({ weekSummaries: summaries }));
    // 記録がある最初=7/6(77.7)、最後=7/13(77.4)。スパン1週
    expect(digest.weight.startWeekAvgKg).toBe(77.7);
    expect(digest.weight.endWeekAvgKg).toBe(77.4);
    expect(digest.weight.monthlyChangeKg).toBe(-0.3);
    expect(digest.weight.avgWeeklyPaceKg).toBe(-0.3);
    expect(digest.weight.weeksWithData).toBe(2);
  });

  it("体重記録のある週が1週だけなら変化・ペースはnull(比較できない)", () => {
    const summaries = baseSource().weekSummaries.map((s, i) => (i === 3 ? s : week(null, s.avgIntakeKcal)));
    const digest = buildMonthlyDigest(baseSource({ weekSummaries: summaries }));
    expect(digest.weight.weeksWithData).toBe(1);
    expect(digest.weight.monthlyChangeKg).toBeNull();
    expect(digest.weight.avgWeeklyPaceKg).toBeNull();
    expect(digest.weight.projectedAtGoalDateKg).toBeNull();
  });

  it("マイルストーン: 今月の平均ペースを目標日まで延長した見込み体重を出す", () => {
    const digest = buildMonthlyDigest(baseSource());
    // endWeekAvgKg=77.1、pace=-0.3kg/週、残り日数(8/3→10/31)=89日
    // 77.1 + (-0.3 * 89/7) = 77.1 - 3.814 = 73.29
    expect(digest.goal.remainingDays).toBe(89);
    expect(digest.weight.projectedAtGoalDateKg).toBeCloseTo(73.29, 1);
    // 見込み(73.3)が目標(73.0)をわずかに上回る → BEHIND_PACE
    expect(digest.flags).toContain("BEHIND_PACE");
  });

  it("月窓の実測TDEEは月内の全有効週の週次逆算値の平均で、最小・最大も出す", () => {
    const digest = buildMonthlyDigest(baseSource());
    // 各週のTDEE = avgIntake - (weekAvgKg - prevWeekAvgKg)*7700/7
    // 6/29: 1850 - (78.0-78.5)*1100 = 1850 + 550 = 2400
    // 7/6:  1820 - (77.7-78.0)*1100 = 1820 + 330 = 2150
    // 7/13: 1830 - (77.4-77.7)*1100 = 1830 + 330 = 2160
    // 7/20: 1810 - (77.1-77.4)*1100 = 1810 + 330 = 2140
    expect(digest.calories.tdeeValidWeeks).toBe(4);
    expect(digest.calories.monthlyTdeeKcal).toBe(Math.round((2400 + 2150 + 2160 + 2140) / 4));
    expect(digest.calories.tdeeMinKcal).toBe(2140);
    expect(digest.calories.tdeeMaxKcal).toBe(2400);
  });

  it("有効週が無ければ月次TDEEはnull(データ蓄積中)", () => {
    const summaries = baseSource().weekSummaries.map((s) => week(s.weekAvgKg, null, { mealRecordedDays: 2 }));
    const digest = buildMonthlyDigest(baseSource({ weekSummaries: summaries }));
    expect(digest.calories.monthlyTdeeKcal).toBeNull();
    expect(digest.calories.tdeeValidWeeks).toBe(0);
    expect(digest.calories.tdeeMinKcal).toBeNull();
  });

  it("カロリー・記録率は月内全日の食事日別合計から集計する", () => {
    const mealDailyTotals = [
      { date: "2026-07-01", kcal: 1800, proteinG: 0, fatG: 0, carbsG: 0 },
      { date: "2026-07-02", kcal: 2000, proteinG: 0, fatG: 0, carbsG: 0 },
      { date: "2026-07-03", kcal: 1900, proteinG: 0, fatG: 0, carbsG: 0 },
    ];
    const digest = buildMonthlyDigest(baseSource({ mealDailyTotals }));
    expect(digest.calories.avgIntakeKcal).toBe(1900);
    expect(digest.calories.recordedDays).toBe(3);
    expect(digest.calories.daysOnTarget).toBe(2); // 目標1900以内は1800・1900の2日
  });

  it("記録した日が月の7割未満ならLOW_RECORDING_RATE、7日未満ならINSUFFICIENT_DATAも立つ", () => {
    // 完了済みの月(today=8/3 > 期間末7/26)。4週=28日。7割=19.6日
    const digest = buildMonthlyDigest(baseSource({ recordedDays: 6 }));
    expect(digest.flags).toContain("LOW_RECORDING_RATE");
    expect(digest.flags).toContain("INSUFFICIENT_DATA");
  });

  it("進行中の当月は経過日数で記録率を測る(序盤に毎日記録していればLOW_RECORDING_RATEを立てない)", () => {
    // today=7/8(期間6/29〜7/26の途中)。経過10日中10日記録 → 記録不足ではない
    const digest = buildMonthlyDigest(baseSource({ today: "2026-07-08", recordedDays: 10 }));
    expect(digest.flags).not.toContain("LOW_RECORDING_RATE");
  });

  it("進行中の当月でも経過日数に対して記録が少なければLOW_RECORDING_RATE(まだ日数はあるが記録が疎)", () => {
    // today=7/24(経過26日)に対し記録10日 → 10 < 26*0.71 → 記録不足
    const digest = buildMonthlyDigest(baseSource({ today: "2026-07-24", recordedDays: 10 }));
    expect(digest.flags).toContain("LOW_RECORDING_RATE");
  });

  it("体重記録が1件も無い月はNO_WEIGHT_DATA", () => {
    const summaries = baseSource().weekSummaries.map((s) => week(null, s.avgIntakeKcal));
    const digest = buildMonthlyDigest(baseSource({ weekSummaries: summaries, latestWeightKg: null }));
    expect(digest.flags).toContain("NO_WEIGHT_DATA");
    expect(digest.weight.endWeekAvgKg).toBeNull();
  });

  it("平均摂取が基礎代謝を下回るとINTAKE_BELOW_BMR", () => {
    const mealDailyTotals = [{ date: "2026-07-01", kcal: 1400, proteinG: 0, fatG: 0, carbsG: 0 }];
    const digest = buildMonthlyDigest(baseSource({ mealDailyTotals, bmrKcal: 1600 }));
    expect(digest.flags).toContain("INTAKE_BELOW_BMR");
  });

  it("月窓のクロス分析を組み込む(Issue #112の集計を月幅で再実行)", () => {
    const mealDailyTotals = [
      { date: "2026-07-06", kcal: 2200, proteinG: 0, fatG: 0, carbsG: 0 },
      { date: "2026-07-08", kcal: 1700, proteinG: 0, fatG: 0, carbsG: 0 },
    ];
    const activityDays = [
      { date: "2026-07-06", sleepMinutes: 300 }, // 睡眠不足 → 当日2200
      { date: "2026-07-08", sleepMinutes: 420 }, // 十分 → 当日1700
    ];
    const digest = buildMonthlyDigest(baseSource({ mealDailyTotals, activityDays }));
    expect(digest.crossAnalysis?.sleepIntake).toEqual({
      thresholdMinutes: 360,
      shortSleepDays: 1,
      sleepRecordedDays: 2,
      avgIntakeOnShortSleepDays: 2200,
      avgIntakeOnOtherDays: 1700,
    });
  });
});
