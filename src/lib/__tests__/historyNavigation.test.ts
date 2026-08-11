import { describe, expect, it } from "vitest";
import { resolveCameFromHistory } from "../historyNavigation";

describe("resolveCameFromHistory", () => {
  it("state.from が history なら、今日の日付でも履歴から来たと判定する(Issue #120)", () => {
    expect(resolveCameFromHistory("history", true)).toBe(true);
  });

  it("state.from が history なら、過去日でも履歴から来たと判定する", () => {
    expect(resolveCameFromHistory("history", false)).toBe(true);
  });

  it("state.from が home なら、過去日でもホームから来たと判定する", () => {
    expect(resolveCameFromHistory("home", false)).toBe(false);
  });

  it("state.from が undefined(ページ再読み込み・直接URLアクセス)なら、日付で判定する: 過去日は履歴から", () => {
    expect(resolveCameFromHistory(undefined, false)).toBe(true);
  });

  it("state.from が undefined なら、今日の日付はホームから", () => {
    expect(resolveCameFromHistory(undefined, true)).toBe(false);
  });
});
