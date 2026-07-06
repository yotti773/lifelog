import { describe, expect, it } from "vitest";
import {
  formatCalendarDate,
  formatJstDateTime,
  planRowDeletions,
  planUpserts,
  type RowWrite,
} from "../sheetsSync";

describe("formatCalendarDate", () => {
  it("converts a YYYY-MM-DD key into yyyy年mm月dd日 without any timezone shift", () => {
    expect(formatCalendarDate("2026-07-05")).toBe("2026年07月05日");
  });
});

describe("formatJstDateTime", () => {
  it("converts a UTC ISO timestamp to JST (UTC+9) yyyy年mm月dd日 hh:mm", () => {
    expect(formatJstDateTime("2026-07-05T12:00:00.000Z")).toBe("2026年07月05日 21:00");
  });

  it("rolls over to the next JST calendar day when the UTC time is late enough", () => {
    expect(formatJstDateTime("2026-07-05T20:00:00.000Z")).toBe("2026年07月06日 05:00");
  });
});

describe("planUpserts", () => {
  const rows: RowWrite[] = [
    { id: "a", cells: ["A"] },
    { id: "b", cells: ["B"] },
    { id: "c", cells: ["C"] },
  ];

  it("既存IDは更新、未知のIDは追記に振り分ける", () => {
    const idToRows = new Map<string, number[]>([
      ["a", [3]],
      ["c", [7]],
    ]);
    const plan = planUpserts(rows, idToRows);
    expect(plan.updates).toEqual([
      { rowNumber: 3, cells: ["A"] },
      { rowNumber: 7, cells: ["C"] },
    ]);
    expect(plan.appends).toEqual([["B"]]);
  });

  it("同じIDが重複している場合は最初の行を更新対象にする", () => {
    const idToRows = new Map<string, number[]>([["a", [4, 9]]]);
    const plan = planUpserts([{ id: "a", cells: ["A"] }], idToRows);
    expect(plan.updates).toEqual([{ rowNumber: 4, cells: ["A"] }]);
    expect(plan.appends).toEqual([]);
  });
});

describe("planRowDeletions", () => {
  it("一致する行を降順で返し、存在しないIDは無視する", () => {
    const idToRows = new Map<string, number[]>([
      ["a", [2]],
      ["b", [5]],
    ]);
    expect(planRowDeletions(["a", "b", "missing"], idToRows)).toEqual([5, 2]);
  });

  it("重複行(過去の追記のみ設計で生じた同一IDの複数行)はすべて降順で削除対象にする", () => {
    const idToRows = new Map<string, number[]>([["a", [3, 8]]]);
    expect(planRowDeletions(["a"], idToRows)).toEqual([8, 3]);
  });

  it("削除対象が無ければ空配列", () => {
    expect(planRowDeletions([], new Map())).toEqual([]);
  });
});
