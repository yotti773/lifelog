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

/** 横軸(時間軸)の目盛り1本分。fraction=0〜1の位置と、はみ出さないためのテキストアンカー */
export interface XAxisTick {
  /** プロット領域内での位置(0=左端, 1=右端) */
  fraction: number;
  /** 端の目盛りはラベルがプロット外へはみ出さないよう端寄せにする */
  anchor: "start" | "middle" | "end";
}

/**
 * 横軸ラベルを両端だけでなく途中にも等間隔で置くための位置を返す(Issue #128)。
 * intervals本の区間に区切り、両端は端寄せ・中間は中央寄せのアンカーを付ける。
 * データ点が少ない場合は区間数を points-1 に丸めて重複ラベルを防ぐ。
 */
export function xAxisTicks(pointCount: number, intervals = 4): XAxisTick[] {
  const n = Math.min(Math.floor(intervals), Math.floor(pointCount) - 1);
  // 点が1つ以下(区間が作れない)なら中央に1本だけ返す
  if (!Number.isFinite(n) || n < 1) return [{ fraction: 0.5, anchor: "middle" }];
  const ticks: XAxisTick[] = [];
  for (let i = 0; i <= n; i++) {
    ticks.push({ fraction: i / n, anchor: i === 0 ? "start" : i === n ? "end" : "middle" });
  }
  return ticks;
}
