import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { addMealRecord } from "../mealRecords";
import { getMonthlyDigest } from "../monthlyReview";
import { updateSettings } from "../settings";
import { saveWeightRecord } from "../weightRecords";

/**
 * getMonthlyDigest(Issue #114)の統合テスト。集計ロジックの網羅はmonthlyDigest.test.tsが担うので、
 * ここは「レコードの取得と週切り出しが純関数へ正しく繋がる」ことを確認する。
 * 対象月は2026年7月(日曜が7月に落ちる週= 6/29〜7/20週の4週。期間は6/29〜7/26)、「今日」を8/3として注入する。
 */

const MONTH = "2026-07";
const TODAY = "2026-08-03";

beforeEach(async () => {
  await Promise.all([
    db.weightRecords.clear(),
    db.mealRecords.clear(),
    db.diaryRecords.clear(),
    db.waterRecords.clear(),
    db.workoutRecords.clear(),
    db.activityRecords.clear(),
    db.settings.clear(),
    db.syncDeletions.clear(),
  ]);
});

describe("getMonthlyDigest", () => {
  it("記録が1件も無い月はデータ不足フラグ付きの空ダイジェストになる", async () => {
    const digest = await getMonthlyDigest(MONTH, TODAY);
    expect(digest.month).toBe("2026-07");
    expect(digest.period).toEqual({ start: "2026-06-29", end: "2026-07-26" });
    expect(digest.recording.totalDays).toBe(28);
    expect(digest.weight.endWeekAvgKg).toBeNull();
    expect(digest.calories.monthlyTdeeKcal).toBeNull();
    expect(digest.flags).toEqual(["LOW_RECORDING_RATE", "NO_WEIGHT_DATA", "INSUFFICIENT_DATA"]);
  });

  it("複数週の記録から週平均体重の系列と月間ペースを組み立てる", async () => {
    await updateSettings({ goalWeightKg: 73, goalDate: "2026-10-31", dailyCalorieTarget: 1900 });
    // 各週の月曜に体重を記録(週平均=その1件)。6/29→77.0, 7/20→76.25の4週で -0.75kg
    const weekMondays = ["2026-06-29", "2026-07-06", "2026-07-13", "2026-07-20"];
    const weekKgs = [77.0, 76.75, 76.5, 76.25];
    for (let i = 0; i < weekMondays.length; i++) {
      await saveWeightRecord({ date: weekMondays[i], weightKg: weekKgs[i] });
    }

    const digest = await getMonthlyDigest(MONTH, TODAY);
    expect(digest.weeks.map((w) => w.weekStart)).toEqual(weekMondays);
    expect(digest.weeks.map((w) => w.weekAvgKg)).toEqual(weekKgs);
    expect(digest.weight.startWeekAvgKg).toBe(77.0);
    expect(digest.weight.endWeekAvgKg).toBe(76.25);
    expect(digest.weight.monthlyChangeKg).toBe(-0.75);
    // -0.75kg / 3週スパン = -0.25kg/週
    expect(digest.weight.avgWeeklyPaceKg).toBe(-0.25);
    expect(digest.weight.weeksWithData).toBe(4);
  });

  it("月内全日の食事を集計し、期間の端の日付も範囲に含める(週切り出しが期間全体を覆う)", async () => {
    await updateSettings({ goalWeightKg: 73, goalDate: "2026-10-31", dailyCalorieTarget: 1900 });
    // 期間の先頭側(6/29。6月だが最初の週に属する)と末尾側(7/26。最後の週の日曜)も月次に含まれること
    for (const date of ["2026-06-29", "2026-07-15", "2026-07-26"]) {
      await addMealRecord({
        mealType: "lunch",
        confirmedName: "テスト食",
        confirmedKcal: 1800,
        confirmedProteinG: 100,
        confirmedFatG: 50,
        confirmedCarbsG: 180,
        timestamp: new Date(`${date}T12:00:00`).toISOString(),
      });
    }
    const digest = await getMonthlyDigest(MONTH, TODAY);
    expect(digest.calories.recordedDays).toBe(3);
    expect(digest.calories.avgIntakeKcal).toBe(1800);
  });
});
