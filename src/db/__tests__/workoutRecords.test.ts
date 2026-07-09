import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import {
  getWorkoutRecordsForDate,
  groupWorkoutRecordsByExercise,
  replaceWorkoutRecordsForDate,
} from "@/db/workoutRecords";

beforeEach(async () => {
  await db.workoutRecords.clear();
});

describe("workoutRecords", () => {
  it("saves one record per set with exercise/set order", async () => {
    await replaceWorkoutRecordsForDate("2026-07-01", [
      { name: "ベンチプレス", sets: [{ weightKg: 60, reps: 10 }, { weightKg: 60, reps: 8 }] },
      { name: "スクワット", sets: [{ weightKg: 80, reps: 5 }] },
    ]);

    const records = await getWorkoutRecordsForDate("2026-07-01");
    expect(records).toHaveLength(3);
    expect(records.map((r) => [r.exerciseName, r.exerciseOrder, r.setNumber, r.weightKg, r.reps])).toEqual([
      ["ベンチプレス", 1, 1, 60, 10],
      ["ベンチプレス", 1, 2, 60, 8],
      ["スクワット", 2, 1, 80, 5],
    ]);
    expect(records.every((r) => !r.synced)).toBe(true);
  });

  it("replaces the whole day on save instead of appending", async () => {
    await replaceWorkoutRecordsForDate("2026-07-01", [
      { name: "ベンチプレス", sets: [{ weightKg: 60, reps: 10 }] },
    ]);
    await replaceWorkoutRecordsForDate("2026-07-01", [
      { name: "デッドリフト", sets: [{ weightKg: 100, reps: 5 }, { weightKg: 100, reps: 5 }] },
    ]);

    const records = await getWorkoutRecordsForDate("2026-07-01");
    expect(records.map((r) => r.exerciseName)).toEqual(["デッドリフト", "デッドリフト"]);
  });

  it("does not touch records of other dates when replacing", async () => {
    await replaceWorkoutRecordsForDate("2026-07-01", [
      { name: "ベンチプレス", sets: [{ weightKg: 60, reps: 10 }] },
    ]);
    await replaceWorkoutRecordsForDate("2026-07-02", []);

    expect(await getWorkoutRecordsForDate("2026-07-01")).toHaveLength(1);
    expect(await getWorkoutRecordsForDate("2026-07-02")).toHaveLength(0);
  });

  it("deletes the day's records when saving an empty list", async () => {
    await replaceWorkoutRecordsForDate("2026-07-01", [
      { name: "ベンチプレス", sets: [{ weightKg: 60, reps: 10 }] },
    ]);
    await replaceWorkoutRecordsForDate("2026-07-01", []);

    expect(await getWorkoutRecordsForDate("2026-07-01")).toHaveLength(0);
  });

  it("groups records back into exercises preserving order", async () => {
    await replaceWorkoutRecordsForDate("2026-07-01", [
      { name: "ベンチプレス", sets: [{ weightKg: 60, reps: 10 }, { weightKg: 55, reps: 12 }] },
      { name: "ラットプルダウン", sets: [{ weightKg: 45, reps: 12 }] },
    ]);

    const grouped = groupWorkoutRecordsByExercise(await getWorkoutRecordsForDate("2026-07-01"));
    expect(grouped.map((e) => e.name)).toEqual(["ベンチプレス", "ラットプルダウン"]);
    expect(grouped[0].sets.map((s) => s.weightKg)).toEqual([60, 55]);
    expect(grouped[1].sets.map((s) => s.reps)).toEqual([12]);
  });
});
