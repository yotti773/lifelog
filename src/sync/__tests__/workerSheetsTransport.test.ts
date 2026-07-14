import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/db";
import { updateSettings } from "@/db/settings";
import { workerSheetsTransport } from "@/sync/workerSheetsTransport";
import type { SyncPushPayload } from "@/sync/types";

const payload: SyncPushPayload = {
  weightRecords: [],
  mealRecords: [],
  waterRecords: [],
  workoutRecords: [],
  diaryRecords: [],
  foodMasterItems: [],
  exerciseMasterItems: [],
  bloodPressureRecords: [],
  bodyMeasurementRecords: [],
  habitMasterItems: [],
  habitRecords: [],
  deletedWeightIds: [],
  deletedMealIds: [],
  deletedWaterIds: [],
  deletedWorkoutIds: [],
  deletedDiaryIds: [],
  deletedFoodMasterIds: [],
  deletedExerciseMasterIds: [],
  deletedBloodPressureIds: [],
  deletedBodyMeasurementIds: [],
  deletedHabitMasterIds: [],
  deletedHabitRecordIds: [],
};

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.settings.clear();
});

describe("workerSheetsTransport", () => {
  it("passes through the server's result on success (including partial success)", async () => {
    const result = { syncedWeightDates: ["2026-07-01"], syncedMealIds: [] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(result), { status: 200 })),
    );

    await expect(workerSheetsTransport.push(payload)).resolves.toEqual(result);
  });

  it("throws with the server-provided error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "Sheets APIエラー" }), { status: 502 })),
    );

    await expect(workerSheetsTransport.push(payload)).rejects.toThrow("Sheets APIエラー");
  });

  it("falls back to a generic message when the error body cannot be parsed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not json", { status: 500 })),
    );

    await expect(workerSheetsTransport.push(payload)).rejects.toThrow("同期に失敗しました (500)");
  });

  it("pull: passes through the server's import result on success", async () => {
    const result = {
      weightRecords: [{ id: "2026-07-01", date: "2026-07-01", timestamp: "2026-06-30T22:00:00.000Z", weightKg: 72.1 }],
      mealRecords: [],
      skippedWeightRows: 0,
      skippedMealRows: 1,
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(result), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(workerSheetsTransport.pull()).resolves.toEqual(result);
    // APIトークン未設定時はAuthorizationヘッダを付けない(Issue #87)
    expect(fetchMock).toHaveBeenCalledWith("/api/import-sheets", { headers: {} });
  });

  it("sends the configured API token as an Authorization header (Issue #87)", async () => {
    await updateSettings({ apiToken: "test-token" });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await workerSheetsTransport.push(payload);
    await workerSheetsTransport.pull();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/sync-sheets",
      expect.objectContaining({
        headers: { "content-type": "application/json", authorization: "Bearer test-token" },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/import-sheets", {
      headers: { authorization: "Bearer test-token" },
    });
  });

  it("pull: throws with the server-provided error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "Sheets APIエラー" }), { status: 502 })),
    );

    await expect(workerSheetsTransport.pull()).rejects.toThrow("Sheets APIエラー");
  });
});
