import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import { saveWeightRecord } from "@/db/weightRecords";
import { addMealRecord } from "@/db/mealRecords";
import { updateSettings } from "@/db/settings";
import { exportBackupData, importBackupData } from "@/db/backup";

beforeEach(async () => {
  await db.weightRecords.clear();
  await db.mealRecords.clear();
  await db.settings.clear();
});

describe("backup", () => {
  it("exports all records together with current settings", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });
    await addMealRecord({
      mealType: "lunch",
      confirmedName: "鶏肉と野菜炒め",
      confirmedKcal: 580,
      confirmedProteinG: 40,
      confirmedFatG: 20,
      confirmedCarbsG: 50,
    });
    await updateSettings({ goalWeightKg: 63 });

    const data = await exportBackupData();
    expect(data.weightRecords).toHaveLength(1);
    expect(data.mealRecords).toHaveLength(1);
    expect(data.settings.goalWeightKg).toBe(63);
  });

  it("replaces all existing data on import", async () => {
    await saveWeightRecord({ date: "2026-01-01", weightKg: 80 });

    await importBackupData({
      exportedAt: "2026-07-01T00:00:00.000Z",
      weightRecords: [
        {
          id: "2026-07-01",
          date: "2026-07-01",
          timestamp: "2026-07-01T08:00:00.000Z",
          weightKg: 72.1,
          synced: false,
        },
      ],
      mealRecords: [],
      settings: { goalWeightKg: 64, goalDate: "2026-10-31", dailyCalorieTarget: 1900 },
    });

    const weightRecords = await db.weightRecords.toArray();
    expect(weightRecords).toHaveLength(1);
    expect(weightRecords[0].date).toBe("2026-07-01");
  });
});
