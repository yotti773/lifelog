import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import { deleteDiaryRecord, getDiaryRecord, saveDiaryRecord } from "@/db/diaryRecords";

beforeEach(async () => {
  await db.diaryRecords.clear();
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

  it("resets synced to false when overwriting a synced record", async () => {
    await saveDiaryRecord({ date: "2026-07-01", text: "同期済みになる" });
    await db.diaryRecords.where("date").equals("2026-07-01").modify({ synced: true });

    await saveDiaryRecord({ date: "2026-07-01", text: "編集後" });

    const record = await getDiaryRecord("2026-07-01");
    expect(record?.synced).toBe(false);
  });

  it("deletes the record for a date", async () => {
    await saveDiaryRecord({ date: "2026-07-01", text: "消える" });

    await deleteDiaryRecord("2026-07-01");

    expect(await getDiaryRecord("2026-07-01")).toBeUndefined();
  });
});
