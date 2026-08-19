import { describe, expect, it } from "vitest";
import {
  MAX_SHARE_CARD_STATS,
  buildDailyShareCard,
  buildWeeklyShareCard,
  hasShareCardContent,
  type DailyShareSource,
} from "../shareCard";
import type { WeeklyDigest } from "@/types";

/** 体重も食事も記録がある標準的な週。個別のテストで必要な部分だけ上書きする */
function weeklyDigest(overrides: Partial<WeeklyDigest> = {}): WeeklyDigest {
  return {
    period: { start: "2026-08-10", end: "2026-08-16" },
    goal: { targetWeightKg: 64, targetDate: "2026-10-31", remainingDays: 76 },
    weight: {
      weekAvgKg: 69.82,
      prevWeekAvgKg: 70.24,
      weeklyChangeKg: -0.42,
      projectedKg: 65.1,
      requiredWeeklyPaceKg: -0.53,
      paceBaseKg: 69.82,
    },
    calories: {
      avgIntakeKcal: 1850.4,
      targetKcal: 2000,
      daysOnTarget: 5,
      recordedDays: 7,
      estimatedTdeeKcal: 2310,
      bmrKcal: 1580,
    },
    pfc: {
      avgProteinG: 92,
      avgFatG: 48,
      avgCarbsG: 210,
      targetProteinG: 110,
      targetFatG: 55,
      targetCarbsG: 230,
    },
    recording: { recordedDays: 7, currentStreakDays: 97 },
    flags: [],
    ...overrides,
  };
}

function dailySource(overrides: Partial<DailyShareSource> = {}): DailyShareSource {
  return {
    date: "2026-08-19",
    weightKg: 69.4,
    previousWeightKg: 69.7,
    intakeKcal: 1820,
    targetKcal: 2000,
    proteinG: 96.4,
    fatG: 47.8,
    carbsG: 203.2,
    waterMl: 1600,
    steps: 8231,
    workoutExercises: 3,
    streakDays: 97,
    ...overrides,
  };
}

describe("buildWeeklyShareCard", () => {
  it("週平均体重を主数値にし、前週比をバッジにする", () => {
    const card = buildWeeklyShareCard(weeklyDigest());

    expect(card.kind).toBe("weekly");
    expect(card.period).toBe("8/10(月) 〜 8/16(日)");
    expect(card.headline).toEqual({ caption: "週平均体重", value: "69.8", unit: "kg" });
    expect(card.badge).toEqual({ text: "前週比 -0.42kg", tone: "down" });
    expect(card.hasWeightValue).toBe(true);
    expect(card.fileDate).toBe("2026-08-10");
  });

  it("体重が増えた週はバッジのtoneがupになり、符号も付く", () => {
    const card = buildWeeklyShareCard(
      weeklyDigest({ weight: { ...weeklyDigest().weight, weeklyChangeKg: 0.15 } }),
    );

    expect(card.badge).toEqual({ text: "前週比 +0.15kg", tone: "up" });
  });

  it("数値は最大4項目までで、3桁区切りと目標の補足が付く", () => {
    const card = buildWeeklyShareCard(weeklyDigest({ activity: { avgSteps: 8231, avgTotalKcal: 2400, avgSleepMinutes: 380, recordedDays: 7 } }));

    expect(card.stats).toHaveLength(MAX_SHARE_CARD_STATS);
    expect(card.stats[0]).toEqual({ label: "平均摂取", value: "1,850", unit: "kcal", sub: "目標 2,000" });
    expect(card.stats[1]).toEqual({ label: "記録した日", value: "7/7", unit: "日" });
    expect(card.stats[2]).toEqual({ label: "連続記録", value: "97", unit: "日" });
    expect(card.stats[3]).toEqual({ label: "平均歩数", value: "8,231", unit: "歩" });
  });

  it("体重を隠す指定では、主数値が前週比になり体重の実数も目標までの残りも出さない", () => {
    const card = buildWeeklyShareCard(weeklyDigest(), { hideWeightValue: true });

    expect(card.headline).toEqual({ caption: "週平均体重の前週比", value: "-0.42", unit: "kg" });
    expect(card.badge).toBeNull();
    // 隠していても「体重の実数を含みうる週か」は変わらない(トグルの表示判定に使うため)
    expect(card.hasWeightValue).toBe(true);
    expect(card.stats.map((stat) => stat.label)).not.toContain("目標まで");
    expect(JSON.stringify(card)).not.toContain("69.8");
  });

  it("目標体重があり基準体重が上回っていれば「目標まで」を出す", () => {
    const card = buildWeeklyShareCard(
      weeklyDigest({ recording: { recordedDays: 7, currentStreakDays: 0 }, calories: { ...weeklyDigest().calories, avgIntakeKcal: null } }),
    );

    expect(card.stats).toContainEqual({ label: "目標まで", value: "5.8", unit: "kg" });
  });

  it("体重記録が無い週は平均摂取を主数値にする", () => {
    const card = buildWeeklyShareCard(
      weeklyDigest({
        weight: { weekAvgKg: null, prevWeekAvgKg: null, weeklyChangeKg: null, projectedKg: null, requiredWeeklyPaceKg: 0, paceBaseKg: null },
      }),
    );

    expect(card.headline).toEqual({ caption: "1日の平均摂取", value: "1,850", unit: "kcal" });
    expect(card.hasWeightValue).toBe(false);
    // 主数値に使った項目を数値欄で繰り返さない
    expect(card.stats.map((stat) => stat.label)).not.toContain("平均摂取");
  });

  it("記録が1件も無い週は主数値がnullになる(共有導線を出さない判定に使う)", () => {
    const card = buildWeeklyShareCard(
      weeklyDigest({
        weight: { weekAvgKg: null, prevWeekAvgKg: null, weeklyChangeKg: null, projectedKg: null, requiredWeeklyPaceKg: 0, paceBaseKg: null },
        calories: { avgIntakeKcal: null, targetKcal: null, daysOnTarget: null, recordedDays: 0, estimatedTdeeKcal: null, bmrKcal: null },
        recording: { recordedDays: 0, currentStreakDays: 0 },
      }),
    );

    expect(card.headline).toBeNull();
  });
});

