/** 縦軸の目盛り1本分(グリッド線の値と表示ラベル) */
export interface AxisTick {
  value: number;
  label: string;
}

/**
 * グラフ縦軸の目盛りを計算する(Issue #60)。
 * min〜maxの範囲内に収まる「切りの良い」値(1・2・5×10^n刻み)をおよそtargetCount本返す。
 * ラベルは刻みが1未満なら小数1桁、それ以外は整数(桁区切り付き)で揃える。
 */
export function axisTicks(min: number, max: number, targetCount = 3): AxisTick[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [];

  const rawStep = (max - min) / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? 10 * magnitude;

  const ticks: AxisTick[] = [];
  // 加算による浮動小数の蓄積誤差(0.30000000000000004など)を各値で丸め直す
  for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-6; value += step) {
    const rounded = Number(value.toFixed(10));
    ticks.push({
      value: rounded,
      label: step < 1 ? rounded.toFixed(1) : rounded.toLocaleString(),
    });
  }
  return ticks;
}
