import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import { getPendingDeletionIds } from "@/db/syncDeletions";
import {
  getAllWorkoutRecordsDesc,
  getUnsyncedWorkoutRecords,
  getWorkoutRecordsForDate,
  groupWorkoutRecordsByExercise,
  markWorkoutRecordsSynced,
  replaceWorkoutRecordsForDate,
} from "@/db/workoutRecords";

beforeEach(async () => {
  await db.workoutRecords.clear();
  await db.syncDeletions.clear();
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

  it("enqueues a sync tombstone for each replaced record's old id (new ids get re-added fresh)", async () => {
    await replaceWorkoutRecordsForDate("2026-07-01", [
      { name: "ベンチプレス", sets: [{ weightKg: 60, reps: 10 }, { weightKg: 60, reps: 8 }] },
    ]);
    expect(await getPendingDeletionIds("workout")).toEqual([]);

    await replaceWorkoutRecordsForDate("2026-07-01", [
      { name: "ベンチプレス", sets: [{ weightKg: 60, reps: 10 }] },
    ]);
    // 置き換えのたびに全セットへ新しいIDを振り直すため、置き換え前の2件分のIDがトゥームストーンとして残る
    expect(await getPendingDeletionIds("workout")).toHaveLength(2);
  });

  it("does not enqueue a tombstone the first time a date is saved (no prior records to replace)", async () => {
    await replaceWorkoutRecordsForDate("2026-07-01", [
      { name: "ベンチプレス", sets: [{ weightKg: 60, reps: 10 }] },
    ]);

    expect(await getPendingDeletionIds("workout")).toEqual([]);
  });

  it("lists only unsynced records and marks them synced", async () => {
    await replaceWorkoutRecordsForDate("2026-07-01", [
      { name: "ベンチプレス", sets: [{ weightKg: 60, reps: 10 }] },
    ]);
    const records = await getWorkoutRecordsForDate("2026-07-01");

    expect((await getUnsyncedWorkoutRecords()).map((r) => r.id)).toEqual([records[0].id]);

    await markWorkoutRecordsSynced([records[0].id]);
    expect(await getUnsyncedWorkoutRecords()).toHaveLength(0);
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

  it("returns all records date-descending for the history view", async () => {
    await replaceWorkoutRecordsForDate("2026-07-01", [{ name: "ベンチプレス", sets: [{ weightKg: 60, reps: 10 }] }]);
    await replaceWorkoutRecordsForDate("2026-07-03", [{ name: "スクワット", sets: [{ weightKg: 80, reps: 8 }] }]);

    const records = await getAllWorkoutRecordsDesc();
    expect(records.map((r) => r.date)).toEqual(["2026-07-03", "2026-07-01"]);
  });

});
