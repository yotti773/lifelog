import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import {
  addWaterRecord,
  getAllWaterRecordsDesc,
  deleteWaterRecord,
  getDailyWaterTotals,
  getUnsyncedWaterRecords,
  getWaterRecordsForDate,
  markWaterRecordsSynced,
} from "@/db/waterRecords";

beforeEach(async () => {
  await db.waterRecords.clear();
  await db.syncDeletions.clear();
});

describe("waterRecords", () => {
  it("adds a record with the given amount and marks it unsynced", async () => {
    const record = await addWaterRecord(200);

    expect(record.amountMl).toBe(200);
    expect(record.synced).toBe(false);
    expect(await db.waterRecords.count()).toBe(1);
  });

  it("allows multiple records on the same day and lists them in time order", async () => {
    await addWaterRecord(350, new Date("2026-07-01T10:15:00").toISOString());
    await addWaterRecord(200, new Date("2026-07-01T07:40:00").toISOString());
    await addWaterRecord(500, new Date("2026-07-01T12:20:00").toISOString());

    const records = await getWaterRecordsForDate("2026-07-01");
    expect(records.map((r) => r.amountMl)).toEqual([200, 350, 500]);
  });

  it("filters records by local date", async () => {
    await addWaterRecord(200, new Date("2026-07-01T23:59:00").toISOString());
    await addWaterRecord(500, new Date("2026-07-02T00:01:00").toISOString());

    const day1 = await getWaterRecordsForDate("2026-07-01");
    const day2 = await getWaterRecordsForDate("2026-07-02");
    expect(day1.map((r) => r.amountMl)).toEqual([200]);
    expect(day2.map((r) => r.amountMl)).toEqual([500]);
  });

  it("deletes a record and leaves a sync tombstone", async () => {
    const record = await addWaterRecord(100);

    await deleteWaterRecord(record.id);

    expect(await db.waterRecords.count()).toBe(0);
    expect(await db.syncDeletions.count()).toBe(1);
  });

  it("lists only unsynced records and marks them synced", async () => {
    const a = await addWaterRecord(200);
    const b = await addWaterRecord(350);

    expect((await getUnsyncedWaterRecords()).map((r) => r.id).sort()).toEqual([a.id, b.id].sort());

    await markWaterRecordsSynced([a.id]);
    const unsynced = await getUnsyncedWaterRecords();
    expect(unsynced.map((r) => r.id)).toEqual([b.id]);
  });

  it("fills days without records with 0ml in daily totals", async () => {
    await addWaterRecord(200, new Date("2026-07-01T08:00:00").toISOString());
    await addWaterRecord(500, new Date("2026-07-01T12:00:00").toISOString());
    await addWaterRecord(350, new Date("2026-07-03T09:00:00").toISOString());

    const totals = await getDailyWaterTotals("2026-07-01", "2026-07-03");
    expect(totals).toEqual([
      { date: "2026-07-01", amountMl: 700 },
      { date: "2026-07-02", amountMl: 0 },
      { date: "2026-07-03", amountMl: 350 },
    ]);
  });

  it("returns all records newest first for the history view", async () => {
    await addWaterRecord(200, new Date("2026-07-01T08:00:00").toISOString());
    await addWaterRecord(500, new Date("2026-07-03T09:00:00").toISOString());
    await addWaterRecord(350, new Date("2026-07-02T12:00:00").toISOString());

    const records = await getAllWaterRecordsDesc();
    expect(records.map((r) => r.amountMl)).toEqual([500, 350, 200]);
  });

});
