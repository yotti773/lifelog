import { describe, expect, it } from "vitest";
import { buildRecordedDateSet, countRecordedDaysInRange, currentStreakDays } from "../recording";

describe("buildRecordedDateSet", () => {
  it("体重・食事どちらかの記録がある日を「記録した日」とする", () => {
    const set = buildRecordedDateSet(["2026-07-08"], ["2026-07-08", "2026-07-09"]);
    expect([...set].sort()).toEqual(["2026-07-08", "2026-07-09"]);
  });
});

describe("currentStreakDays", () => {
  it("今日を含めて連続日数を数える", () => {
    const set = new Set(["2026-07-08", "2026-07-09", "2026-07-10"]);
    expect(currentStreakDays(set, "2026-07-10")).toBe(3);
  });

  it("今日まだ未記録でも、昨日まで連続していれば継続中として数える", () => {
    const set = new Set(["2026-07-08", "2026-07-09"]);
    expect(currentStreakDays(set, "2026-07-10")).toBe(2);
  });

  it("昨日も今日も未記録なら0(連続が切れている)", () => {
    const set = new Set(["2026-07-08"]);
    expect(currentStreakDays(set, "2026-07-10")).toBe(0);
  });

  it("途中に抜けがあればそこで止まる", () => {
    const set = new Set(["2026-07-06", "2026-07-08", "2026-07-09", "2026-07-10"]);
    expect(currentStreakDays(set, "2026-07-10")).toBe(3);
  });

  it("記録が1件も無ければ0", () => {
    expect(currentStreakDays(new Set(), "2026-07-10")).toBe(0);
  });

  it("月またぎでも連続を数えられる", () => {
    const set = new Set(["2026-06-29", "2026-06-30", "2026-07-01"]);
    expect(currentStreakDays(set, "2026-07-01")).toBe(3);
  });
});

describe("countRecordedDaysInRange", () => {
  it("範囲内(両端含む)の記録日数を数える", () => {
    const set = new Set(["2026-07-06", "2026-07-08", "2026-07-12", "2026-07-13"]);
    // 2026-07-06(月)〜07-12(日)の週: 06, 08, 12 の3日(13は翌週)
    expect(countRecordedDaysInRange(set, "2026-07-06", "2026-07-12")).toBe(3);
  });

  it("記録が無ければ0", () => {
    expect(countRecordedDaysInRange(new Set(), "2026-07-06", "2026-07-12")).toBe(0);
  });
});