describe("buildDailyShareCard", () => {
  it("体重を主数値にし、前回比をバッジにする", () => {
    const card = buildDailyShareCard(dailySource());

    expect(card.kind).toBe("daily");
    expect(card.period).toBe("8月19日(水)");
    expect(card.headline).toEqual({ caption: "今日の体重", value: "69.4", unit: "kg" });
    expect(card.badge).toEqual({ text: "前回比 -0.30kg", tone: "down" });
    expect(card.stats.slice(0, 3)).toEqual([
      { label: "摂取カロリー", value: "1,820", unit: "kcal", sub: "目標 2,000" },
      { label: "PFC", value: "96/48/203", unit: "g" },
      { label: "水分", value: "1,600", unit: "ml" },
    ]);
    expect(card.fileDate).toBe("2026-08-19");
  });

  it("体重を隠す指定では前回比だけを残す", () => {
    const card = buildDailyShareCard(dailySource(), { hideWeightValue: true });

    expect(card.headline).toEqual({ caption: "体重の前回比", value: "-0.30", unit: "kg" });
    expect(card.badge).toBeNull();
    expect(JSON.stringify(card)).not.toContain("69.4");
  });

  it("体重の記録が無い日は摂取カロリーを主数値にする", () => {
    const card = buildDailyShareCard(dailySource({ weightKg: null, previousWeightKg: 69.7 }));

    expect(card.headline).toEqual({ caption: "今日の摂取", value: "1,820", unit: "kcal" });
    expect(card.hasWeightValue).toBe(false);
    expect(card.stats.map((stat) => stat.label)).not.toContain("摂取カロリー");
  });

  it("記録の無い項目は数値欄に出さない", () => {
    const card = buildDailyShareCard(
      dailySource({ waterMl: null, steps: null, workoutExercises: 0, streakDays: 0 }),
    );

    expect(card.stats.map((stat) => stat.label)).toEqual(["摂取カロリー", "PFC"]);
  });

  it("何も記録が無い日は主数値がnullになる", () => {
    const card = buildDailyShareCard(
      dailySource({
        weightKg: null,
        previousWeightKg: null,
        intakeKcal: null,
        proteinG: null,
        fatG: null,
        carbsG: null,
        waterMl: null,
        steps: null,
        workoutExercises: 0,
        streakDays: 0,
      }),
    );

    expect(card.headline).toBeNull();
    expect(card.stats).toEqual([]);
  });
});

describe("hasShareCardContent", () => {
  it("主数値(体重・摂取カロリー等)が無くても、水分や歩数だけの記録があれば導線を出す", () => {
    // 体重も食事も未記録で、水分と歩数だけ記録した日(headlineはnullになるが、共有すべき数字はある)
    const card = buildDailyShareCard(
      dailySource({
        weightKg: null,
        previousWeightKg: null,
        intakeKcal: null,
        proteinG: null,
        fatG: null,
        carbsG: null,
        workoutExercises: 0,
        streakDays: 0,
      }),
    );

    expect(card.headline).toBeNull();
    expect(card.stats.length).toBeGreaterThan(0);
    expect(hasShareCardContent(card)).toBe(true);
  });

  it("何も記録が無ければ導線を出さない", () => {
    const card = buildDailyShareCard(
      dailySource({
        weightKg: null,
        previousWeightKg: null,
        intakeKcal: null,
        proteinG: null,
        fatG: null,
        carbsG: null,
        waterMl: null,
        steps: null,
        workoutExercises: 0,
        streakDays: 0,
      }),
    );

    expect(hasShareCardContent(card)).toBe(false);
  });
});
