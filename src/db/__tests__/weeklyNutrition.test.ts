import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { addMealRecord } from "../mealRecords";
import { saveWeightRecord } from "../weightRecords";
import {
  getMealDailyTotalsForWeek,
  getMeasuredTdeeAsOfWeek,
  getWeeklyNutritionSummary,
} from "../weeklyNutrition";
import { addDaysToDateString } from "@/lib/date";

// 2026-07-06(月)〜07-12(日)を対象週とする
const WEEK_START = "2026-07-06";
const PREV_WEEK_START = "2026-06-29";

async function addMealOn(date: string, kcal: number, pfc: [number, number, number] = [10, 5, 20]) {
  await addMealRecord({
    mealType: "lunch",
    confirmedName: "テスト食",
    confirmedKcal: kcal,
    confirmedProteinG: pfc[0],
    confirmedFatG: pfc[1],
    confirmedCarbsG: pfc[2],
    timestamp: new Date(`${date}T12:00:00`).toISOString(),
  });
}

/** 週7日に体重と食事を規則的に入れる(有効週の条件を満たす) */
async function seedFullWeek(weekStart: string, weightKg: number, dailyKcal: number) {
  for (let i = 0; i < 7; i++) {
    const date = addDaysToDateString(weekStart, i);
    await saveWeightRecord({ date, weightKg });
    await addMealOn(date, dailyKcal);
  }
}

beforeEach(async () => {
  await db.weightRecords.clear();
  await db.mealRecords.clear();
  await db.syncDeletions.clear();
});

describe("getMealDailyTotalsForWeek", () => {
  it("週内の食事を日別に合算し、記録がある日だけを日付昇順で返す", async () => {
    await addMealOn("2026-07-07", 500, [20, 10, 60]);
    await addMealOn("2026-07-07", 300, [10, 5, 40]);
    await addMealOn("2026-07-10", 700);
    await addMealOn("2026-07-05", 999); // 前週の日曜は含まれない
    await addMealOn("2026-07-13", 999); // 翌週の月曜は含まれない

    const totals = await getMealDailyTotalsForWeek(WEEK_START);
    expect(totals.map((t) => t.date)).toEqual(["2026-07-07", "2026-07-10"]);
    expect(totals[0]).toEqual({ date: "2026-07-07", kcal: 800, proteinG: 30, fatG: 15, carbsG: 100 });
  });
});

describe("getWeeklyNutritionSummary", () => {
  it("平均摂取kcal・食事記録日数・体重件数・週平均体重を集計する", async () => {
    await saveWeightRecord({ date: "2026-07-06", weightKg: 71.0 });
    await saveWeightRecord({ date: "2026-07-09", weightKg: 71.8 });
    await addMealOn("2026-07-06", 1800);
    await addMealOn("2026-07-07", 2000);

    const summary = await getWeeklyNutritionSummary(WEEK_START);
    expect(summary).toEqual({
      avgIntakeKcal: 1900,
      mealRecordedDays: 2,
      weightCount: 2,
      weekAvgKg: 71.4,
    });
  });

  it("記録が無い週はnull・0で返す", async () => {
    const summary = await getWeeklyNutritionSummary(WEEK_START);
    expect(summary).toEqual({ avgIntakeKcal: null, mealRecordedDays: 0, weightCount: 0, weekAvgKg: null });
  });
});

describe("getMeasuredTdeeAsOfWeek", () => {
  it("有効週があれば逆算TDEEを返す(前週比-0.5kg/摂取1850kcal → 2400kcal)", async () => {
    await seedFullWeek(PREV_WEEK_START, 71.9, 1800);
    await seedFullWeek(WEEK_START, 71.4, 1850);

    // 対象週: 変化-0.5kg → 1850+550=2400。前週: さらに前の週が無く無効なので対象週のみが有効週
    expect(await getMeasuredTdeeAsOfWeek(WEEK_START)).toBe(2400);
  });

  it("直近の有効週 最大3週で平滑化する", async () => {
    // 4週連続で -0.5kg/週・摂取1850 → 週次TDEEは毎週2400
    let weight = 73.4;
    for (let w = -4; w <= 0; w++) {
      await seedFullWeek(addDaysToDateString(WEEK_START, 7 * w), weight, 1850);
      weight -= 0.5;
    }
    expect(await getMeasuredTdeeAsOfWeek(WEEK_START)).toBe(2400);
  });

  it("有効週が無ければnull(データ蓄積中)", async () => {
    // 食事記録が4日しか無い週は無効
    for (let i = 0; i < 7; i++) {
      const date = addDaysToDateString(WEEK_START, i);
      await saveWeightRecord({ date, weightKg: 71 });
      if (i < 4) await addMealOn(date, 1800);
    }
    await saveWeightRecord({ date: PREV_WEEK_START, weightKg: 71.5 });
    await saveWeightRecord({ date: addDaysToDateString(PREV_WEEK_START, 1), weightKg: 71.5 });

    expect(await getMeasuredTdeeAsOfWeek(WEEK_START)).toBeNull();
  });
});
