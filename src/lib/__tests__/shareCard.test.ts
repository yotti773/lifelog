import { describe, expect, it } from "vitest";
import {
  MAX_SHARE_CARD_DETAIL_ROWS,
  MAX_SHARE_CARD_STATS,
  buildDailyShareCard,
  buildWeeklyShareCard,
  hasShareCardContent,
  summarizeWorkoutSets,
  type DailyShareSource,
  type DailyWorkoutSet,
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
    workoutSets: [
      ...[1, 2, 3].map((setNumber) => ({ exerciseName: "ベンチプレス", exerciseOrder: 1, setNumber, weightKg: 60, reps: 8 })),
      ...[1, 2, 3].map((setNumber) => ({ exerciseName: "スクワット", exerciseOrder: 2, setNumber, weightKg: 80, reps: 5 })),
    ],
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
    // 見出しの「今日の」は表示日が当日かどうかで変わる(#226)。todayを渡さないと
    // 実行日が2026-08-19のときだけ通るテストになるため、必ず明示する
    const card = buildDailyShareCard(dailySource(), { today: "2026-08-19" });

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
    const card = buildDailyShareCard(dailySource({ weightKg: null, previousWeightKg: 69.7 }), {
      today: "2026-08-19",
    });

    expect(card.headline).toEqual({ caption: "今日の摂取", value: "1,820", unit: "kcal" });
    expect(card.hasWeightValue).toBe(false);
    expect(card.stats.map((stat) => stat.label)).not.toContain("摂取カロリー");
  });

  it("記録の無い項目は数値欄に出さない", () => {
    const card = buildDailyShareCard(
      dailySource({ waterMl: null, steps: null, workoutSets: [], streakDays: 0 }),
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
        workoutSets: [],
        streakDays: 0,
      }),
    );

    expect(card.headline).toBeNull();
    expect(card.stats).toEqual([]);
  });
});

describe("過去日の日次カード(Issue #226)", () => {
  it("表示日が今日でなければ「今日の」と言わない", () => {
    const card = buildDailyShareCard(dailySource({ date: "2026-08-18" }), { today: "2026-08-19" });

    expect(card.title).toBe("この日の記録");
    expect(card.headline?.caption).toBe("この日の体重");
    expect(card.period).toBe("8月18日(火)");
    expect(card.fileDate).toBe("2026-08-18");
  });

  it("体重が無い過去日は摂取カロリーを主数値にし、数値欄では繰り返さない", () => {
    const card = buildDailyShareCard(
      dailySource({ date: "2026-08-18", weightKg: null, previousWeightKg: null }),
      { today: "2026-08-19" },
    );

    expect(card.headline).toEqual({ caption: "この日の摂取", value: "1,820", unit: "kcal" });
    expect(card.stats.map((stat) => stat.label)).not.toContain("摂取カロリー");
  });

  it("表示日が今日なら従来どおりの文言", () => {
    const card = buildDailyShareCard(dailySource(), { today: "2026-08-19" });

    expect(card.title).toBe("今日の記録");
    expect(card.headline?.caption).toBe("今日の体重");
  });
});

