import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import { addMealRecord, deleteMealRecord } from "@/db/mealRecords";
import {
  clearDeletions,
  enqueueDeletion,
  getPendingDeletionIds,
} from "@/db/syncDeletions";
import { deleteWeightRecord, saveWeightRecord } from "@/db/weightRecords";

beforeEach(async () => {
  await db.weightRecords.clear();
  await db.mealRecords.clear();
  await db.syncDeletions.clear();
});

describe("syncDeletions", () => {
  it("体重記録を削除するとトゥームストーンが残る", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });
    await deleteWeightRecord("2026-07-01");

    expect(await getPendingDeletionIds("weight")).toEqual(["2026-07-01"]);
    expect(await getPendingDeletionIds("meal")).toEqual([]);
  });

  it("食事記録を削除するとそのIDのトゥームストーンが残る", async () => {
    const meal = await addMealRecord({
      mealType: "lunch",
      confirmedName: "鶏肉と野菜炒め",
      confirmedKcal: 580,
      confirmedProteinG: 40,
      confirmedFatG: 20,
      confirmedCarbsG: 50,
    });
    await deleteMealRecord(meal.id);

    expect(await getPendingDeletionIds("meal")).toEqual([meal.id]);
  });

  it("削除した日付を同じキーで再登録すると削除要求が取り消される", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });
    await deleteWeightRecord("2026-07-01");
    expect(await getPendingDeletionIds("weight")).toEqual(["2026-07-01"]);

    // 同じ日付を再登録 → スプレッドシート側は削除ではなく更新すべき
    await saveWeightRecord({ date: "2026-07-01", weightKg: 71.5 });
    expect(await getPendingDeletionIds("weight")).toEqual([]);
  });

  it("clearDeletionsで確定済みのトゥームストーンだけを消せる", async () => {
    await enqueueDeletion("meal", "id-1");
    await enqueueDeletion("meal", "id-2");

    await clearDeletions("meal", ["id-1"]);

    expect(await getPendingDeletionIds("meal")).toEqual(["id-2"]);
  });

  it("同じ行への削除を二重に登録しても1件にまとまる(冪等)", async () => {
    await enqueueDeletion("weight", "2026-07-01");
    await enqueueDeletion("weight", "2026-07-01");

    expect(await getPendingDeletionIds("weight")).toEqual(["2026-07-01"]);
  });
});
