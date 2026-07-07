import { describe, expect, it } from "vitest";
import {
  parseCalendarDate,
  parseCellNumber,
  parseJstDateTime,
  parseMealTypeCell,
  planMealImport,
  planWeightImport,
  type CellValue,
} from "../sheetsImport";
import { formatCalendarDate, formatJstDateTime } from "../sheetsSync";

describe("parseCalendarDate", () => {
  it("書き出し形式(yyyy年mm月dd日)をYYYY-MM-DDに戻す(formatCalendarDateの逆変換)", () => {
    expect(parseCalendarDate(formatCalendarDate("2026-07-05"))).toBe("2026-07-05");
  });

  it("Sheetsのロケール表示や手入力のスラッシュ・ハイフン区切り(ゼロ埋め無し)も受け付ける", () => {
    expect(parseCalendarDate("2026/7/5")).toBe("2026-07-05");
    expect(parseCalendarDate("2026-7-5")).toBe("2026-07-05");
  });

  it("日付として解釈できない値はnull", () => {
    expect(parseCalendarDate("日付")).toBeNull();
    expect(parseCalendarDate("")).toBeNull();
    expect(parseCalendarDate(undefined)).toBeNull();
    expect(parseCalendarDate("2026年13月01日")).toBeNull();
  });
});

describe("parseJstDateTime", () => {
  it("書き出し形式(yyyy年mm月dd日 hh:mm)をUTCのISO8601に戻す(formatJstDateTimeの逆変換)", () => {
    expect(parseJstDateTime(formatJstDateTime("2026-07-05T12:00:00.000Z"))).toBe("2026-07-05T12:00:00.000Z");
  });

  it("JSTの早朝はUTCでは前日に繰り下がる", () => {
    expect(parseJstDateTime("2026年07月06日 05:00")).toBe("2026-07-05T20:00:00.000Z");
  });

  it("時刻を省略した手入力行はJSTの00:00として扱う", () => {
    expect(parseJstDateTime("2026年07月05日")).toBe("2026-07-04T15:00:00.000Z");
  });

  it("スラッシュ区切り・秒付きも受け付ける", () => {
    expect(parseJstDateTime("2026/7/5 21:00")).toBe("2026-07-05T12:00:00.000Z");
    expect(parseJstDateTime("2026/07/05 21:00:30")).toBe("2026-07-05T12:00:30.000Z");
  });

  it("解釈できない値はnull", () => {
    expect(parseJstDateTime("時刻")).toBeNull();
    expect(parseJstDateTime("")).toBeNull();
    expect(parseJstDateTime("2026年07月05日 25:00")).toBeNull();
  });
});

describe("parseCellNumber", () => {
  it("数値・数値文字列・桁区切りカンマ付きを受け付ける", () => {
    expect(parseCellNumber(72.1)).toBe(72.1);
    expect(parseCellNumber("72.1")).toBe(72.1);
    expect(parseCellNumber("1,200")).toBe(1200);
  });

  it("空・非数値はnull", () => {
    expect(parseCellNumber("")).toBeNull();
    expect(parseCellNumber(undefined)).toBeNull();
    expect(parseCellNumber("体重")).toBeNull();
  });
});

describe("parseMealTypeCell", () => {
  it("日本語ラベルをMealTypeキーに逆変換する", () => {
    expect(parseMealTypeCell("朝食")).toBe("breakfast");
    expect(parseMealTypeCell("間食")).toBe("snack");
  });

  it("英語キーのままの値(ラベル未定義区分の書き出し)も受け付ける", () => {
    expect(parseMealTypeCell("lunch")).toBe("lunch");
  });

  it("未知の値はnull", () => {
    expect(parseMealTypeCell("区分")).toBeNull();
    expect(parseMealTypeCell("")).toBeNull();
  });
});

