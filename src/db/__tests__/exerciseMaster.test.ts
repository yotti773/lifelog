import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import {
  addExerciseMasterItem,
  deleteExerciseMasterItem,
  getAllExerciseMasterItems,
  updateExerciseMasterItem,
} from "@/db/exerciseMaster";

beforeEach(async () => {
  await db.exerciseMasterItems.clear();
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

  it("deletes an item", async () => {
    const item = await addExerciseMasterItem("ベンチプレス");

    await deleteExerciseMasterItem(item.id);

    expect(await getAllExerciseMasterItems()).toHaveLength(0);
  });
});
