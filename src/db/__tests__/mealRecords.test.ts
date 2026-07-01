import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import {
  addMealRecord,
  deleteMealRecord,
  getAllMealRecords,
  getDailyCalorieTotals,
  getMealRecordsByDateRange,
  getUnsyncedMealRecords,
  markMealRecordsSynced,
  updateMealRecord,
} from "../mealRecords";

beforeEach(async () => {
  await db.mealRecords.clear();
});

describe("mealRecords", () => {
  it("adds a meal record with a generated id and PFC values", async () => {
    const record = await addMealRecord({
      mealType: "breakfast",
      confirmedName: "トースト+卵",
      confirmedKcal: 420,
      confirmedProteinG: 18,
      confirmedFatG: 16,
      confirmedCarbsG: 45,
      timestamp: "2026-07-01T07:30:00.000Z",
    });

    expect(record.id).toBeTruthy();
    expect(record.confirmedProteinG).toBe(18);
    expect(record.confirmedFatG).toBe(16);
    expect(record.confirmedCarbsG).toBe(45);
    expect(record.synced).toBe(false);
    expect(await getAllMealRecords()).toHaveLength(1);
  });

  it("allows multiple records for the same mealType", async () => {
    await addMealRecord({
      mealType: "lunch",
      confirmedName: "鶏肉と野菜炒め",
      confirmedKcal: 580,
      confirmedProteinG: 40,
      confirmedFatG: 20,
      confirmedCarbsG: 50,
      timestamp: "2026-07-01T12:15:00.000Z",
    });
    await addMealRecord({
      mealType: "lunch",
      confirmedName: "サラダ",
      confirmedKcal: 120,
      confirmedProteinG: 3,
      confirmedFatG: 8,
      confirmedCarbsG: 10,
      timestamp: "2026-07-01T12:20:00.000Z",
    });

    const all = await getAllMealRecords();
    expect(all).toHaveLength(2);
    expect(all.every((r) => r.mealType === "lunch")).toBe(true);
  });

  it("filters records by date range", async () => {
    await addMealRecord({
      mealType: "breakfast",
      confirmedName: "トースト",
      confirmedKcal: 300,
      confirmedProteinG: 8,
      confirmedFatG: 10,
      confirmedCarbsG: 40,
      timestamp: "2026-06-30T07:00:00.000Z",
    });
    await addMealRecord({
      mealType: "lunch",
      confirmedName: "鶏肉と野菜炒め",
      confirmedKcal: 580,
      confirmedProteinG: 40,
      confirmedFatG: 20,
      confirmedCarbsG: 50,
      timestamp: "2026-07-01T12:15:00.000Z",
    });
    await addMealRecord({
      mealType: "dinner",
      confirmedName: "焼き魚",
      confirmedKcal: 450,
      confirmedProteinG: 35,
      confirmedFatG: 18,
      confirmedCarbsG: 30,
      timestamp: "2026-07-02T19:00:00.000Z",
    });

    const inRange = await getMealRecordsByDateRange("2026-07-01", "2026-07-01");
    expect(inRange).toHaveLength(1);
    expect(inRange[0].confirmedName).toBe("鶏肉と野菜炒め");
  });

  it("updates a record (e.g. correcting the AI-estimated calories/PFC)", async () => {
    const record = await addMealRecord({
      mealType: "snack",
      confirmedName: "AI判定中",
      confirmedKcal: 200,
      confirmedProteinG: 2,
      confirmedFatG: 10,
      confirmedCarbsG: 25,
    });

    const updated = await updateMealRecord(record.id, {
      confirmedName: "ポテトチップス",
      confirmedKcal: 250,
      confirmedFatG: 15,
    });
    expect(updated.confirmedName).toBe("ポテトチップス");
    expect(updated.confirmedKcal).toBe(250);
    expect(updated.confirmedFatG).toBe(15);
  });

  it("resets the synced flag when a record is updated", async () => {
    const record = await addMealRecord({
      mealType: "snack",
      confirmedName: "x",
      confirmedKcal: 1,
      confirmedProteinG: 0,
      confirmedFatG: 0,
      confirmedCarbsG: 0,
    });
    await markMealRecordsSynced([record.id]);

    const updated = await updateMealRecord(record.id, { confirmedKcal: 2 });
    expect(updated.synced).toBe(false);
  });

  it("throws when updating a record that doesn't exist", async () => {
    await expect(updateMealRecord("missing-id", { confirmedKcal: 1 })).rejects.toThrow();
  });

  it("deletes a record", async () => {
    const record = await addMealRecord({
      mealType: "snack",
      confirmedName: "x",
      confirmedKcal: 1,
      confirmedProteinG: 0,
      confirmedFatG: 0,
      confirmedCarbsG: 0,
    });
    await deleteMealRecord(record.id);

    expect(await getAllMealRecords()).toHaveLength(0);
  });

  it("lists only unsynced records and marks them synced", async () => {
    const a = await addMealRecord({
      mealType: "breakfast",
      confirmedName: "A",
      confirmedKcal: 100,
      confirmedProteinG: 1,
      confirmedFatG: 1,
      confirmedCarbsG: 1,
    });
    const b = await addMealRecord({
      mealType: "lunch",
      confirmedName: "B",
      confirmedKcal: 200,
      confirmedProteinG: 2,
      confirmedFatG: 2,
      confirmedCarbsG: 2,
    });

    expect((await getUnsyncedMealRecords()).map((r) => r.id).sort()).toEqual([a.id, b.id].sort());

    await markMealRecordsSynced([a.id]);
    const unsynced = await getUnsyncedMealRecords();
    expect(unsynced.map((r) => r.id)).toEqual([b.id]);
  });

  it("aggregates daily calorie totals, including 0kcal for days without records", async () => {
    await addMealRecord({
      mealType: "breakfast",
      confirmedName: "トースト",
      confirmedKcal: 300,
      confirmedProteinG: 8,
      confirmedFatG: 10,
      confirmedCarbsG: 40,
      timestamp: "2026-07-01T07:00:00.000Z",
    });
    await addMealRecord({
      mealType: "lunch",
      confirmedName: "鶏肉と野菜炒め",
      confirmedKcal: 580,
      confirmedProteinG: 40,
      confirmedFatG: 20,
      confirmedCarbsG: 50,
      timestamp: "2026-07-01T12:15:00.000Z",
    });
    await addMealRecord({
      mealType: "dinner",
      confirmedName: "焼き魚",
      confirmedKcal: 450,
      confirmedProteinG: 35,
      confirmedFatG: 18,
      confirmedCarbsG: 30,
      timestamp: "2026-07-03T19:00:00.000Z",
    });

    const totals = await getDailyCalorieTotals("2026-07-01", "2026-07-03");
    expect(totals).toEqual([
      { date: "2026-07-01", kcal: 880 },
      { date: "2026-07-02", kcal: 0 },
      { date: "2026-07-03", kcal: 450 },
    ]);
  });
});