describe("筋トレの明細(日次)", () => {
  /** 種目名・重量・回数から、セット数分のレコードを作る */
  function sets(
    exerciseName: string,
    exerciseOrder: number,
    load: { weightKg: number; reps: number }[],
  ): DailyWorkoutSet[] {
    return load.map((l, i) => ({ exerciseName, exerciseOrder, setNumber: i + 1, ...l }));
  }

  it("種目ごとに重量×回数とセット数をまとめる", () => {
    const card = buildDailyShareCard(dailySource());

    expect(card.details).toEqual({
      title: "筋トレ",
      subtitle: "2種目・6セット",
      rows: [
        { label: "ベンチプレス", value: "60kg×8回 3セット" },
        { label: "スクワット", value: "80kg×5回 3セット" },
      ],
      note: undefined,
    });
    // 明細に出すため、数値欄には「◯種目」を重ねて出さない
    expect(card.stats.map((stat) => stat.label)).not.toContain("筋トレ");
  });

  it("セットごとに重量・回数が違う種目は範囲で示す", () => {
    const rows = summarizeWorkoutSets(
      sets("ベンチプレス", 1, [
        { weightKg: 50, reps: 10 },
        { weightKg: 60, reps: 8 },
        { weightKg: 60, reps: 6 },
      ]),
    );

    expect(rows).toEqual([{ exerciseName: "ベンチプレス", setCount: 3, loadText: "50〜60kg×6〜10回" }]);
  });

  it("重量0のセットは自重として示し、重量の末尾の.0は出さない", () => {
    const rows = summarizeWorkoutSets([
      ...sets("腕立て伏せ", 1, [{ weightKg: 0, reps: 20 }]),
      ...sets("ダンベルカール", 2, [{ weightKg: 12.5, reps: 10 }]),
    ]);

    expect(rows.map((row) => row.loadText)).toEqual(["自重×20回", "12.5kg×10回"]);
  });

  it("同じ種目名でも別カード(exerciseOrderが違う)なら別の行にする", () => {
    const rows = summarizeWorkoutSets([
      ...sets("ベンチプレス", 1, [{ weightKg: 60, reps: 8 }]),
      ...sets("ベンチプレス", 2, [{ weightKg: 40, reps: 15 }]),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.loadText)).toEqual(["60kg×8回", "40kg×15回"]);
  });

  it("入力の並びが崩れていてもexerciseOrder・setNumber順にまとめ直す", () => {
    const rows = summarizeWorkoutSets([
      { exerciseName: "スクワット", exerciseOrder: 2, setNumber: 1, weightKg: 80, reps: 5 },
      { exerciseName: "ベンチプレス", exerciseOrder: 1, setNumber: 2, weightKg: 60, reps: 8 },
      { exerciseName: "ベンチプレス", exerciseOrder: 1, setNumber: 1, weightKg: 60, reps: 8 },
    ]);

    expect(rows.map((row) => row.exerciseName)).toEqual(["ベンチプレス", "スクワット"]);
    expect(rows[0].setCount).toBe(2);
  });

  it("種目が多い日は行数の上限で打ち切り、残りは「ほか◯種目」にまとめる", () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      sets(`種目${i + 1}`, i + 1, [{ weightKg: 40, reps: 10 }]),
    ).flat();

    const card = buildDailyShareCard(dailySource({ workoutSets: many }));

    expect(card.details?.subtitle).toBe("6種目・6セット");
    expect(card.details?.rows).toHaveLength(MAX_SHARE_CARD_DETAIL_ROWS - 1);
    expect(card.details?.note).toBe("ほか3種目");
  });

  it("上限ちょうどの種目数なら「ほか」を出さずに全部載せる", () => {
    const exact = Array.from({ length: MAX_SHARE_CARD_DETAIL_ROWS }, (_, i) =>
      sets(`種目${i + 1}`, i + 1, [{ weightKg: 40, reps: 10 }]),
    ).flat();

    const card = buildDailyShareCard(dailySource({ workoutSets: exact }));

    expect(card.details?.rows).toHaveLength(MAX_SHARE_CARD_DETAIL_ROWS);
    expect(card.details?.note).toBeUndefined();
  });

  it("筋トレの記録が無い日は明細を出さない", () => {
    expect(buildDailyShareCard(dailySource({ workoutSets: [] })).details).toBeNull();
    // 週次カードは種目ごとの内訳を持たない
    expect(buildWeeklyShareCard(weeklyDigest()).details).toBeNull();
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
        workoutSets: [],
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
        workoutSets: [],
        streakDays: 0,
      }),
    );

    expect(hasShareCardContent(card)).toBe(false);
  });
});

describe("連続記録の置き場所(Issue #258)", () => {
  it("日次は数値欄に出さず、日付行の文言として持つ(当日は「記録中」を付ける)", () => {
    const card = buildDailyShareCard(dailySource(), { today: "2026-08-19" });

    expect(card.stats.map((stat) => stat.label)).not.toContain("連続記録");
    expect(card.streak).toBe("連続97日記録中");
  });

  it("歩数が取り込まれている日でも連続記録が消えない(数値欄の4枠から押し出されない)", () => {
    const card = buildDailyShareCard(dailySource({ steps: 12345 }), { today: "2026-08-19" });

    // 数値欄は上限まで埋まっている状態
    expect(card.stats).toHaveLength(MAX_SHARE_CARD_STATS);
    expect(card.stats.map((stat) => stat.label)).toEqual(["摂取カロリー", "PFC", "水分", "歩数"]);
    expect(card.streak).toBe("連続97日記録中");
  });

  it("過去日は「記録中」を付けない", () => {
    const card = buildDailyShareCard(dailySource({ date: "2026-08-18" }), { today: "2026-08-19" });

    expect(card.streak).toBe("連続97日");
  });

  it("連続が切れている日は出さない", () => {
    const card = buildDailyShareCard(dailySource({ streakDays: 0 }), { today: "2026-08-19" });

    expect(card.streak).toBeNull();
  });

  it("その日の記録がまだ無くても、連続が続いていれば共有導線を出す", () => {
    // 今日まだ記録していない状態(currentStreakDaysは昨日までの連続を継続中として返す)
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
        workoutSets: [],
        streakDays: 97,
      }),
      { today: "2026-08-19" },
    );

    expect(card.headline).toBeNull();
    expect(card.stats).toEqual([]);
    expect(hasShareCardContent(card)).toBe(true);
  });

  it("週次は据え置きで、連続記録は数値欄に残す(今日時点の値で、その週の値ではないため)", () => {
    const card = buildWeeklyShareCard(weeklyDigest());

    expect(card.streak).toBeNull();
    expect(card.stats).toContainEqual({ label: "連続記録", value: "97", unit: "日" });
  });
});
