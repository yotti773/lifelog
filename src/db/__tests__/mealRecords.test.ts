import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import {
  addMealRecord,
  deleteMealRecord,
  getAllMealRecords,
  getAllMealRecordsDesc,
  getDailyCalorieTotals,
  getMealRecordsByDateRange,
  getMealRecordsForDateAndType,
  getUnsyncedMealRecords,
  markMealRecordsSynced,
  replaceMealRecordsForDateAndType,
  updateMealRecord,
} from "@/db/mealRecords";
import { getPendingDeletionIds } from "@/db/syncDeletions";

beforeEach(async () => {
  await db.mealRecords.clear();
  await db.syncDeletions.clear();
});

describe("mealRecords", () => {
  it("adds a meal record with a generated id and PFC values", async () => {
    const record = await addMealRecord({
      mealType: "breakfast",
      confirmedName: "トースト+卵",
      confirmedKcal: 420,
      confirmedProteinG: 18,
      confirmedFatG: 16,
      confirmedCarbsG: 45,
      timestamp: "2026-07-01T07:30:00.000Z",
    });

    expect(record.id).toBeTruthy();
    expect(record.confirmedProteinG).toBe(18);
    expect(record.confirmedFatG).toBe(16);
    expect(record.confirmedCarbsG).toBe(45);
    expect(record.synced).toBe(false);
    expect(await getAllMealRecords()).toHaveLength(1);
  });

  it("allows multiple records for the same mealType", async () => {
    await addMealRecord({
      mealType: "lunch",
      confirmedName: "鶏肉と野菜炒め",
      confirmedKcal: 580,
      confirmedProteinG: 40,
      confirmedFatG: 20,
      confirmedCarbsG: 50,
      timestamp: "2026-07-01T12:15:00.000Z",
    });
    await addMealRecord({
      mealType: "lunch",
      confirmedName: "サラダ",
      confirmedKcal: 120,
      confirmedProteinG: 3,
      confirmedFatG: 8,
      confirmedCarbsG: 10,
      timestamp: "2026-07-01T12:20:00.000Z",
    });

    const all = await getAllMealRecords();
    expect(all).toHaveLength(2);
    expect(all.every((r) => r.mealType === "lunch")).toBe(true);
  });

  it("lists all records sorted by timestamp descending", async () => {
    await addMealRecord({
      mealType: "breakfast",
      confirmedName: "トースト",
      confirmedKcal: 300,
      confirmedProteinG: 10,
      confirmedFatG: 8,
      confirmedCarbsG: 40,
      timestamp: "2026-07-01T07:30:00.000Z",
    });
    await addMealRecord({
      mealType: "dinner",
      confirmedName: "焼き魚定食",
      confirmedKcal: 600,
      confirmedProteinG: 35,
      confirmedFatG: 15,
      confirmedCarbsG: 60,
      timestamp: "2026-07-03T12:00:00.000Z",
    });
    await addMealRecord({
      mealType: "lunch",
      confirmedName: "パスタ",
      confirmedKcal: 500,
      confirmedProteinG: 15,
      confirmedFatG: 12,
      confirmedCarbsG: 70,
      timestamp: "2026-07-02T12:15:00.000Z",
    });

    const all = await getAllMealRecordsDesc();
    expect(all.map((r) => r.confirmedName)).toEqual(["焼き魚定食", "パスタ", "トースト"]);
  });

  it("filters records by date range (ローカル日付基準)", async () => {
    await addMealRecord({
      mealType: "breakfast",
      confirmedName: "トースト",
      confirmedKcal: 300,
      confirmedProteinG: 8,
      confirmedFatG: 10,
      confirmedCarbsG: 40,
      timestamp: new Date("2026-06-30T07:00:00").toISOString(),
    });
    await addMealRecord({
      mealType: "lunch",
      confirmedName: "鶏肉と野菜炒め",
      confirmedKcal: 580,
      confirmedProteinG: 40,
      confirmedFatG: 20,
      confirmedCarbsG: 50,
      timestamp: new Date("2026-07-01T12:15:00").toISOString(),
    });
    await addMealRecord({
      mealType: "dinner",
      confirmedName: "焼き魚",
      confirmedKcal: 450,
      confirmedProteinG: 35,
      confirmedFatG: 18,
      confirmedCarbsG: 30,
      timestamp: new Date("2026-07-02T19:00:00").toISOString(),
    });

    const inRange = await getMealRecordsByDateRange("2026-07-01", "2026-07-01");
    expect(inRange).toHaveLength(1);
    expect(inRange[0].confirmedName).toBe("鶏肉と野菜炒め");
  });

  it("UTC日付を跨ぐ早朝(ローカル0:00〜8:59)の記録も当日分として取得できる(#23)", async () => {
    // ローカル(JST)で7/1 7:30に記録した食事はUTCでは6/30 22:30となり、
    // UTC日付でスライスすると誤って前日(6/30)扱いされてしまっていた
    await addMealRecord({
      mealType: "breakfast",
      confirmedName: "早朝のトースト",
      confirmedKcal: 300,
      confirmedProteinG: 8,
      confirmedFatG: 10,
      confirmedCarbsG: 40,
      timestamp: new Date("2026-07-01T07:30:00").toISOString(),
    });

    const inRange = await getMealRecordsByDateRange("2026-07-01", "2026-07-01");
    expect(inRange).toHaveLength(1);
    expect(inRange[0].confirmedName).toBe("早朝のトースト");

    const notInPreviousDay = await getMealRecordsByDateRange("2026-06-30", "2026-06-30");
    expect(notInPreviousDay).toHaveLength(0);
  });

  it("updates a record (e.g. correcting the AI-estimated calories/PFC)", async () => {
    const record = await addMealRecord({
      mealType: "snack",
      confirmedName: "AI判定中",
      confirmedKcal: 200,
      confirmedProteinG: 2,
      confirmedFatG: 10,
      confirmedCarbsG: 25,
    });

    const updated = await updateMealRecord(record.id, {
      confirmedName: "ポテトチップス",
      confirmedKcal: 250,
      confirmedFatG: 15,
    });
    expect(updated.confirmedName).toBe("ポテトチップス");
    expect(updated.confirmedKcal).toBe(250);
    expect(updated.confirmedFatG).toBe(15);
  });

  it("resets the synced flag when a record is updated", async () => {
    const record = await addMealRecord({
      mealType: "snack",
      confirmedName: "x",
      confirmedKcal: 1,
      confirmedProteinG: 0,
      confirmedFatG: 0,
      confirmedCarbsG: 0,
    });
    await markMealRecordsSynced([record.id]);

    const updated = await updateMealRecord(record.id, { confirmedKcal: 2 });
    expect(updated.synced).toBe(false);
  });

  it("throws when updating a record that doesn't exist", async () => {
    await expect(updateMealRecord("missing-id", { confirmedKcal: 1 })).rejects.toThrow();
  });

  it("deletes a record", async () => {
    const record = await addMealRecord({
      mealType: "snack",
      confirmedName: "x",
      confirmedKcal: 1,
      confirmedProteinG: 0,
      confirmedFatG: 0,
      confirmedCarbsG: 0,
    });
    await deleteMealRecord(record.id);

    expect(await getAllMealRecords()).toHaveLength(0);
  });

  it("lists only unsynced records and marks them synced", async () => {
    const a = await addMealRecord({
      mealType: "breakfast",
      confirmedName: "A",
      confirmedKcal: 100,
      confirmedProteinG: 1,
      confirmedFatG: 1,
      confirmedCarbsG: 1,
    });
    const b = await addMealRecord({
      mealType: "lunch",
      confirmedName: "B",
      confirmedKcal: 200,
      confirmedProteinG: 2,
      confirmedFatG: 2,
      confirmedCarbsG: 2,
    });

    expect((await getUnsyncedMealRecords()).map((r) => r.id).sort()).toEqual([a.id, b.id].sort());

    await markMealRecordsSynced([a.id]);
    const unsynced = await getUnsyncedMealRecords();
    expect(unsynced.map((r) => r.id)).toEqual([b.id]);
  });

  it("aggregates daily calorie totals, including 0kcal for days without records", async () => {
    await addMealRecord({
      mealType: "breakfast",
      confirmedName: "トースト",
      confirmedKcal: 300,
      confirmedProteinG: 8,
      confirmedFatG: 10,
      confirmedCarbsG: 40,
      timestamp: new Date("2026-07-01T07:00:00").toISOString(),
    });
    await addMealRecord({
      mealType: "lunch",
      confirmedName: "鶏肉と野菜炒め",
      confirmedKcal: 580,
      confirmedProteinG: 40,
      confirmedFatG: 20,
      confirmedCarbsG: 50,
      timestamp: new Date("2026-07-01T12:15:00").toISOString(),
    });
    await addMealRecord({
      mealType: "dinner",
      confirmedName: "焼き魚",
      confirmedKcal: 450,
      confirmedProteinG: 35,
      confirmedFatG: 18,
      confirmedCarbsG: 30,
      timestamp: new Date("2026-07-03T19:00:00").toISOString(),
    });

    const totals = await getDailyCalorieTotals("2026-07-01", "2026-07-03");
    expect(totals).toEqual([
      { date: "2026-07-01", kcal: 880 },
      { date: "2026-07-02", kcal: 0 },
      { date: "2026-07-03", kcal: 450 },
    ]);
  });

  it("早朝(ローカル0:00〜8:59)に記録した食事もその日の合計カロリーに計上される(#23)", async () => {
    await addMealRecord({
      mealType: "breakfast",
      confirmedName: "早朝の朝食",
      confirmedKcal: 400,
      confirmedProteinG: 20,
      confirmedFatG: 10,
      confirmedCarbsG: 40,
      timestamp: new Date("2026-07-05T07:30:00").toISOString(),
    });

    const totals = await getDailyCalorieTotals("2026-07-05", "2026-07-05");
    expect(totals).toEqual([{ date: "2026-07-05", kcal: 400 }]);
  });

  describe("区分単位の置き換え保存(Issue #126)", () => {
    const item = (confirmedName: string, confirmedKcal: number) => ({
      confirmedName,
      confirmedKcal,
      confirmedProteinG: 0,
      confirmedFatG: 0,
      confirmedCarbsG: 0,
    });

    it("保存した品目を区分・日付で読み戻せる(時刻昇順)", async () => {
      const ts = new Date("2026-07-01T08:10:00").toISOString();
      await replaceMealRecordsForDateAndType("2026-07-01", "breakfast", ts, [
        item("トースト", 200),
        item("ゆで卵", 80),
      ]);

      const records = await getMealRecordsForDateAndType("2026-07-01", "breakfast");
      expect(records.map((r) => r.confirmedName)).toEqual(["トースト", "ゆで卵"]);
      expect(records.every((r) => r.mealType === "breakfast")).toBe(true);
      expect(records.every((r) => !r.synced)).toBe(true);
    });

    it("同じ日・同じ区分は追記でなく丸ごと置き換わる", async () => {
      const ts = new Date("2026-07-01T08:00:00").toISOString();
      await replaceMealRecordsForDateAndType("2026-07-01", "breakfast", ts, [item("トースト", 200)]);
      await replaceMealRecordsForDateAndType("2026-07-01", "breakfast", ts, [
        item("おにぎり", 180),
        item("味噌汁", 40),
      ]);

      const records = await getMealRecordsForDateAndType("2026-07-01", "breakfast");
      expect(records.map((r) => r.confirmedName)).toEqual(["おにぎり", "味噌汁"]);
    });

    it("同じ日の別区分は置き換えの影響を受けない", async () => {
      const ts = new Date("2026-07-01T12:00:00").toISOString();
      await replaceMealRecordsForDateAndType("2026-07-01", "breakfast", new Date("2026-07-01T08:00:00").toISOString(), [
        item("トースト", 200),
      ]);
      await replaceMealRecordsForDateAndType("2026-07-01", "lunch", ts, [item("唐揚げ弁当", 820)]);
      // 昼食を上書きしても朝食は残る
      await replaceMealRecordsForDateAndType("2026-07-01", "lunch", ts, [item("パスタ", 600)]);

      expect((await getMealRecordsForDateAndType("2026-07-01", "breakfast")).map((r) => r.confirmedName)).toEqual([
        "トースト",
      ]);
      expect((await getMealRecordsForDateAndType("2026-07-01", "lunch")).map((r) => r.confirmedName)).toEqual([
        "パスタ",
      ]);
    });

    it("別の日の同じ区分は置き換えの影響を受けない", async () => {
      await replaceMealRecordsForDateAndType("2026-07-01", "breakfast", new Date("2026-07-01T08:00:00").toISOString(), [
        item("トースト", 200),
      ]);
      await replaceMealRecordsForDateAndType("2026-07-02", "breakfast", new Date("2026-07-02T08:00:00").toISOString(), []);

      expect(await getMealRecordsForDateAndType("2026-07-01", "breakfast")).toHaveLength(1);
      expect(await getMealRecordsForDateAndType("2026-07-02", "breakfast")).toHaveLength(0);
    });

    it("空リストで保存するとその区分の当日分が削除される", async () => {
      const ts = new Date("2026-07-01T08:00:00").toISOString();
      await replaceMealRecordsForDateAndType("2026-07-01", "breakfast", ts, [item("トースト", 200)]);
      await replaceMealRecordsForDateAndType("2026-07-01", "breakfast", ts, []);

      expect(await getMealRecordsForDateAndType("2026-07-01", "breakfast")).toHaveLength(0);
    });

    it("skipped:trueの1件で「食べなかった」を保存でき、未記録(0件)とは区別される(Issue #143)", async () => {
      const ts = new Date("2026-07-01T08:00:00").toISOString();
      await replaceMealRecordsForDateAndType("2026-07-01", "breakfast", ts, [
        { ...item("食べなかった", 0), skipped: true },
      ]);

      const records = await getMealRecordsForDateAndType("2026-07-01", "breakfast");
      expect(records).toHaveLength(1);
      expect(records[0].skipped).toBe(true);
      // 未記録の区分(別日)はそもそも0件のまま
      expect(await getMealRecordsForDateAndType("2026-07-02", "breakfast")).toHaveLength(0);
    });

    it("「食べなかった」を通常の品目入力で上書きするとskippedは消える", async () => {
      const ts = new Date("2026-07-01T08:00:00").toISOString();
      await replaceMealRecordsForDateAndType("2026-07-01", "breakfast", ts, [
        { ...item("食べなかった", 0), skipped: true },
      ]);
      await replaceMealRecordsForDateAndType("2026-07-01", "breakfast", ts, [item("トースト", 200)]);

      const records = await getMealRecordsForDateAndType("2026-07-01", "breakfast");
      expect(records.map((r) => r.confirmedName)).toEqual(["トースト"]);
      expect(records[0].skipped).toBeUndefined();
    });

    it("置き換え前の各レコードIDを削除トゥームストーンとして残す(新IDは新規追加)", async () => {
      const ts = new Date("2026-07-01T08:00:00").toISOString();
      await replaceMealRecordsForDateAndType("2026-07-01", "breakfast", ts, [item("トースト", 200), item("卵", 80)]);
      expect(await getPendingDeletionIds("meal")).toEqual([]);

      await replaceMealRecordsForDateAndType("2026-07-01", "breakfast", ts, [item("トースト", 200)]);
      // 置き換え前の2件分のIDがトゥームストーンとして残る
      expect(await getPendingDeletionIds("meal")).toHaveLength(2);
    });

    it("初回保存では削除トゥームストーンを残さない(置き換え対象が無いため)", async () => {
      await replaceMealRecordsForDateAndType("2026-07-01", "breakfast", new Date("2026-07-01T08:00:00").toISOString(), [
        item("トースト", 200),
      ]);
      expect(await getPendingDeletionIds("meal")).toEqual([]);
    });

    it("AI推定値を保持したまま保存できる", async () => {
      const ts = new Date("2026-07-01T08:00:00").toISOString();
      await replaceMealRecordsForDateAndType("2026-07-01", "breakfast", ts, [
        {
          ...item("サラダ", 120),
          aiEstimatedName: "グリーンサラダ",
          aiEstimatedKcal: 118,
        },
      ]);

      const [record] = await getMealRecordsForDateAndType("2026-07-01", "breakfast");
      expect(record.aiEstimatedName).toBe("グリーンサラダ");
      expect(record.aiEstimatedKcal).toBe(118);
    });
  });
});
