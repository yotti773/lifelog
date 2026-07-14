import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import {
  getHabitRecordsByDateRange,
  getHabitRecordsByHabit,
  getHabitRecordsForDate,
  habitRecordId,
  markHabitDone,
  markHabitRecordsSynced,
  unmarkHabitDone,
  getUnsyncedHabitRecords,
} from "@/db/habitRecords";
import { getPendingDeletionIds } from "@/db/syncDeletions";

beforeEach(async () => {
  await db.habitRecords.clear();
  await db.syncDeletions.clear();
});

describe("habitRecords", () => {
  it("uses `${date}_${habitId}` as the composite key (one per day/habit, last-wins)", async () => {
    await markHabitDone({ date: "2026-07-05", habitId: "hb-1", habitName: "ストレッチ" });
    await markHabitDone({ date: "2026-07-05", habitId: "hb-1", habitName: "ストレッチ(改名)" });
    const records = await getHabitRecordsForDate("2026-07-05");
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe(habitRecordId("2026-07-05", "hb-1"));
    expect(records[0].habitName).toBe("ストレッチ(改名)");
  });

  it("keeps records for different habits on the same day separate", async () => {
    await markHabitDone({ date: "2026-07-05", habitId: "hb-1", habitName: "ストレッチ" });
    await markHabitDone({ date: "2026-07-05", habitId: "hb-2", habitName: "読書" });
    expect(await getHabitRecordsForDate("2026-07-05")).toHaveLength(2);
  });

  it("unmark deletes the record and leaves a tombstone; re-mark cancels it", async () => {
    await markHabitDone({ date: "2026-07-05", habitId: "hb-1", habitName: "ストレッチ" });
    await markHabitRecordsSynced([habitRecordId("2026-07-05", "hb-1")]);
    await unmarkHabitDone("2026-07-05", "hb-1");
    expect(await getHabitRecordsForDate("2026-07-05")).toHaveLength(0);
    expect(await getPendingDeletionIds("habitRecord")).toEqual([habitRecordId("2026-07-05", "hb-1")]);

    await markHabitDone({ date: "2026-07-05", habitId: "hb-1", habitName: "ストレッチ" });
    expect(await getPendingDeletionIds("habitRecord")).toEqual([]);
  });

  it("returns a habit's records in date order across a range", async () => {
    await markHabitDone({ date: "2026-07-07", habitId: "hb-1", habitName: "ストレッチ" });
    await markHabitDone({ date: "2026-07-05", habitId: "hb-1", habitName: "ストレッチ" });
    await markHabitDone({ date: "2026-07-06", habitId: "hb-2", habitName: "読書" });
    expect((await getHabitRecordsByHabit("hb-1")).map((r) => r.date)).toEqual(["2026-07-05", "2026-07-07"]);
    expect((await getHabitRecordsByDateRange("2026-07-05", "2026-07-06")).map((r) => r.habitId).sort()).toEqual([
      "hb-1",
      "hb-2",
    ]);
  });

  it("only returns unsynced records after marking some synced", async () => {
    await markHabitDone({ date: "2026-07-05", habitId: "hb-1", habitName: "ストレッチ" });
    await markHabitDone({ date: "2026-07-05", habitId: "hb-2", habitName: "読書" });
    await markHabitRecordsSynced([habitRecordId("2026-07-05", "hb-1")]);
    const unsynced = await getUnsyncedHabitRecords();
    expect(unsynced.map((r) => r.habitId)).toEqual(["hb-2"]);
  });
});
