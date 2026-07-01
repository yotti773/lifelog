import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db/db";
import { addMealRecord, getUnsyncedMealRecords } from "../../db/mealRecords";
import { getSettings } from "../../db/settings";
import { getUnsyncedWeightRecords, saveWeightRecord } from "../../db/weightRecords";
import { runSync } from "../syncEngine";
import { SyncNotConfiguredError } from "../notConfiguredTransport";
import type { SyncPushPayload, SyncPushResult, SyncTransport } from "../types";

beforeEach(async () => {
  await db.weightRecords.clear();
  await db.mealRecords.clear();
  await db.settings.clear();
});

function fakeTransport(push: (payload: SyncPushPayload) => Promise<SyncPushResult>): SyncTransport {
  return { push };
}

describe("runSync", () => {
  it("skips without touching data when offline", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });
    const push = vi.fn();

    const outcome = await runSync({ transport: fakeTransport(push), isOnline: () => false });

    expect(outcome).toEqual({ status: "skipped-offline" });
    expect(push).not.toHaveBeenCalled();
    expect((await getUnsyncedWeightRecords())[0].synced).toBe(false);
  });

  it("skips when there is nothing unsynced", async () => {
    const push = vi.fn();

    const outcome = await runSync({ transport: fakeTransport(push), isOnline: () => true });

    expect(outcome).toEqual({ status: "skipped-nothing-to-sync" });
    expect(push).not.toHaveBeenCalled();
  });

  it("marks records synced and updates lastSyncedAt on success", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });
    const meal = await addMealRecord({
      mealType: "lunch",
      confirmedName: "鶏肉と野菜炒め",
      confirmedKcal: 580,
      confirmedProteinG: 40,
      confirmedFatG: 20,
      confirmedCarbsG: 50,
    });

    const push = vi.fn(async (payload: SyncPushPayload): Promise<SyncPushResult> => ({
      syncedWeightDates: payload.weightRecords.map((r) => r.date),
      syncedMealIds: payload.mealRecords.map((r) => r.id),
    }));

    const outcome = await runSync({ transport: fakeTransport(push), isOnline: () => true });

    expect(outcome).toEqual({ status: "success", syncedCount: 2 });
    expect(await getUnsyncedWeightRecords()).toHaveLength(0);
    expect(await getUnsyncedMealRecords()).toHaveLength(0);
    const settings = await getSettings();
    expect(settings.lastSyncedAt).toBeTruthy();
    expect(meal.synced).toBe(false); // 送信前のスナップショットは変更されない
  });

  it("keeps records unsynced and reports an error when the transport fails", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });
    const push = vi.fn(async () => {
      throw new Error("network down");
    });

    const outcome = await runSync({ transport: fakeTransport(push), isOnline: () => true });

    expect(outcome).toEqual({ status: "error", message: "network down" });
    expect((await getUnsyncedWeightRecords())[0].synced).toBe(false);
    const settings = await getSettings();
    expect(settings.lastSyncedAt).toBeUndefined();
  });

  it("only marks the subset of records the transport reports as succeeded", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });
    await saveWeightRecord({ date: "2026-07-02", weightKg: 71.9 });

    const push = vi.fn(async (payload: SyncPushPayload): Promise<SyncPushResult> => ({
      syncedWeightDates: [payload.weightRecords[0].date],
      syncedMealIds: [],
    }));

    await runSync({ transport: fakeTransport(push), isOnline: () => true });

    const unsynced = await getUnsyncedWeightRecords();
    expect(unsynced.map((r) => r.date)).toEqual(["2026-07-02"]);
  });

  it("defaults to the not-configured transport, surfacing a clear message", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });

    const outcome = await runSync({ isOnline: () => true });

    expect(outcome.status).toBe("error");
    if (outcome.status === "error") {
      expect(outcome.message).toBe(new SyncNotConfiguredError().message);
    }
  });
});
