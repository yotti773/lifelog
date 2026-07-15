import { axisTicks, xAxisTicks } from "./chartAxis";
import { formatDate, formatMonthDay } from "@/lib/date";
import type { WeightRecord } from "@/types";

interface WeightChartProps {
  records: WeightRecord[];
  goalWeightKg?: number;
}

const WIDTH = 320;
const HEIGHT = 180;
// topは目標ラベル、bottomはX軸日付ラベル、leftは縦軸の数値ラベル(Issue #60)の分
const PADDING = { top: 18, right: 12, bottom: 24, left: 34 };
const COLORS = {
  line: "#2EC4B6",
  area: "#2EC4B6",
  point: "#2EC4B6",
  pointBorder: "#FFF8F0",
  // アクセントのイエローは「達成した瞬間」専用のため、常時表示される目標線には使わずウォームグレーにする
  goal: "#8C8C8C",
  label: "#8C8C8C",
  grid: "#F0E7DB",
};

export default function WeightChart({ records, goalWeightKg }: WeightChartProps) {
  if (records.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          height: HEIGHT,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 16,
          background: "#FFF8F0",
          fontSize: 14,
          color: "#8C8C8C",
        }}
      >
        記録がありません
      </div>
    );
  }

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const times = sorted.map((r) => new Date(`${r.date}T00:00:00`).getTime());
  const minTime = times[0];
  const maxTime = times[times.length - 1];
  const timeSpan = maxTime - minTime || 1;

  // 縦軸レンジは体重の実測値だけから決める(目標を含めると実測が上端に圧縮され傾向が読みにくくなるため)。
  // 目標線は算出したレンジ内に収まる場合だけ描き、範囲外なら右上のラベルだけで示す。
  const weights = sorted.map((r) => r.weightKg);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const weightSpan = maxWeight - minWeight || 1;
  const yPad = weightSpan * 0.2 || 1;
  const scaledSpan = weightSpan + yPad * 2;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const baseY = PADDING.top + plotHeight;

  const xScale = (time: number) => PADDING.left + ((time - minTime) / timeSpan) * plotWidth;
  const yScale = (weight: number) =>
    PADDING.top + plotHeight - ((weight - (minWeight - yPad)) / scaledSpan) * plotHeight;

  const points = sorted.map((record, i) => ({
    x: xScale(times[i]),
    y: yScale(record.weightKg),
    record,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${baseY} L${points[0].x.toFixed(1)},${baseY} Z`;

  const goalInRange =
    goalWeightKg !== undefined && goalWeightKg >= minWeight - yPad && goalWeightKg <= maxWeight + yPad;
  const goalY = goalInRange ? yScale(goalWeightKg as number) : null;
  const ticks = axisTicks(minWeight - yPad, maxWeight + yPad);
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", display: "block" }} role="img" aria-label="体重推移グラフ">
      <defs>
        <linearGradient id="weightAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.area} stopOpacity={0.22} />
          <stop offset="100%" stopColor={COLORS.area} stopOpacity={0} />
        </linearGradient>
      </defs>

      {ticks.map((tick) => (
        <g key={tick.value}>
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={yScale(tick.value)}
            y2={yScale(tick.value)}
            stroke={COLORS.grid}
            strokeWidth={1}
          />
          <text x={PADDING.left - 5} y={yScale(tick.value) + 3} textAnchor="end" fontSize={9} fill={COLORS.label}>
            {tick.label}
          </text>
        </g>
      ))}

      {goalWeightKg !== undefined && (
        <text x={WIDTH - PADDING.right} y={12} textAnchor="end" fontSize={9} fill={COLORS.goal}>
          目標 {goalWeightKg}kg
        </text>
      )}
      {goalY !== null && (
        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={goalY}
          y2={goalY}
          stroke={COLORS.goal}
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
      )}

      <path d={areaPath} fill="url(#weightAreaGrad)" stroke="none" />
      <path
        d={linePath}
        fill="none"
        stroke={COLORS.line}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.slice(0, -1).map((p) => (
        <circle key={p.record.id} cx={p.x} cy={p.y} r={3} fill={COLORS.point} stroke={COLORS.pointBorder} strokeWidth={1.5} />
      ))}

      {/* 最新の点を大きく・リング付きで強調して「今」を目立たせる(Issue #128) */}
      <circle cx={last.x} cy={last.y} r={6.5} fill={COLORS.point} opacity={0.18} />
      <circle cx={last.x} cy={last.y} r={4.5} fill={COLORS.point} stroke={COLORS.pointBorder} strokeWidth={2} />

      {/* X軸: 両端+途中の日付目盛り。ラベルはX位置(時間軸)に対応する日付にする(点が不規則でもズレない。Issue #128) */}
      {xAxisTicks(sorted.length).map((tick) => (
        <text
          key={tick.fraction}
          x={PADDING.left + tick.fraction * plotWidth}
          y={HEIGHT - 5}
          textAnchor={tick.anchor}
          fontSize={9}
          fill={COLORS.label}
        >
          {formatMonthDay(formatDate(new Date(minTime + tick.fraction * timeSpan)))}
        </text>
      ))}
    </svg>
  );
}
