import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import {
  deleteWeightRecord,
  getAllWeightRecords,
  getUnsyncedWeightRecords,
  getWeightRecord,
  getWeightRecordsByDateRange,
  markWeightRecordsSynced,
  saveWeightRecord,
  updateWeightRecord,
} from "../weightRecords";

beforeEach(async () => {
  await db.weightRecords.clear();
});

describe("weightRecords", () => {
  it("saves and retrieves a record by date", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });

    const record = await getWeightRecord("2026-07-01");
    expect(record?.date).toBe("2026-07-01");
    expect(record?.weightKg).toBe(72.1);
  });

  it("saves and retrieves an optional body fat percent", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1, bodyFatPercent: 24.5 });

    const record = await getWeightRecord("2026-07-01");
    expect(record?.bodyFatPercent).toBe(24.5);
  });

  it("leaves body fat percent undefined when not provided", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });

    const record = await getWeightRecord("2026-07-01");
    expect(record?.bodyFatPercent).toBeUndefined();
  });

  it("overwrites the same date instead of creating a second record (last-write-wins)", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });
    await saveWeightRecord({ date: "2026-07-01", weightKg: 71.8, note: "筋トレ後" });

    const all = await getAllWeightRecords();
    expect(all).toHaveLength(1);
    expect(all[0].weightKg).toBe(71.8);
    expect(all[0].note).toBe("筋トレ後");
  });

  it("lists all records sorted by date", async () => {
    await saveWeightRecord({ date: "2026-07-03", weightKg: 71.5 });
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });
    await saveWeightRecord({ date: "2026-07-02", weightKg: 71.9 });

    const all = await getAllWeightRecords();
    expect(all.map((r) => r.date)).toEqual(["2026-07-01", "2026-07-02", "2026-07-03"]);
  });

  it("filters records by date range", async () => {
    await saveWeightRecord({ date: "2026-06-30", weightKg: 72.3 });
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });
    await saveWeightRecord({ date: "2026-07-02", weightKg: 71.9 });
    await saveWeightRecord({ date: "2026-07-05", weightKg: 71.5 });

    const inRange = await getWeightRecordsByDateRange("2026-07-01", "2026-07-02");
    expect(inRange.map((r) => r.date)).toEqual(["2026-07-01", "2026-07-02"]);
  });

  it("updates an existing record without needing the full payload", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });

    const updated = await updateWeightRecord("2026-07-01", { note: "飲み会翌日" });
    expect(updated.weightKg).toBe(72.1);
    expect(updated.note).toBe("飲み会翌日");
  });

  it("updates the body fat percent on an existing record", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });

    const updated = await updateWeightRecord("2026-07-01", { bodyFatPercent: 23.8 });
    expect(updated.bodyFatPercent).toBe(23.8);
  });

  it("throws when updating a record that doesn't exist", async () => {
    await expect(updateWeightRecord("2026-01-01", { note: "x" })).rejects.toThrow();
  });

  it("deletes a record", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });
    await deleteWeightRecord("2026-07-01");

    expect(await getWeightRecord("2026-07-01")).toBeUndefined();
  });

  it("is unsynced by default and can be marked synced", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });

    expect((await getUnsyncedWeightRecords()).map((r) => r.date)).toEqual(["2026-07-01"]);

    await markWeightRecordsSynced(["2026-07-01"]);
    expect(await getUnsyncedWeightRecords()).toHaveLength(0);
  });

  it("resets the synced flag when a record is updated", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });
    await markWeightRecordsSynced(["2026-07-01"]);

    const updated = await updateWeightRecord("2026-07-01", { note: "飲み会翌日" });
    expect(updated.synced).toBe(false);
  });
});
