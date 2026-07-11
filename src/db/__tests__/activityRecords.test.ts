import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import {
  bulkSaveActivityRecords,
  getActivityRecordsByDateRange,
  getAllActivityRecordsDesc,
  getDailyActivityTotals,
} from "@/db/activityRecords";
import type { ActivityRecord } from "@/types";

beforeEach(async () => {
  await db.activityRecords.clear();
});

function makeRecord(date: string, overrides: Partial<ActivityRecord> = {}): ActivityRecord {
  return { date, steps: 8000, totalKcal: 2400, synced: true, ...overrides };
}

describe("activityRecords", () => {
  it("saves records in bulk keyed by date", async () => {
    await bulkSaveActivityRecords([makeRecord("2026-07-01"), makeRecord("2026-07-02")]);

    expect(await db.activityRecords.count()).toBe(2);
  });

  it("overwrites an existing date on re-import (sheet wins, unlike additive imports)", async () => {
    await bulkSaveActivityRecords([makeRecord("2026-07-01", { steps: 5000 })]);
    await bulkSaveActivityRecords([makeRecord("2026-07-01", { steps: 9000, sleepMinutes: 420 })]);

    const records = await getAllActivityRecordsDesc();
    expect(records).toHaveLength(1);
    expect(records[0].steps).toBe(9000);
    expect(records[0].sleepMinutes).toBe(420);
  });

  it("returns all records newest first for the history view", async () => {
    await bulkSaveActivityRecords([
      makeRecord("2026-07-01"),
      makeRecord("2026-07-03"),
      makeRecord("2026-07-02"),
    ]);

    const records = await getAllActivityRecordsDesc();
    expect(records.map((r) => r.date)).toEqual(["2026-07-03", "2026-07-02", "2026-07-01"]);
  });

  it("returns records within an inclusive date range in ascending order", async () => {
    await bulkSaveActivityRecords([
      makeRecord("2026-06-30"),
      makeRecord("2026-07-01"),
      makeRecord("2026-07-02"),
      makeRecord("2026-07-03"),
    ]);

    const records = await getActivityRecordsByDateRange("2026-07-01", "2026-07-02");
    expect(records.map((r) => r.date)).toEqual(["2026-07-01", "2026-07-02"]);
  });

  it("fills days without records (or missing metrics) with 0 in daily totals for charts", async () => {
    await bulkSaveActivityRecords([
      makeRecord("2026-07-01", { steps: 8000, sleepMinutes: 420 }),
      makeRecord("2026-07-03", { steps: 5000, sleepMinutes: undefined }),
    ]);

    const totals = await getDailyActivityTotals("2026-07-01", "2026-07-03");
    expect(totals).toEqual([
      { date: "2026-07-01", steps: 8000, sleepMinutes: 420 },
      { date: "2026-07-02", steps: 0, sleepMinutes: 0 },
      { date: "2026-07-03", steps: 5000, sleepMinutes: 0 },
    ]);
  });
});