describe("planWeightImport", () => {
  const fullRow: CellValue[] = ["2026年07月05日", "72.1", "22.5", "夜遅めの食事", "2026年07月05日 21:00", "2026-07-05"];

  it("書き出し済みの行をレコードに逆変換する", () => {
    const plan = planWeightImport([fullRow]);
    expect(plan.records).toEqual([
      {
        id: "2026-07-05",
        date: "2026-07-05",
        timestamp: "2026-07-05T12:00:00.000Z",
        weightKg: 72.1,
        bodyFatPercent: 22.5,
        note: "夜遅めの食事",
      },
    ]);
    expect(plan.idBackfills).toEqual([]);
    expect(plan.skippedRowCount).toBe(0);
  });

  it("体脂肪率・メモ・タイムスタンプ・IDが空の手入力行も取り込み、IDは日付で採番して書き戻し対象にする", () => {
    const plan = planWeightImport([["2026/7/1", "73", "", "", "", ""]]);
    expect(plan.records).toEqual([
      {
        id: "2026-07-01",
        date: "2026-07-01",
        // タイムスタンプ省略時はその日のJST 00:00
        timestamp: "2026-06-30T15:00:00.000Z",
        weightKg: 73,
      },
    ]);
    expect(plan.idBackfills).toEqual([{ rowNumber: 1, id: "2026-07-01" }]);
  });

  it("解釈できない1行目は見出し行とみなしスキップ数に数えない", () => {
    const plan = planWeightImport([["日付", "体重", "体脂肪率", "メモ", "記録時刻", "ID"], fullRow]);
    expect(plan.records).toHaveLength(1);
    expect(plan.skippedRowCount).toBe(0);
  });

  it("2行目以降の解釈できない行と、同じ日付の重複行はスキップ数に数える", () => {
    const plan = planWeightImport([fullRow, ["2026年07月06日", "体重なし"], fullRow]);
    expect(plan.records).toHaveLength(1);
    expect(plan.skippedRowCount).toBe(2);
  });
});

describe("planMealImport", () => {
  const fullRow: CellValue[] = ["2026年07月05日 12:30", "昼食", "鶏肉と野菜炒め", "580", "40", "20", "50", "uuid-1"];
  const generateId = () => "generated-uuid";

  it("書き出し済みの行をレコードに逆変換する", () => {
    const plan = planMealImport([fullRow], generateId);
    expect(plan.records).toEqual([
      {
        id: "uuid-1",
        timestamp: "2026-07-05T03:30:00.000Z",
        mealType: "lunch",
        confirmedName: "鶏肉と野菜炒め",
        confirmedKcal: 580,
        confirmedProteinG: 40,
        confirmedFatG: 20,
        confirmedCarbsG: 50,
      },
    ]);
    expect(plan.idBackfills).toEqual([]);
    expect(plan.skippedRowCount).toBe(0);
  });

  it("PFCが空の手入力行は0として取り込み、空のIDは採番して書き戻し対象にする", () => {
    const plan = planMealImport([["2026/7/1", "間食", "プロテインバー", "200", "", "", "", ""]], generateId);
    expect(plan.records).toEqual([
      {
        id: "generated-uuid",
        timestamp: "2026-06-30T15:00:00.000Z",
        mealType: "snack",
        confirmedName: "プロテインバー",
        confirmedKcal: 200,
        confirmedProteinG: 0,
        confirmedFatG: 0,
        confirmedCarbsG: 0,
      },
    ]);
    expect(plan.idBackfills).toEqual([{ rowNumber: 1, id: "generated-uuid" }]);
  });

  it("解釈できない1行目は見出し行とみなしスキップ数に数えず、2行目以降の不正行・重複IDは数える", () => {
    const header: CellValue[] = ["日時", "区分", "品名", "kcal", "P", "F", "C", "ID"];
    const invalid: CellValue[] = ["2026年07月05日 12:30", "不明な区分", "何か", "100", "", "", "", ""];
    const plan = planMealImport([header, fullRow, invalid, fullRow], generateId);
    expect(plan.records).toHaveLength(1);
    expect(plan.skippedRowCount).toBe(2);
  });
});
