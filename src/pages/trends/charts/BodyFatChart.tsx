import { axisTicks } from "./chartAxis";
import { formatMonthDay } from "@/lib/date";
import type { WeightRecord } from "@/types";

interface BodyFatChartProps {
  records: WeightRecord[];
}

const WIDTH = 320;
const HEIGHT = 160;
// leftは縦軸の数値ラベル(Issue #60)の分を確保している
const PADDING = { top: 22, right: 12, bottom: 20, left: 34 };
const COLORS = {
  line: "#FF6B4A",
  point: "#FF6B4A",
  pointBorder: "#FFF8F0",
  label: "#8C8C8C",
  grid: "#F0E7DB",
};

export default function BodyFatChart({ records }: BodyFatChartProps) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const recorded = sorted.filter((r) => r.bodyFatPercent !== undefined);

  if (recorded.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          height: 160,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 16,
          background: "#FFF8F0",
          fontSize: 14,
          color: "#8C8C8C",
        }}
      >
        体脂肪率の記録がありません
      </div>
    );
  }

  const times = sorted.map((r) => new Date(`${r.date}T00:00:00`).getTime());
  const minTime = times[0];
  const maxTime = times[times.length - 1];
  const timeSpan = maxTime - minTime || 1;

  const values = recorded.map((r) => r.bodyFatPercent as number);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueSpan = maxValue - minValue || 1;
  const yPad = valueSpan * 0.2 || 1;
  const scaledSpan = valueSpan + yPad * 2;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const xScale = (time: number) => PADDING.left + ((time - minTime) / timeSpan) * plotWidth;
  const yScale = (value: number) =>
    PADDING.top + plotHeight - ((value - (minValue - yPad)) / scaledSpan) * plotHeight;

  // 体脂肪率は任意入力のため、未記録の日をまたいでは線を繋げず、連続して記録がある区間ごとにセグメントを分ける
  const segments: { x: number; y: number; record: WeightRecord }[][] = [];
  let current: { x: number; y: number; record: WeightRecord }[] = [];
  for (const record of sorted) {
    if (record.bodyFatPercent === undefined) {
      if (current.length > 0) segments.push(current);
      current = [];
      continue;
    }
    current.push({
      x: xScale(new Date(`${record.date}T00:00:00`).getTime()),
      y: yScale(record.bodyFatPercent),
      record,
    });
  }
  if (current.length > 0) segments.push(current);

  const ticks = axisTicks(minValue - yPad, maxValue + yPad);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", display: "block" }} role="img" aria-label="体脂肪率推移グラフ">
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

      {segments.map((segment, i) => (
        <path
          key={i}
          d={segment.map((p, j) => `${j === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke={COLORS.line}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {segments.flat().map((p) => (
        <circle
          key={p.record.id}
          cx={p.x}
          cy={p.y}
          r={3.5}
          fill={COLORS.point}
          stroke={COLORS.pointBorder}
          strokeWidth={1.5}
        />
      ))}

      <text x={PADDING.left} y={HEIGHT - 4} fontSize={9} fill={COLORS.label}>
        {formatMonthDay(sorted[0].date)}
      </text>
      <text x={WIDTH - PADDING.right} y={HEIGHT - 4} textAnchor="end" fontSize={9} fill={COLORS.label}>
        {formatMonthDay(sorted[sorted.length - 1].date)}
      </text>
    </svg>
  );
}
