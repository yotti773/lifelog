import { describe, expect, it } from "vitest";
import {
  addDaysToDateString,
  addMonthsToMonthKey,
  daysBetween,
  formatMonthKey,
  monthKeyOfWeek,
  weekStartOf,
  weekStartsOfMonth,
} from "../date";

describe("addDaysToDateString", () => {
  it("日数を加算する(月またぎ)", () => {
    expect(addDaysToDateString("2026-07-30", 3)).toBe("2026-08-02");
  });

  it("負数で過去方向(年またぎ)", () => {
    expect(addDaysToDateString("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("daysBetween", () => {
  it("end − start の日数差を返す", () => {
    expect(daysBetween("2026-07-10", "2026-10-31")).toBe(113);
    expect(daysBetween("2026-07-10", "2026-07-10")).toBe(0);
    expect(daysBetween("2026-07-10", "2026-07-01")).toBe(-9);
  });
});

describe("weekStartOf", () => {
  it("週の開始は月曜(月曜〜日曜。画面設計書8.2章)", () => {
    expect(weekStartOf("2026-07-06")).toBe("2026-07-06"); // 月曜はその日自身
    expect(weekStartOf("2026-07-08")).toBe("2026-07-06"); // 水曜
    expect(weekStartOf("2026-07-12")).toBe("2026-07-06"); // 日曜は前の月曜に属する
    expect(weekStartOf("2026-07-13")).toBe("2026-07-13"); // 翌月曜
  });
});

describe("monthKeyOfWeek", () => {
  it("週が属する月は、その週の日曜(週の終わり)が含まれる月(Issue #114)", () => {
    // 2026-06-29(月)〜07-05(日)の週は、日曜が7月なので7月に属する
    expect(monthKeyOfWeek("2026-06-29")).toBe("2026-07");
    expect(monthKeyOfWeek("2026-07-06")).toBe("2026-07");
    // 2026-07-27(月)〜08-02(日)の週は、日曜が8月なので8月に属する
    expect(monthKeyOfWeek("2026-07-27")).toBe("2026-08");
  });
});

describe("weekStartsOfMonth", () => {
  it("月に属する週の月曜を昇順で返す(その月に日曜が含まれる週の集合)", () => {
    // 2026年7月: 日曜が7月に落ちる週は6/29週(日曜7/5)〜7/20週(日曜7/26)の4週。
    // 7/27週は日曜が8/2のため8月に属する(週を分割せず日曜の月へ丸ごと割り当てる)
    expect(weekStartsOfMonth("2026-07")).toEqual([
      "2026-06-29",
      "2026-07-06",
      "2026-07-13",
      "2026-07-20",
    ]);
  });

  it("全ての週がちょうど1つの月に属する(隣接月と重複・欠落しない)", () => {
    // 7月の翌週(7/27週。日曜8/2)は8月の先頭週になり、7月には現れない
    const july = weekStartsOfMonth("2026-07");
    const august = weekStartsOfMonth("2026-08");
    expect(august[0]).toBe(addDaysToDateString(july[july.length - 1], 7));
    expect(july.filter((w) => august.includes(w))).toEqual([]);
  });

  it("5週になる月もある(2026年8月は日曜が8月に落ちる週が5つ)", () => {
    expect(weekStartsOfMonth("2026-08")).toEqual([
      "2026-07-27",
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
    ]);
  });
});

describe("addMonthsToMonthKey", () => {
  it("月を加減算する(年またぎ)", () => {
    expect(addMonthsToMonthKey("2026-07", 1)).toBe("2026-08");
    expect(addMonthsToMonthKey("2026-12", 1)).toBe("2027-01");
    expect(addMonthsToMonthKey("2026-01", -1)).toBe("2025-12");
  });
});

describe("formatMonthKey", () => {
  it("YYYY-MMを「YYYY年M月」に変換する(0埋めを外す)", () => {
    expect(formatMonthKey("2026-07")).toBe("2026年7月");
    expect(formatMonthKey("2026-12")).toBe("2026年12月");
  });
});
