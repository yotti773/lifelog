import { describe, expect, it } from "vitest";
import { axisTicks } from "../chartAxis";

describe("axisTicks", () => {
  it("体重のような小さいレンジでは0.5〜2kg刻みの切りの良い値を返す", () => {
    const ticks = axisTicks(70.2, 75.8);
    expect(ticks.map((t) => t.value)).toEqual([72, 74]);
    expect(ticks.map((t) => t.label)).toEqual(["72", "74"]);
  });

  it("1未満の刻みになる場合はラベルを小数1桁で揃える", () => {
    const ticks = axisTicks(21.1, 22.4);
    expect(ticks.map((t) => t.value)).toEqual([21.5, 22]);
    expect(ticks.map((t) => t.label)).toEqual(["21.5", "22.0"]);
  });

  it("カロリーのような大きいレンジでは桁区切り付きの整数ラベルを返す", () => {
    const ticks = axisTicks(0, 2200);
    expect(ticks.map((t) => t.value)).toEqual([0, 1000, 2000]);
    expect(ticks.map((t) => t.label)).toEqual(["0", "1,000", "2,000"]);
  });

  it("範囲の端(min・max)を超える目盛りは返さない", () => {
    for (const tick of axisTicks(63.4, 88.1)) {
      expect(tick.value).toBeGreaterThanOrEqual(63.4);
      expect(tick.value).toBeLessThanOrEqual(88.1);
    }
  });

  it("範囲が空(max<=min)や不正値では空配列を返す", () => {
    expect(axisTicks(5, 5)).toEqual([]);
    expect(axisTicks(10, 3)).toEqual([]);
    expect(axisTicks(Number.NaN, 10)).toEqual([]);
  });
});
