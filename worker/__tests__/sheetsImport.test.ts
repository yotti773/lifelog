import { describe, expect, it } from "vitest";
import {
  parseCalendarDate,
  parseCellNumber,
  parseJstDateTime,
  parseMealTypeCell,
  parseMoodCell,
  planActivityImport,
  planDiaryImport,
  planExerciseMasterImport,
  planFoodMasterImport,
  planMealImport,
  planWaterImport,
  planWeightImport,
  planWorkoutImport,
  type CellValue,
} from "../sheetsImport";
import { EXERCISE_MASTER_HEADER, FOOD_MASTER_HEADER, formatCalendarDate, formatJstDateTime } from "../sheetsSync";

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

describe("parseMoodCell", () => {
  it("日本語ラベルをDiaryMoodキーに逆変換する", () => {
    expect(parseMoodCell("絶好調")).toBe("great");
    expect(parseMoodCell("不調")).toBe("bad");
  });

  it("英語キーのままの値も受け付ける", () => {
    expect(parseMoodCell("good")).toBe("good");
  });

  it("空・未知の値はundefined", () => {
    expect(parseMoodCell("")).toBeUndefined();
    expect(parseMoodCell(undefined)).toBeUndefined();
    expect(parseMoodCell("最高")).toBeUndefined();
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

describe("planWaterImport", () => {
  const fullRow: CellValue[] = ["2026年07月05日 21:00", "350", "uuid-1"];
  const generateId = () => "generated-uuid";

  it("書き出し済みの行をレコードに逆変換する", () => {
    const plan = planWaterImport([fullRow], generateId);
    expect(plan.records).toEqual([
      { id: "uuid-1", timestamp: "2026-07-05T12:00:00.000Z", amountMl: 350 },
    ]);
    expect(plan.idBackfills).toEqual([]);
    expect(plan.skippedRowCount).toBe(0);
  });

  it("空のIDは採番して書き戻し対象にする", () => {
    const plan = planWaterImport([["2026/7/1 08:00", "200", ""]], generateId);
    expect(plan.records).toEqual([
      { id: "generated-uuid", timestamp: "2026-06-30T23:00:00.000Z", amountMl: 200 },
    ]);
    expect(plan.idBackfills).toEqual([{ rowNumber: 1, id: "generated-uuid" }]);
  });

  it("解釈できない1行目は見出し行とみなしスキップ数に数えず、2行目以降の不正行・重複IDは数える", () => {
    const header: CellValue[] = ["記録日時", "摂取量", "ID"];
    const invalid: CellValue[] = ["2026年07月05日 21:00", "摂取量なし", ""];
    const plan = planWaterImport([header, fullRow, invalid, fullRow], generateId);
    expect(plan.records).toHaveLength(1);
    expect(plan.skippedRowCount).toBe(2);
  });
});

describe("planWorkoutImport", () => {
  const fullRow: CellValue[] = [
    "2026年07月05日",
    "ベンチプレス",
    "1",
    "2",
    "60",
    "8",
    "2026年07月05日 20:00",
    "uuid-1",
  ];
  const generateId = () => "generated-uuid";

  it("書き出し済みの行をレコードに逆変換する", () => {
    const plan = planWorkoutImport([fullRow], generateId);
    expect(plan.records).toEqual([
      {
        id: "uuid-1",
        date: "2026-07-05",
        timestamp: "2026-07-05T11:00:00.000Z",
        exerciseName: "ベンチプレス",
        exerciseOrder: 1,
        setNumber: 2,
        weightKg: 60,
        reps: 8,
      },
    ]);
    expect(plan.idBackfills).toEqual([]);
    expect(plan.skippedRowCount).toBe(0);
  });

  it("タイムスタンプ・IDが空の手入力行も取り込み、IDは採番して書き戻し対象にする", () => {
    const plan = planWorkoutImport(
      [["2026/7/1", "スクワット", "1", "1", "80", "5", "", ""]],
      generateId,
    );
    expect(plan.records).toEqual([
      {
        id: "generated-uuid",
        date: "2026-07-01",
        // タイムスタンプ省略時はその日のJST 00:00
        timestamp: "2026-06-30T15:00:00.000Z",
        exerciseName: "スクワット",
        exerciseOrder: 1,
        setNumber: 1,
        weightKg: 80,
        reps: 5,
      },
    ]);
    expect(plan.idBackfills).toEqual([{ rowNumber: 1, id: "generated-uuid" }]);
  });

  it("解釈できない1行目は見出し行とみなしスキップ数に数えず、2行目以降の不正行・重複IDは数える", () => {
    const header: CellValue[] = ["日付", "種目名", "種目順", "セット番号", "重量", "回数", "記録日時", "ID"];
    const invalid: CellValue[] = ["2026年07月05日", "", "1", "1", "60", "8", "", ""];
    const plan = planWorkoutImport([header, fullRow, invalid, fullRow], generateId);
    expect(plan.records).toHaveLength(1);
    expect(plan.skippedRowCount).toBe(2);
  });
});

describe("planDiaryImport", () => {
  const fullRow: CellValue[] = ["2026年07月05日", "良い", "よく眠れた", "2026年07月05日 22:00", "2026-07-05"];

  it("書き出し済みの行をレコードに逆変換する", () => {
    const plan = planDiaryImport([fullRow]);
    expect(plan.records).toEqual([
      {
        id: "2026-07-05",
        date: "2026-07-05",
        timestamp: "2026-07-05T13:00:00.000Z",
        text: "よく眠れた",
        mood: "good",
      },
    ]);
    expect(plan.idBackfills).toEqual([]);
    expect(plan.skippedRowCount).toBe(0);
  });

  it("気分・本文・タイムスタンプ・IDが空の手入力行も取り込み、IDは日付で採番して書き戻し対象にする", () => {
    const plan = planDiaryImport([["2026/7/1", "", "", "", ""]]);
    expect(plan.records).toEqual([
      {
        id: "2026-07-01",
        date: "2026-07-01",
        // タイムスタンプ省略時はその日のJST 00:00
        timestamp: "2026-06-30T15:00:00.000Z",
        text: "",
      },
    ]);
    expect(plan.idBackfills).toEqual([{ rowNumber: 1, id: "2026-07-01" }]);
  });

  it("解釈できない1行目は見出し行とみなしスキップ数に数えず、2行目以降の不正行・重複日付は数える", () => {
    const header: CellValue[] = ["日付", "気分", "本文", "記録日時", "ID"];
    const invalid: CellValue[] = ["日付なし", "良い", "テスト", "", ""];
    const plan = planDiaryImport([header, fullRow, invalid, fullRow]);
    expect(plan.records).toHaveLength(1);
    expect(plan.skippedRowCount).toBe(2);
  });
});

describe("planActivityImport", () => {
  // scripts/garmin/garmin_to_sheet.py の書き出し形式(9列)
  const fullRow: CellValue[] = ["2026年07月05日", 8123, 2450, 620, 432, 78, 52, 35, 10];

  it("Garmin連携が書き出した行をレコードに逆変換する", () => {
    const plan = planActivityImport([fullRow]);
    expect(plan.records).toEqual([
      {
        date: "2026-07-05",
        steps: 8123,
        totalKcal: 2450,
        activeKcal: 620,
        sleepMinutes: 432,
        sleepScore: 78,
        restingHeartRate: 52,
        moderateIntensityMinutes: 35,
        vigorousIntensityMinutes: 10,
      },
    ]);
    expect(plan.idBackfills).toEqual([]);
    expect(plan.skippedRowCount).toBe(0);
  });

  it("欠測の項目(空セル)は省略してレコード化する(時計を着けなかった日など)", () => {
    const plan = planActivityImport([["2026/7/1", "5000", "", "", "", "", "", "", ""]]);
    expect(plan.records).toEqual([{ date: "2026-07-01", steps: 5000 }]);
  });

  it("数値が1つも無い行・日付が読めない行・重複日付をスキップし、見出し行は数えない", () => {
    const header: CellValue[] = ["日付", "歩数", "総消費カロリー"];
    const noValues: CellValue[] = ["2026年07月06日", "", "", "", "", "", "", "", ""];
    const invalidDate: CellValue[] = ["日付なし", 100];
    const plan = planActivityImport([header, fullRow, noValues, invalidDate, fullRow]);
    expect(plan.records).toHaveLength(1);
    expect(plan.skippedRowCount).toBe(3);
  });
});

describe("planFoodMasterImport", () => {
  // sheetsSync.ts の foodMasterItemToRow の書き出し形式(8列)
  const fullRow: CellValue[] = ["モスバーガー", 372, 15.2, 17, 40, "https://www.mos.jp/menu/pdf/nutrition.pdf", "2026年07月05日 21:00", "food-uuid-1"];
  const generateId = () => "generated-uuid";
  const nowIso = "2026-07-10T00:00:00.000Z";

  it("書き出し済みの行を品目に逆変換する", () => {
    const plan = planFoodMasterImport([fullRow], generateId, nowIso);
    expect(plan.records).toEqual([
      {
        id: "food-uuid-1",
        name: "モスバーガー",
        kcal: 372,
        proteinG: 15.2,
        fatG: 17,
        carbsG: 40,
        source: "https://www.mos.jp/menu/pdf/nutrition.pdf",
        createdAt: "2026-07-05T12:00:00.000Z",
      },
    ]);
    expect(plan.idBackfills).toEqual([]);
    expect(plan.skippedRowCount).toBe(0);
  });

  it("手入力行(PFC・出典・登録日時・ID無し)はPFC=0・登録日時=取り込み時刻で補い、IDを採番して書き戻し対象にする", () => {
    const plan = planFoodMasterImport([["おにぎり", "180", "", "", "", "", "", ""]], generateId, nowIso);
    expect(plan.records).toEqual([
      { id: "generated-uuid", name: "おにぎり", kcal: 180, proteinG: 0, fatG: 0, carbsG: 0, createdAt: nowIso },
    ]);
    expect(plan.idBackfills).toEqual([{ rowNumber: 1, id: "generated-uuid" }]);
  });

  it("品目名・カロリーが読めない行と重複ID・同名(前後空白無視)の2行目以降をスキップし、見出し行は数えない", () => {
    const noKcal: CellValue[] = ["カロリー無し", "", "", "", "", "", "", "id-x"];
    const sameName: CellValue[] = [" モスバーガー ", 999, 0, 0, 0, "", "", "food-uuid-2"];
    const sameId: CellValue[] = ["別品目", 100, 0, 0, 0, "", "", "food-uuid-1"];
    const plan = planFoodMasterImport([FOOD_MASTER_HEADER, fullRow, noKcal, sameName, sameId], generateId, nowIso);
    expect(plan.records).toHaveLength(1);
    expect(plan.skippedRowCount).toBe(3);
  });
});

describe("planExerciseMasterImport", () => {
  // sheetsSync.ts の exerciseMasterItemToRow の書き出し形式(3列)
  const fullRow: CellValue[] = ["ベンチプレス", "2026年07月05日 21:00", "ex-uuid-1"];
  const generateId = () => "generated-uuid";
  const nowIso = "2026-07-10T00:00:00.000Z";

  it("書き出し済みの行を種目に逆変換する", () => {
    const plan = planExerciseMasterImport([fullRow], generateId, nowIso);
    expect(plan.records).toEqual([
      { id: "ex-uuid-1", name: "ベンチプレス", createdAt: "2026-07-05T12:00:00.000Z" },
    ]);
    expect(plan.idBackfills).toEqual([]);
    expect(plan.skippedRowCount).toBe(0);
  });

  it("手入力行(登録日時・ID無し)は登録日時=取り込み時刻で補い、IDを採番して書き戻し対象にする", () => {
    const plan = planExerciseMasterImport([["スクワット", "", ""]], generateId, nowIso);
    expect(plan.records).toEqual([{ id: "generated-uuid", name: "スクワット", createdAt: nowIso }]);
    expect(plan.idBackfills).toEqual([{ rowNumber: 1, id: "generated-uuid" }]);
  });

  it("1行目の見出し(自動作成ヘッダー)は種目として取り込まない — 必須項目が名前だけのためパース失敗では弾けない", () => {
    const plan = planExerciseMasterImport([EXERCISE_MASTER_HEADER, fullRow], generateId, nowIso);
    expect(plan.records).toEqual([
      { id: "ex-uuid-1", name: "ベンチプレス", createdAt: "2026-07-05T12:00:00.000Z" },
    ]);
    expect(plan.skippedRowCount).toBe(0);
  });

  it("空行と重複ID・同名(前後空白無視)の2行目以降をスキップする", () => {
    const empty: CellValue[] = ["", "", ""];
    const sameName: CellValue[] = [" ベンチプレス ", "", "ex-uuid-2"];
    const sameId: CellValue[] = ["デッドリフト", "", "ex-uuid-1"];
    const plan = planExerciseMasterImport([fullRow, empty, sameName, sameId], generateId, nowIso);
    expect(plan.records).toHaveLength(1);
    expect(plan.skippedRowCount).toBe(3);
  });
});
