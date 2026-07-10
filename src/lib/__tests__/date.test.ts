import { describe, expect, it } from "vitest";
import { addDaysToDateString, daysBetween, weekStartOf } from "../date";

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
