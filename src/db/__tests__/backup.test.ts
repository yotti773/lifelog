import { beforeEach, describe, expect, it } from "vitest";
import {
  BACKUP_TABLES,
  BACKUP_TABLE_LABELS,
  countBackupRows,
  exportBackupData,
  importBackupData,
  parseBackupData,
} from "@/db/backup";
import { db } from "@/db/db";
import { addMealRecord } from "@/db/mealRecords";
import { saveAdviceRecord } from "@/db/adviceRecords";
import { updateSettings } from "@/db/settings";
import { saveWeightRecord } from "@/db/weightRecords";
import type { AdviceRecord, WeeklyAdvice, WeeklyDigest } from "@/types";

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

const digest = { weekStart: "2026-07-27" } as unknown as WeeklyDigest;
const advice = { summary: "順調です", wins: [], actions: [] } as unknown as WeeklyAdvice;

describe("バックアップ対象テーブル", () => {
  it("syncDeletions以外のすべてのテーブルを対象にしている", () => {
    // テーブルを足したのにバックアップに入れ忘れる事故を防ぐ。実際にフェーズ2以降の
    // テーブルが漏れたまま放置されていた(Issue #164)
    const all = db.tables.map((table) => table.name).sort();
    const covered = [...BACKUP_TABLES, "syncDeletions"].sort();
    expect(covered).toEqual(all);
  });

  it("同期の途中状態であるsyncDeletionsは含めない", () => {
    expect(BACKUP_TABLES).not.toContain("syncDeletions");
  });

  it("すべての対象テーブルに表示名がある", () => {
    for (const name of BACKUP_TABLES) expect(BACKUP_TABLE_LABELS[name]).toBeTruthy();
  });
});

describe("exportBackupData", () => {
  it("シートに同期されないAIコメント・設定も書き出す", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });
    await addMealRecord({
      mealType: "lunch",
      confirmedName: "鶏肉と野菜炒め",
      confirmedKcal: 580,
      confirmedProteinG: 40,
      confirmedFatG: 20,
      confirmedCarbsG: 50,
    });
    await updateSettings({ goalWeightKg: 63 });
    await saveAdviceRecord("2026-07-27", digest, advice);

    const data = await exportBackupData();

    expect(data.version).toBe(2);
    expect(data.tables.weightRecords).toHaveLength(1);
    expect(data.tables.mealRecords).toHaveLength(1);
    expect(data.tables.settings[0].goalWeightKg).toBe(63);
    // ここが本命 — 再生成しても同じものが出ないため、退避できないと本当に失われる
    expect(data.tables.adviceRecords).toHaveLength(1);
    expect(data.tables.adviceRecords[0].weekStart).toBe("2026-07-27");
  });
});

describe("importBackupData", () => {
  it("既存データを全て置き換え、AIコメントも復元する", async () => {
    await saveWeightRecord({ date: "2026-01-01", weightKg: 80 });
    await saveAdviceRecord("2026-01-05", digest, advice);

    const restoreTarget: AdviceRecord = {
      weekStart: "2026-07-27",
      createdAt: "2026-08-03T00:00:00.000Z",
      digest,
      advice,
      synced: true,
    };
    const restored = await importBackupData(
      parseBackupData({
        version: 2,
        exportedAt: "2026-08-08T00:00:00.000Z",
        tables: {
          weightRecords: [
            { id: "2026-07-01", date: "2026-07-01", timestamp: "2026-07-01T08:00:00.000Z", weightKg: 72.1, synced: false },
          ],
          adviceRecords: [restoreTarget],
        },
      }),
    );

    const weights = await db.weightRecords.toArray();
    expect(weights).toHaveLength(1);
    expect(weights[0].date).toBe("2026-07-01");

    const advices = await db.adviceRecords.toArray();
    expect(advices).toHaveLength(1);
    expect(advices[0].weekStart).toBe("2026-07-27");

    expect(restored.weightRecords).toBe(1);
    expect(restored.adviceRecords).toBe(1);
  });

  it("復元先に残っていた削除トゥームストーンを消す", async () => {
    // 残すと、次の同期で「復元したレコードに対応するシートの行」が消される。
    // 復元レコードは synced: true のため再送信もされず、シート側から恒久的に失われる
    await db.syncDeletions.put({ id: "weight:2026-07-01", sheet: "weight", rowKey: "2026-07-01" } as never);
    expect(await db.syncDeletions.count()).toBe(1);

    await importBackupData(
      parseBackupData({
        version: 2,
        tables: {
          weightRecords: [
            { id: "2026-07-01", date: "2026-07-01", timestamp: "x", weightKg: 72.1, synced: true },
          ],
        },
      }),
    );

    expect(await db.syncDeletions.count()).toBe(0);
  });
});

describe("parseBackupData", () => {
  it("バックアップでないJSONを弾く", () => {
    expect(() => parseBackupData({ hello: "world" })).toThrow(/形式が正しくありません|データが含まれていません/);
    expect(() => parseBackupData("文字列")).toThrow();
  });

  it("全テーブルが空のファイルを弾く(誤って全消しするのを防ぐ)", () => {
    expect(() => parseBackupData({ version: 2, tables: { weightRecords: [] } })).toThrow(/空です/);
  });

  it("対象テーブルが配列でなければ弾く", () => {
    expect(() => parseBackupData({ version: 2, tables: { weightRecords: "こわれている" } })).toThrow(/壊れています/);
  });

  it("欠けているテーブルは空配列で補う", () => {
    const parsed = parseBackupData({
      version: 2,
      tables: { weightRecords: [{ date: "2026-07-01" }] },
    });
    for (const name of BACKUP_TABLES) expect(Array.isArray(parsed.tables[name])).toBe(true);
    expect(parsed.tables.adviceRecords).toEqual([]);
  });

  it("v1形式でも中身が空なら弾く(検証を素通りさせない)", () => {
    // v1分岐が早期returnしていると、切り詰められたJSONで全テーブルを失いうる
    expect(() =>
      parseBackupData({ exportedAt: "2026-07-01T00:00:00.000Z", weightRecords: [], mealRecords: [] }),
    ).toThrow(/空です/);
  });

  it("フェーズ1時代の形式(v1)を読み込める", () => {
    const parsed = parseBackupData({
      exportedAt: "2026-07-01T00:00:00.000Z",
      weightRecords: [{ id: "2026-07-01", date: "2026-07-01", timestamp: "x", weightKg: 72.1, synced: false }],
      mealRecords: [],
      settings: { goalWeightKg: 64, goalDate: "2026-10-31", dailyCalorieTarget: 1900 },
    });

    expect(parsed.version).toBe(1);
    expect(parsed.tables.weightRecords).toHaveLength(1);
    expect(parsed.tables.settings[0].id).toBe("default");
    expect(parsed.tables.settings[0].goalWeightKg).toBe(64);
  });
});

describe("countBackupRows", () => {
  it("テーブルごとの件数を返す", async () => {
    await saveWeightRecord({ date: "2026-07-01", weightKg: 72.1 });
    const counts = countBackupRows(await exportBackupData());
    expect(counts.weightRecords).toBe(1);
    expect(counts.habitRecords).toBe(0);
  });
});
