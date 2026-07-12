import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import {
  addExerciseMasterItem,
  deleteExerciseMasterItem,
  DuplicateExerciseNameError,
  getAllExerciseMasterItems,
  getUnsyncedExerciseMasterItems,
  markExerciseMasterItemsSynced,
  updateExerciseMasterItem,
} from "@/db/exerciseMaster";
import { getPendingDeletionIds } from "@/db/syncDeletions";

beforeEach(async () => {
  await db.exerciseMasterItems.clear();
  await db.syncDeletions.clear();
});

describe("exerciseMaster", () => {
  it("adds and lists items sorted by name", async () => {
    await addExerciseMasterItem("スクワット");
    await addExerciseMasterItem("ベンチプレス");

    const items = await getAllExerciseMasterItems();
    expect(items.map((i) => i.name)).toEqual(["スクワット", "ベンチプレス"]);
  });

  it("updates an item's name", async () => {
    const item = await addExerciseMasterItem("ベンチプレス");

    await updateExerciseMasterItem(item.id, "インクラインベンチプレス");

    const items = await getAllExerciseMasterItems();
    expect(items.map((i) => i.name)).toEqual(["インクラインベンチプレス"]);
  });

  it("throws when updating a missing item", async () => {
    await expect(updateExerciseMasterItem("missing", "x")).rejects.toThrow();
  });

  it("rejects adding a duplicate name (ignoring surrounding whitespace)", async () => {
    await addExerciseMasterItem("ベンチプレス");

    await expect(addExerciseMasterItem("ベンチプレス")).rejects.toBeInstanceOf(DuplicateExerciseNameError);
    await expect(addExerciseMasterItem(" ベンチプレス ")).rejects.toBeInstanceOf(DuplicateExerciseNameError);
    expect(await getAllExerciseMasterItems()).toHaveLength(1);
  });

  it("rejects renaming an item onto another item's name", async () => {
    await addExerciseMasterItem("ベンチプレス");
    const squat = await addExerciseMasterItem("スクワット");

    await expect(updateExerciseMasterItem(squat.id, "ベンチプレス")).rejects.toBeInstanceOf(DuplicateExerciseNameError);
  });

  it("allows updating an item to its own current name (no false duplicate)", async () => {
    const item = await addExerciseMasterItem("ベンチプレス");

    await expect(updateExerciseMasterItem(item.id, "ベンチプレス")).resolves.toMatchObject({ name: "ベンチプレス" });
  });

  it("deletes an item", async () => {
    const item = await addExerciseMasterItem("ベンチプレス");

    await deleteExerciseMasterItem(item.id);

    expect(await getAllExerciseMasterItems()).toHaveLength(0);
  });

  it("新規追加はsynced: falseになり、同期済みにした後の改名でまた未同期に戻る(Issue #96)", async () => {
    const item = await addExerciseMasterItem("ベンチプレス");
    expect(item.synced).toBe(false);

    await markExerciseMasterItemsSynced([item.id]);
    expect(await getUnsyncedExerciseMasterItems()).toHaveLength(0);

    await updateExerciseMasterItem(item.id, "インクラインベンチプレス");
    expect((await getUnsyncedExerciseMasterItems()).map((i) => i.id)).toEqual([item.id]);
  });

  it("削除するとトゥームストーンが残り、次回同期でシート側の行削除に使われる(Issue #96)", async () => {
    const item = await addExerciseMasterItem("ベンチプレス");

    await deleteExerciseMasterItem(item.id);

    expect(await getPendingDeletionIds("exerciseMaster")).toEqual([item.id]);
  });
});
