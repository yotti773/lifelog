import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import {
  addFoodMasterItem,
  bulkAddFoodMasterItems,
  deleteFoodMasterItem,
  getAllFoodMasterItems,
  updateFoodMasterItem,
} from "../foodMaster";

beforeEach(async () => {
  await db.foodMasterItems.clear();
});

describe("foodMaster", () => {
  it("adds and lists items sorted by name", async () => {
    await addFoodMasterItem({ name: "ドーナツ", kcal: 250, proteinG: 4, fatG: 12, carbsG: 32 });
    await addFoodMasterItem({ name: "モスバーガー", kcal: 380, proteinG: 18, fatG: 20, carbsG: 32 });

    const all = await getAllFoodMasterItems();
    expect(all.map((item) => item.name)).toEqual(["ドーナツ", "モスバーガー"]);
  });

  it("updates an existing item", async () => {
    const item = await addFoodMasterItem({ name: "おにぎり", kcal: 180, proteinG: 4, fatG: 1, carbsG: 39 });

    const updated = await updateFoodMasterItem(item.id, { kcal: 190 });
    expect(updated.kcal).toBe(190);
    expect(updated.name).toBe("おにぎり");
  });

  it("throws when updating an item that doesn't exist", async () => {
    await expect(updateFoodMasterItem("missing-id", { kcal: 100 })).rejects.toThrow();
  });

  it("deletes an item", async () => {
    const item = await addFoodMasterItem({ name: "サラダチキン", kcal: 110, proteinG: 24, fatG: 1, carbsG: 0 });
    await deleteFoodMasterItem(item.id);

    expect(await getAllFoodMasterItems()).toHaveLength(0);
  });

  it("bulk-adds items and skips ones with an already-registered name", async () => {
    await addFoodMasterItem({ name: "ドーナツ", kcal: 250, proteinG: 4, fatG: 12, carbsG: 32 });

    const insertedCount = await bulkAddFoodMasterItems([
      { name: "ドーナツ", kcal: 999, proteinG: 0, fatG: 0, carbsG: 0 },
      { name: "からあげクン", kcal: 190, proteinG: 12, fatG: 12, carbsG: 8 },
    ]);

    expect(insertedCount).toBe(1);
    const all = await getAllFoodMasterItems();
    expect(all.map((item) => item.name).sort()).toEqual(["からあげクン", "ドーナツ"]);
    expect(all.find((item) => item.name === "ドーナツ")?.kcal).toBe(250);
  });
});
