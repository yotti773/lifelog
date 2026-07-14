import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import {
  deleteBloodPressureRecord,
  getBloodPressureRecord,
  getBloodPressureRecordsByDateRange,
  getUnsyncedBloodPressureRecords,
  markBloodPressureRecordsSynced,
  saveBloodPressureRecord,
} from "@/db/bloodPressureRecords";
import { getPendingDeletionIds } from "@/db/syncDeletions";

beforeEach(async () => {
  await db.bloodPressureRecords.clear();
  await db.syncDeletions.clear();
});

describe("bloodPressureRecords", () => {
  it("saves and retrieves a record by date, with optional pulse", async () => {
    await saveBloodPressureRecord({ date: "2026-07-05", systolic: 128, diastolic: 82, pulse: 66 });
    const record = await getBloodPressureRecord("2026-07-05");
    expect(record?.systolic).toBe(128);
    expect(record?.diastolic).toBe(82);
    expect(record?.pulse).toBe(66);
    expect(record?.synced).toBe(false);
  });

  it("uses date as the primary key so the same day is last-wins", async () => {
    await saveBloodPressureRecord({ date: "2026-07-05", systolic: 128, diastolic: 82 });
    await saveBloodPressureRecord({ date: "2026-07-05", systolic: 120, diastolic: 78 });
    const all = await getBloodPressureRecordsByDateRange("2026-07-01", "2026-07-31");
    expect(all).toHaveLength(1);
    expect(all[0].systolic).toBe(120);
  });

  it("leaves a tombstone when deleting, and re-saving cancels it", async () => {
    await saveBloodPressureRecord({ date: "2026-07-05", systolic: 128, diastolic: 82 });
    await markBloodPressureRecordsSynced(["2026-07-05"]);
    await deleteBloodPressureRecord("2026-07-05");
    expect(await getPendingDeletionIds("bloodPressure")).toEqual(["2026-07-05"]);

    await saveBloodPressureRecord({ date: "2026-07-05", systolic: 130, diastolic: 84 });
    expect(await getPendingDeletionIds("bloodPressure")).toEqual([]);
  });

  it("marks records synced and only returns unsynced ones", async () => {
    await saveBloodPressureRecord({ date: "2026-07-05", systolic: 128, diastolic: 82 });
    await saveBloodPressureRecord({ date: "2026-07-06", systolic: 126, diastolic: 80 });
    await markBloodPressureRecordsSynced(["2026-07-05"]);
    const unsynced = await getUnsyncedBloodPressureRecords();
    expect(unsynced.map((r) => r.date)).toEqual(["2026-07-06"]);
  });
});
