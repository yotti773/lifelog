import { describe, expect, it } from "vitest";
import {
  planBloodPressureImport,
  planBodyMeasurementImport,
  planHabitMasterImport,
  planHabitRecordImport,
} from "../sheetsImport";
import { BLOOD_PRESSURE_HEADER, BODY_MEASUREMENT_HEADER, HABIT_MASTER_HEADER, HABIT_RECORD_HEADER } from "../sheetsSync";

// 血圧・周囲径・習慣タブの取り込みパーサ(Issue #117・#118・#113)。
// 書き出し側(sheetsSync.tsのformatCalendarDate/formatJstDateTime)の逆変換を検証する。

describe("planBloodPressureImport", () => {
  it("日付・最高血圧・最低血圧が揃った行を取り込み、ID列が空なら日付を採番する", () => {
    const rows = [
      BLOOD_PRESSURE_HEADER,
      ["2026年07月05日", "128", "82", "66", "起床後", "2026年07月05日 07:00", ""],
    ];
    const plan = planBloodPressureImport(rows);
    expect(plan.records).toEqual([
      {
        id: "2026-07-05",
        date: "2026-07-05",
        timestamp: "2026-07-04T22:00:00.000Z",
        systolic: 128,
        diastolic: 82,
        pulse: 66,
        note: "起床後",
      },
    ]);
    expect(plan.idBackfills).toEqual([{ rowNumber: 2, id: "2026-07-05" }]);
    expect(plan.skippedRowCount).toBe(0);
  });

  it("最高血圧・最低血圧が欠けた行はスキップする(見出し行は数えない)", () => {
    const rows = [BLOOD_PRESSURE_HEADER, ["2026年07月05日", "", "", "", "", "", ""]];
    const plan = planBloodPressureImport(rows);
    expect(plan.records).toEqual([]);
    expect(plan.skippedRowCount).toBe(1);
  });

  it("同じ日付の2行目以降は重複としてスキップする", () => {
    const rows = [
      ["2026年07月05日", "128", "82", "", "", "", "2026-07-05"],
      ["2026年07月05日", "130", "84", "", "", "", "2026-07-05"],
    ];
    const plan = planBloodPressureImport(rows);
    expect(plan.records).toHaveLength(1);
    expect(plan.skippedRowCount).toBe(1);
  });
});

describe("planBodyMeasurementImport", () => {
  it("日付・腹囲が揃った行を取り込み、胸囲・太ももは任意で復元する", () => {
    const rows = [
      BODY_MEASUREMENT_HEADER,
      ["2026年07月05日", "82.5", "96", "", "", "2026年07月05日 07:00", "2026-07-05"],
    ];
    const plan = planBodyMeasurementImport(rows);
    expect(plan.records).toEqual([
      {
        id: "2026-07-05",
        date: "2026-07-05",
        timestamp: "2026-07-04T22:00:00.000Z",
        waistCm: 82.5,
        chestCm: 96,
      },
    ]);
    expect(plan.idBackfills).toEqual([]); // ID列に値があるので採番不要
  });

  it("腹囲が欠けた行はスキップする", () => {
    const rows = [BODY_MEASUREMENT_HEADER, ["2026年07月05日", "", "", "", "", "", ""]];
    const plan = planBodyMeasurementImport(rows);
    expect(plan.records).toEqual([]);
    expect(plan.skippedRowCount).toBe(1);
  });
});

describe("planHabitMasterImport", () => {
  const gen = (() => {
    let i = 0;
    return () => `habit-uuid-${++i}`;
  });

  it("習慣名を取り込み、目標頻度・アーカイブ・並び順を復元する。ID列が空ならUUIDを採番する", () => {
    const rows = [
      HABIT_MASTER_HEADER,
      ["ストレッチ", "5", "", "1", "2026年07月01日 09:00", ""],
      ["夜ふかししない", "", "アーカイブ", "2", "2026年07月01日 09:00", "hb-2"],
    ];
    const plan = planHabitMasterImport(rows, gen(), "2026-07-14T00:00:00.000Z");
    expect(plan.records).toEqual([
      {
        id: "habit-uuid-1",
        name: "ストレッチ",
        targetWeeklyFrequency: 5,
        archived: false,
        order: 1,
        createdAt: "2026-07-01T00:00:00.000Z",
      },
      {
        id: "hb-2",
        name: "夜ふかししない",
        archived: true,
        order: 2,
        createdAt: "2026-07-01T00:00:00.000Z",
      },
    ]);
    expect(plan.idBackfills).toEqual([{ rowNumber: 2, id: "habit-uuid-1" }]);
  });

  it("見出し行(先頭が習慣名ラベル)と同名の重複行はスキップする", () => {
    const rows = [
      HABIT_MASTER_HEADER,
      ["読書", "", "", "1", "", "hb-a"],
      ["読書", "", "", "2", "", "hb-b"], // 同名 → スキップ
    ];
    const plan = planHabitMasterImport(rows, gen(), "2026-07-14T00:00:00.000Z");
    expect(plan.records).toHaveLength(1);
    expect(plan.skippedRowCount).toBe(1);
  });
});

describe("planHabitRecordImport", () => {
  it("日付・習慣IDが揃った行を取り込み、レコードIDは常に`${date}_${habitId}`にする", () => {
    const rows = [
      HABIT_RECORD_HEADER,
      ["2026年07月05日", "ストレッチ", "hb-1", "2026年07月05日 21:00", ""],
    ];
    const plan = planHabitRecordImport(rows);
    expect(plan.records).toEqual([
      {
        id: "2026-07-05_hb-1",
        date: "2026-07-05",
        habitId: "hb-1",
        habitName: "ストレッチ",
        timestamp: "2026-07-05T12:00:00.000Z",
      },
    ]);
    // ID列が空(または合成キーと不一致)なので書き戻し対象
    expect(plan.idBackfills).toEqual([{ rowNumber: 2, id: "2026-07-05_hb-1" }]);
  });

  it("習慣IDが欠けた行はスキップし、同じ合成キーの2行目以降は重複としてスキップする", () => {
    const rows = [
      HABIT_RECORD_HEADER,
      ["2026年07月05日", "ストレッチ", "", "", ""], // 習慣IDなし → スキップ
      ["2026年07月05日", "ストレッチ", "hb-1", "", "2026-07-05_hb-1"],
      ["2026年07月05日", "ストレッチ", "hb-1", "", "2026-07-05_hb-1"], // 重複 → スキップ
    ];
    const plan = planHabitRecordImport(rows);
    expect(plan.records).toHaveLength(1);
    expect(plan.skippedRowCount).toBe(2);
  });
});
