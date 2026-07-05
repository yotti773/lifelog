import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import { getSettings, updateSettings } from "@/db/settings";

beforeEach(async () => {
  await db.settings.clear();
});

describe("settings", () => {
  it("returns the requirements-doc defaults when nothing is saved yet", async () => {
    const settings = await getSettings();
    expect(settings).toEqual({
      goalWeightKg: 64,
      goalDate: "2026-10-31",
      dailyCalorieTarget: 1900,
    });
  });

  it("persists partial updates merged with the current values", async () => {
    await updateSettings({ goalWeightKg: 63 });

    const settings = await getSettings();
    expect(settings.goalWeightKg).toBe(63);
    expect(settings.goalDate).toBe("2026-10-31");
  });

  it("persists a baseline date for the progress bar's starting point", async () => {
    await updateSettings({ baselineDate: "2026-05-01" });

    const settings = await getSettings();
    expect(settings.baselineDate).toBe("2026-05-01");
  });
});
