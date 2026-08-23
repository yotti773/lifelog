import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/db";
import { updateSettings } from "@/db/settings";
import { googleSheetsTransport } from "@/sync/googleSheetsTransport";
import type { SyncPushPayload } from "@/sync/types";

// access tokenの取得(#214)はこのテストの関心外。実際の認可フローはgoogleOAuth.test.tsが見る
vi.mock("@/api/googleOAuth", () => ({
  getGoogleAccessToken: vi.fn(async () => "test-access-token"),
}));

const emptyPayload: SyncPushPayload = {
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
  settingsEntries: [],
  adviceRecords: [],
  monthlyAdviceRecords: [],
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

const withWeight: SyncPushPayload = {
  ...emptyPayload,
  weightRecords: [
    { id: "2026-07-01", date: "2026-07-01", timestamp: "2026-06-30T22:00:00.000Z", weightKg: 72.1, synced: false },
  ],
};

beforeEach(async () => {
  await db.settings.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("googleSheetsTransport", () => {
  it("シートが未作成なら、通信する前に設定画面へ誘導するエラーになる", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(googleSheetsTransport.push(withWeight)).rejects.toThrow(/スプレッドシートがありません/);
    await expect(googleSheetsTransport.pull()).rejects.toThrow(/スプレッドシートがありません/);
    // 送信先が決まらない以上、1回もリクエストしない(未同期フラグはそのまま残る)
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Google Sheets APIを直接叩き、access tokenをAuthorizationヘッダで送る", async () => {
    await updateSettings({ spreadsheetId: "sheet-1" });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ values: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await googleSheetsTransport.push(withWeight);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    // Worker(/api/*)ではなくGoogleへ直接行くこと自体が本Issue(#215)の要件
    expect(url).toContain("https://sheets.googleapis.com/v4/spreadsheets/sheet-1");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-access-token");
  });

  it("送るものが何も無ければ、1回もリクエストしない", async () => {
    await updateSettings({ spreadsheetId: "sheet-1" });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(googleSheetsTransport.push(emptyPayload)).resolves.toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Sheets APIのエラーはメッセージ付きで呼び出し元へ伝わる", async () => {
    await updateSettings({ spreadsheetId: "sheet-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Sheets APIエラー" } }), { status: 403 })),
    );

    await expect(googleSheetsTransport.pull()).rejects.toThrow(/Sheets APIエラー|403/);
  });
});
