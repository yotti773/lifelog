import { describe, expect, it } from "vitest";
import { isWeeklyAdvice } from "../weeklyAdviceValidation";

const VALID = {
  verdict: "on_track",
  summary: "順調です。",
  wins: ["毎日記録できました"],
  actions: ["たんぱく質を毎日130gとる"],
};

describe("isWeeklyAdvice", () => {
  it("スキーマを満たす値を受け入れる", () => {
    expect(isWeeklyAdvice(VALID)).toBe(true);
  });

  it.each([
    ["null", null],
    ["verdictが規定外", { ...VALID, verdict: "great" }],
    ["summaryが空白のみ", { ...VALID, summary: "  " }],
    ["winsが空配列", { ...VALID, wins: [] }],
    ["winsに空文字列", { ...VALID, wins: [""] }],
    ["actionsが配列でない", { ...VALID, actions: "頑張る" }],
    ["actionsが欠落", { verdict: "on_track", summary: "s", wins: ["w"] }],
  ])("不正な値を弾く: %s", (_name, value) => {
    expect(isWeeklyAdvice(value)).toBe(false);
  });
});
