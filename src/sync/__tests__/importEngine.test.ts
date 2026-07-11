import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/db";
import { getDiaryRecord, deleteDiaryRecord, saveDiaryRecord } from "@/db/diaryRecords";
import { addMealRecord, deleteMealRecord, getMealRecord } from "@/db/mealRecords";
import { deleteWeightRecord, getWeightRecord, saveWeightRecord } from "@/db/weightRecords";
import { runImport } from "@/sync/importEngine";
import { SyncNotConfiguredError } from "@/sync/notConfiguredTransport";
import type { SyncPullResult, SyncPullTransport } from "@/sync/types";

beforeEach(async () => {
  await db.weightRecords.clear();
  await db.mealRecords.clear();
  await db.waterRecords.clear();
  await db.workoutRecords.clear();
  await db.diaryRecords.clear();
  await db.syncDeletions.clear();
});

const emptyPull: SyncPullResult = {
  weightRecords: [],
  mealRecords: [],
  waterRecords: [],
  workoutRecords: [],
  diaryRecords: [],
  skippedWeightRows: 0,
  skippedMealRows: 0,
  skippedWaterRows: 0,
  skippedWorkoutRows: 0,
  skippedDiaryRows: 0,
};

/** 成功時の`ImportOutcome`を組み立てる。テストごとに差分だけ渡せば済むようにする */
const successOutcome = (overrides: {
  importedWeightCount?: number;
  importedMealCount?: number;
  importedWaterCount?: number;
  importedWorkoutCount?: number;
  importedDiaryCount?: number;
  skippedExistingCount?: number;
  skippedRowCount?: number;
}) => ({
  status: "success" as const,
  importedWeightCount: 0,
  importedMealCount: 0,
  importedWaterCount: 0,
  importedWorkoutCount: 0,
  importedDiaryCount: 0,
  skippedExistingCount: 0,
  skippedRowCount: 0,
  ...overrides,
});

const pulledWeight = {
  id: "2026-07-01",
  date: "2026-07-01",
  timestamp: "2026-06-30T22:00:00.000Z",
  weightKg: 72.1,
};

const pulledMeal = {
  id: "meal-uuid-1",
  timestamp: "2026-07-01T03:30:00.000Z",
  mealType: "lunch" as const,
  confirmedName: "鶏肉と野菜炒め",
  confirmedKcal: 580,
  confirmedProteinG: 40,
  confirmedFatG: 20,
  confirmedCarbsG: 50,
};

const pulledDiary = {
  id: "2026-07-01",
  date: "2026-07-01",
  timestamp: "2026-06-30T22:00:00.000Z",
  text: "よく眠れた",
  mood: "good" as const,
};

function fakeTransport(result: SyncPullResult): SyncPullTransport {
  return { pull: vi.fn(async () => result) };
}

describe("runImport", () => {
  it("skips without touching data when offline", async () => {
    const transport = fakeTransport(emptyPull);

    const outcome = await runImport({ transport, isOnline: () => false });

    expect(outcome).toEqual({ status: "skipped-offline" });
    expect(transport.pull).not.toHaveBeenCalled();
  });

  it("シートの記録をsynced: trueで取り込む(再送信の対象にしない)", async () => {
    const transport = fakeTransport({
      ...emptyPull,
      weightRecords: [pulledWeight],
      mealRecords: [pulledMeal],
      diaryRecords: [pulledDiary],
      skippedWeightRows: 1,
      skippedMealRows: 2,
    });

    const outcome = await runImport({ transport, isOnline: () => true });

    expect(outcome).toEqual(
      successOutcome({
        importedWeightCount: 1,
        importedMealCount: 1,
        importedDiaryCount: 1,
        skippedRowCount: 3,
      }),
    );
    expect(await getWeightRecord("2026-07-01")).toEqual({ ...pulledWeight, synced: true });
    expect(await getMealRecord("meal-uuid-1")).toEqual({ ...pulledMeal, synced: true });
    expect(await getDiaryRecord("2026-07-01")).toEqual({ ...pulledDiary, synced: true });
  });

  it("ローカルに既にある記録はスキップし、ローカル側の値を保持する(ローカル優先)", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 70.5 });
    await addMealRecord({ ...pulledMeal, mealType: "lunch" });
    const localMeal = (await db.mealRecords.toArray())[0];
    await saveDiaryRecord({ date: "2026-07-01", text: "ローカルの日記" });
    const transport = fakeTransport({
      ...emptyPull,
      weightRecords: [pulledWeight],
      mealRecords: [{ ...pulledMeal, id: localMeal.id, confirmedKcal: 999 }],
      diaryRecords: [{ ...pulledDiary, text: "シート側の日記" }],
    });

    const outcome = await runImport({ transport, isOnline: () => true });

    expect(outcome).toEqual(successOutcome({ skippedExistingCount: 3 }));
    expect((await getWeightRecord("2026-07-01"))?.weightKg).toBe(70.5);
    expect((await getMealRecord(localMeal.id))?.confirmedKcal).toBe(580);
    expect((await getDiaryRecord("2026-07-01"))?.text).toBe("ローカルの日記");
  });

  it("削除トゥームストーンが保留中の記録は取り込まない(未送信の削除を復活させない)", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });
    await deleteWeightRecord("2026-07-01");
    const meal = await addMealRecord({ ...pulledMeal });
    await deleteMealRecord(meal.id);
    await saveDiaryRecord({ date: "2026-07-01", text: "消した日記" });
    await deleteDiaryRecord("2026-07-01");
    const transport = fakeTransport({
      ...emptyPull,
      weightRecords: [pulledWeight],
      mealRecords: [{ ...pulledMeal, id: meal.id }],
      diaryRecords: [pulledDiary],
    });

    const outcome = await runImport({ transport, isOnline: () => true });

    expect(outcome).toEqual(successOutcome({ skippedExistingCount: 3 }));
    expect(await getWeightRecord("2026-07-01")).toBeUndefined();
    expect(await getMealRecord(meal.id)).toBeUndefined();
    expect(await getDiaryRecord("2026-07-01")).toBeUndefined();
  });

  it("トランスポートが失敗したら何も取り込まずエラーを返す", async () => {
    const transport: SyncPullTransport = {
      pull: vi.fn(async () => {
        throw new Error("network down");
      }),
    };

    const outcome = await runImport({ transport, isOnline: () => true });

    expect(outcome).toEqual({ status: "error", message: "network down" });
    expect(await db.weightRecords.count()).toBe(0);
  });

  it("defaults to the not-configured transport, surfacing a clear message", async () => {
    const outcome = await runImport({ isOnline: () => true });

    expect(outcome.status).toBe("error");
    if (outcome.status === "error") {
      expect(outcome.message).toBe(new SyncNotConfiguredError().message);
    }
  });
});
