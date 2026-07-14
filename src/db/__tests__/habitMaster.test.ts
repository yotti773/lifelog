import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import {
  addHabitMasterItem,
  deleteHabitMasterItem,
  DuplicateHabitNameError,
  getActiveHabitMasterItems,
  getAllHabitMasterItems,
  updateHabitMasterItem,
} from "@/db/habitMaster";
import { getPendingDeletionIds } from "@/db/syncDeletions";

beforeEach(async () => {
  await db.habitMasterItems.clear();
  await db.syncDeletions.clear();
});

describe("habitMaster", () => {
  it("assigns increasing order values in registration order", async () => {
    const a = await addHabitMasterItem({ name: "ストレッチ" });
    const b = await addHabitMasterItem({ name: "読書" });
    expect(a.order).toBeLessThan(b.order);
    expect((await getAllHabitMasterItems()).map((i) => i.name)).toEqual(["ストレッチ", "読書"]);
  });

  it("rejects duplicate names (trimmed) on add and update", async () => {
    await addHabitMasterItem({ name: "ストレッチ" });
    await expect(addHabitMasterItem({ name: " ストレッチ " })).rejects.toBeInstanceOf(DuplicateHabitNameError);

    const other = await addHabitMasterItem({ name: "読書" });
    await expect(updateHabitMasterItem(other.id, { name: "ストレッチ" })).rejects.toBeInstanceOf(
      DuplicateHabitNameError,
    );
  });

  it("archives and unarchives; active list excludes archived", async () => {
    const a = await addHabitMasterItem({ name: "ストレッチ" });
    await addHabitMasterItem({ name: "読書" });
    await updateHabitMasterItem(a.id, { archived: true });
    expect((await getActiveHabitMasterItems()).map((i) => i.name)).toEqual(["読書"]);
    await updateHabitMasterItem(a.id, { archived: false });
    expect((await getActiveHabitMasterItems())).toHaveLength(2);
  });

  it("clears an optional target frequency when updated to undefined", async () => {
    const a = await addHabitMasterItem({ name: "ストレッチ", targetWeeklyFrequency: 5 });
    expect(a.targetWeeklyFrequency).toBe(5);
    const updated = await updateHabitMasterItem(a.id, { targetWeeklyFrequency: undefined });
    expect(updated.targetWeeklyFrequency).toBeUndefined();
  });

  it("leaves a tombstone when deleting", async () => {
    const a = await addHabitMasterItem({ name: "ストレッチ" });
    await deleteHabitMasterItem(a.id);
    expect(await getPendingDeletionIds("habitMaster")).toEqual([a.id]);
  });
});
