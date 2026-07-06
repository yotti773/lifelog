import { afterEach, describe, expect, it, vi } from "vitest";
import { workerSheetsTransport } from "@/sync/workerSheetsTransport";
import type { SyncPushPayload } from "@/sync/types";

const payload: SyncPushPayload = {
  weightRecords: [],
  mealRecords: [],
  deletedWeightIds: [],
  deletedMealIds: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
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
});
