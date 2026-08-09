import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db/db";
import { getSettings, updateSettings } from "@/db/settings";

describe("InitialSetupPage", () => {
  beforeEach(async () => {
    await db.settings.clear();
  });

  it("初期状態の設定は空である", async () => {
    const settings = await getSettings();
    expect(settings.heightCm).toBeUndefined();
    expect(settings.birthYear).toBeUndefined();
    expect(settings.sex).toBeUndefined();
    expect(settings.activityLevel).toBeUndefined();
    expect(settings.goalWeightKg).toBeUndefined();
    expect(settings.goalDate).toBeUndefined();
    expect(settings.dailyCalorieTarget).toBeUndefined();
  });

  it("プロフィール項目を更新できる", async () => {
    await updateSettings({
      heightCm: 170,
      birthYear: 1990,
      sex: "male",
      activityLevel: 1.55,
    });

    const settings = await getSettings();
    expect(settings.heightCm).toBe(170);
    expect(settings.birthYear).toBe(1990);
    expect(settings.sex).toBe("male");
    expect(settings.activityLevel).toBe(1.55);
  });

  it("目標値を更新できる", async () => {
    await updateSettings({
      goalWeightKg: 65,
      goalDate: "2026-12-31",
      dailyCalorieTarget: 1900,
    });

    const settings = await getSettings();
    expect(settings.goalWeightKg).toBe(65);
    expect(settings.goalDate).toBe("2026-12-31");
    expect(settings.dailyCalorieTarget).toBe(1900);
  });

  it("PFC目標と水分摂取量を更新できる", async () => {
    await updateSettings({
      dailyProteinTargetG: 120,
      dailyFatTargetG: 60,
      dailyCarbsTargetG: 200,
      dailyWaterTargetMl: 2000,
    });

    const settings = await getSettings();
    expect(settings.dailyProteinTargetG).toBe(120);
    expect(settings.dailyFatTargetG).toBe(60);
    expect(settings.dailyCarbsTargetG).toBe(200);
    expect(settings.dailyWaterTargetMl).toBe(2000);
  });

  it("すべての項目が入力されると初回セットアップ完了", async () => {
    await updateSettings({
      heightCm: 170,
      birthYear: 1990,
      sex: "male",
      activityLevel: 1.55,
      goalWeightKg: 65,
      goalDate: "2026-12-31",
      dailyCalorieTarget: 1900,
    });

    const settings = await getSettings();
    const isComplete =
      settings.heightCm !== undefined &&
      settings.birthYear !== undefined &&
      settings.sex !== undefined &&
      settings.activityLevel !== undefined &&
      settings.goalWeightKg !== undefined &&
      settings.goalDate !== undefined &&
      settings.dailyCalorieTarget !== undefined;

    expect(isComplete).toBe(true);
  });

  it("PFC目標と水分摂取量はオプション項目", async () => {
    await updateSettings({
      heightCm: 170,
      birthYear: 1990,
      sex: "male",
      activityLevel: 1.55,
      goalWeightKg: 65,
      goalDate: "2026-12-31",
      dailyCalorieTarget: 1900,
    });

    const settings = await getSettings();
    const isComplete =
      settings.heightCm !== undefined &&
      settings.birthYear !== undefined &&
      settings.sex !== undefined &&
      settings.activityLevel !== undefined &&
      settings.goalWeightKg !== undefined &&
      settings.goalDate !== undefined &&
      settings.dailyCalorieTarget !== undefined;

    expect(isComplete).toBe(true);
    expect(settings.dailyProteinTargetG).toBeUndefined();
    expect(settings.dailyWaterTargetMl).toBeUndefined();
  });
});
