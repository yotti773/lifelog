import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import {
  addFoodMasterItem,
  deleteFoodMasterItem,
  getAllFoodMasterItems,
  getUnsyncedFoodMasterItems,
  markFoodMasterItemsSynced,
  updateFoodMasterItem,
} from "@/db/foodMaster";
import { getPendingDeletionIds } from "@/db/syncDeletions";

beforeEach(async () => {
  await db.foodMasterItems.clear();
  await db.syncDeletions.clear();
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

  it("新規追加はsynced: falseになり、同期済みにした後の編集でまた未同期に戻る(Issue #96)", async () => {
    const item = await addFoodMasterItem({ name: "おにぎり", kcal: 180, proteinG: 4, fatG: 1, carbsG: 39 });
    expect(item.synced).toBe(false);

    await markFoodMasterItemsSynced([item.id]);
    expect(await getUnsyncedFoodMasterItems()).toHaveLength(0);

    await updateFoodMasterItem(item.id, { kcal: 190 });
    expect((await getUnsyncedFoodMasterItems()).map((i) => i.id)).toEqual([item.id]);
  });

  it("削除するとトゥームストーンが残り、次回同期でシート側の行削除に使われる(Issue #96)", async () => {
    const item = await addFoodMasterItem({ name: "サラダチキン", kcal: 110, proteinG: 24, fatG: 1, carbsG: 0 });

    await deleteFoodMasterItem(item.id);

    expect(await getPendingDeletionIds("foodMaster")).toEqual([item.id]);
  });
});
