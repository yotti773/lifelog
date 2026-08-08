import { beforeEach, describe, expect, it } from "vitest";
import {
  getUnsyncedAdviceRecords,
  getUnsyncedMonthlyAdviceRecords,
  markAdviceRecordsSynced,
  markMonthlyAdviceRecordsSynced,
  saveAdviceRecord,
  saveMonthlyAdviceRecord,
} from "@/db/adviceRecords";
import { db } from "@/db/db";
import type { MonthlyDigest, WeeklyAdvice, WeeklyDigest } from "@/types";

beforeEach(async () => {
  await db.adviceRecords.clear();
  await db.monthlyAdviceRecords.clear();
});

const weeklyDigest = { period: { start: "2026-08-03", end: "2026-08-09" } } as unknown as WeeklyDigest;
const monthlyDigest = { month: "2026-07" } as unknown as MonthlyDigest;
const advice: WeeklyAdvice = {
  verdict: "slightly_behind",
  summary: "週平均は下がっていますが、目標ペースには届いていません。",
  wins: ["記録率100%"],
  actions: ["朝の体重測定を継続"],
};

describe("週次AIコメントの同期状態(Issue #164)", () => {
  it("保存すると未同期になる(再生成のたびにシートへ送り直す)", async () => {
    const saved = await saveAdviceRecord("2026-08-03", weeklyDigest, advice);
    expect(saved.synced).toBe(false);
    expect(await getUnsyncedAdviceRecords()).toHaveLength(1);
  });

  it("同期済みにすると未同期一覧から外れる", async () => {
    await saveAdviceRecord("2026-08-03", weeklyDigest, advice);
    await markAdviceRecordsSynced(["2026-08-03"]);

    expect(await getUnsyncedAdviceRecords()).toHaveLength(0);
    expect((await db.adviceRecords.get("2026-08-03"))?.synced).toBe(true);
  });

  it("再生成すると同期済みから未同期へ戻る(内容が変わるため)", async () => {
    await saveAdviceRecord("2026-08-03", weeklyDigest, advice);
    await markAdviceRecordsSynced(["2026-08-03"]);

    await saveAdviceRecord("2026-08-03", weeklyDigest, { ...advice, summary: "再生成した総評" });

    const unsynced = await getUnsyncedAdviceRecords();
    expect(unsynced).toHaveLength(1);
    expect(unsynced[0].advice.summary).toBe("再生成した総評");
  });

  it("空配列を渡しても壊れない", async () => {
    await expect(markAdviceRecordsSynced([])).resolves.toBeUndefined();
  });
});

describe("月次AIコメントの同期状態(Issue #164)", () => {
  it("週次と同じ扱いで未同期→同期済みに遷移する", async () => {
    const saved = await saveMonthlyAdviceRecord("2026-07", monthlyDigest, advice);
    expect(saved.synced).toBe(false);
    expect(await getUnsyncedMonthlyAdviceRecords()).toHaveLength(1);

    await markMonthlyAdviceRecordsSynced(["2026-07"]);
    expect(await getUnsyncedMonthlyAdviceRecords()).toHaveLength(0);
  });
});
