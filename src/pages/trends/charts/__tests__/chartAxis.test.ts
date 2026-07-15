import { describe, expect, it } from "vitest";
import { axisTicks, xAxisTicks } from "../chartAxis";

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

describe("xAxisTicks", () => {
  it("点が十分あれば両端+中間の等間隔ラベル位置を返し、端はプロット外へはみ出さないアンカーになる", () => {
    const ticks = xAxisTicks(20, 4);
    expect(ticks.map((t) => t.fraction)).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(ticks.map((t) => t.anchor)).toEqual(["start", "middle", "middle", "middle", "end"]);
  });

  it("点が少ないときは区間数を点数-1に丸めて重複ラベルを防ぐ", () => {
    expect(xAxisTicks(3, 4).map((t) => t.fraction)).toEqual([0, 0.5, 1]);
    expect(xAxisTicks(2, 4).map((t) => t.fraction)).toEqual([0, 1]);
  });

  it("週表示など点が少ない(denseUpTo以下)ときは全点にラベルを出す", () => {
    // 週=7点なら7ラベルすべて出す
    expect(xAxisTicks(7)).toHaveLength(7);
    // 8点以上は maxIntervals(既定4本=5ラベル)に間引く
    expect(xAxisTicks(8)).toHaveLength(5);
    expect(xAxisTicks(30)).toHaveLength(5);
  });

  it("点が1つ以下なら中央に1つだけ返す", () => {
    expect(xAxisTicks(1)).toEqual([{ fraction: 0.5, anchor: "middle" }]);
    expect(xAxisTicks(0)).toEqual([{ fraction: 0.5, anchor: "middle" }]);
  });
});
