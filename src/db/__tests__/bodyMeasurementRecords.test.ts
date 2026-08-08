import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import {
  deleteBodyMeasurementRecord,
  getBodyMeasurementRecord,
  getBodyMeasurementRecordsByDateRange,
  getAllBodyMeasurementRecordsDesc,
  getUnsyncedBodyMeasurementRecords,
  markBodyMeasurementRecordsSynced,
  saveBodyMeasurementRecord,
} from "@/db/bodyMeasurementRecords";
import { getPendingDeletionIds } from "@/db/syncDeletions";

beforeEach(async () => {
  await db.bodyMeasurementRecords.clear();
  await db.syncDeletions.clear();
});

describe("bodyMeasurementRecords", () => {
  it("saves and retrieves a record by date, with optional chest/thigh", async () => {
    await saveBodyMeasurementRecord({ date: "2026-07-05", waistCm: 82.5, chestCm: 95, thighCm: 52 });
    const record = await getBodyMeasurementRecord("2026-07-05");
    expect(record?.waistCm).toBe(82.5);
    expect(record?.chestCm).toBe(95);
    expect(record?.thighCm).toBe(52);
    expect(record?.synced).toBe(false);
  });

  it("uses date as the primary key so the same day is last-wins", async () => {
    await saveBodyMeasurementRecord({ date: "2026-07-05", waistCm: 82.5 });
    await saveBodyMeasurementRecord({ date: "2026-07-05", waistCm: 81.0 });
    const all = await getBodyMeasurementRecordsByDateRange("2026-07-01", "2026-07-31");
    expect(all).toHaveLength(1);
    expect(all[0].waistCm).toBe(81.0);
  });

  it("leaves a tombstone when deleting, and re-saving cancels it", async () => {
    await saveBodyMeasurementRecord({ date: "2026-07-05", waistCm: 82.5 });
    await markBodyMeasurementRecordsSynced(["2026-07-05"]);
    await deleteBodyMeasurementRecord("2026-07-05");
    expect(await getPendingDeletionIds("bodyMeasurement")).toEqual(["2026-07-05"]);

    await saveBodyMeasurementRecord({ date: "2026-07-05", waistCm: 81.5 });
    expect(await getPendingDeletionIds("bodyMeasurement")).toEqual([]);
  });

  it("marks records synced and only returns unsynced ones", async () => {
    await saveBodyMeasurementRecord({ date: "2026-07-05", waistCm: 82.5 });
    await saveBodyMeasurementRecord({ date: "2026-07-06", waistCm: 82.0 });
    await markBodyMeasurementRecordsSynced(["2026-07-05"]);
    const unsynced = await getUnsyncedBodyMeasurementRecords();
    expect(unsynced.map((r) => r.date)).toEqual(["2026-07-06"]);
  });

  it("returns history in descending date order", async () => {
    await saveBodyMeasurementRecord({ date: "2026-07-05", waistCm: 82.5 });
    await saveBodyMeasurementRecord({ date: "2026-08-01", waistCm: 81.0 });
    const desc = await getAllBodyMeasurementRecordsDesc();
    expect(desc.map((r) => r.date)).toEqual(["2026-08-01", "2026-07-05"]);
  });
});
