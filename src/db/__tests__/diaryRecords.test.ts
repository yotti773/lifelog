import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import {
  deleteDiaryRecord,
  getDiaryRecord,
  getUnsyncedDiaryRecords,
  markDiaryRecordsSynced,
  saveDiaryRecord,
} from "@/db/diaryRecords";
import { getPendingDeletionIds } from "@/db/syncDeletions";

beforeEach(async () => {
  await db.diaryRecords.clear();
  await db.syncDeletions.clear();
});

describe("diaryRecords", () => {
  it("saves and retrieves a record by date", async () => {
    await saveDiaryRecord({ date: "2026-07-01", text: "今日は調子が良い", mood: "good" });

    const record = await getDiaryRecord("2026-07-01");
    expect(record?.text).toBe("今日は調子が良い");
    expect(record?.mood).toBe("good");
    expect(record?.synced).toBe(false);
  });

  it("leaves mood undefined when not provided", async () => {
    await saveDiaryRecord({ date: "2026-07-01", text: "気分タグなし" });

    const record = await getDiaryRecord("2026-07-01");
    expect(record?.mood).toBeUndefined();
  });

  it("overwrites the same date instead of creating a second record (last-write-wins)", async () => {
    await saveDiaryRecord({ date: "2026-07-01", text: "1回目", mood: "great" });
    await saveDiaryRecord({ date: "2026-07-01", text: "2回目", mood: "tired" });

    expect(await db.diaryRecords.count()).toBe(1);
    const record = await getDiaryRecord("2026-07-01");
    expect(record?.text).toBe("2回目");
    expect(record?.mood).toBe("tired");
  });

  it("marks a saved record as unsynced so it is picked up next sync", async () => {
    // synced: true はmark関数経由でのみ立てる規約(CLAUDE.md)のため、ここでは保存後の状態のみ検証する
    await saveDiaryRecord({ date: "2026-07-01", text: "1回目" });
    expect((await getDiaryRecord("2026-07-01"))?.synced).toBe(false);

    await saveDiaryRecord({ date: "2026-07-01", text: "編集後" });
    expect((await getDiaryRecord("2026-07-01"))?.synced).toBe(false);
  });

  it("deletes the record for a date and leaves a sync tombstone", async () => {
    await saveDiaryRecord({ date: "2026-07-01", text: "消える" });

    await deleteDiaryRecord("2026-07-01");

    expect(await getDiaryRecord("2026-07-01")).toBeUndefined();
    expect(await getPendingDeletionIds("diary")).toEqual(["2026-07-01"]);
  });

  it("同じ日付を削除→再登録すると保留中の削除要求が取り消される", async () => {
    await saveDiaryRecord({ date: "2026-07-01", text: "消える" });
    await deleteDiaryRecord("2026-07-01");
    expect(await getPendingDeletionIds("diary")).toEqual(["2026-07-01"]);

    await saveDiaryRecord({ date: "2026-07-01", text: "書き直し" });
    expect(await getPendingDeletionIds("diary")).toEqual([]);
  });

  it("lists only unsynced records and marks them synced", async () => {
    await saveDiaryRecord({ date: "2026-07-01", text: "A" });
    await saveDiaryRecord({ date: "2026-07-02", text: "B" });

    expect((await getUnsyncedDiaryRecords()).map((r) => r.date).sort()).toEqual([
      "2026-07-01",
      "2026-07-02",
    ]);

    await markDiaryRecordsSynced(["2026-07-01"]);
    const unsynced = await getUnsyncedDiaryRecords();
    expect(unsynced.map((r) => r.date)).toEqual(["2026-07-02"]);
  });
});
