import { axisTicks, xAxisTicks } from "./chartAxis";
import { formatDate, formatMonthDay } from "@/lib/date";
import type { BloodPressureRecord } from "@/types";

interface BloodPressureChartProps {
  records: BloodPressureRecord[];
}

const WIDTH = 320;
const HEIGHT = 180;
const PADDING = { top: 18, right: 12, bottom: 24, left: 34 };
const COLORS = {
  systolic: "#FF6B4A", // 最高血圧(収縮期)
  diastolic: "#2EC4B6", // 最低血圧(拡張期)
  band: "#8C8C8C", // 最高〜最低の帯(脈圧)を薄く塗る中立色
  pointBorder: "#FFF8F0",
  label: "#8C8C8C",
  grid: "#F0E7DB",
};

/** 血圧推移グラフ(Issue #117)。最高・最低の上下2本線と、その間の帯を薄く塗る(Issue #128)。 */
export default function BloodPressureChart({ records }: BloodPressureChartProps) {
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
        血圧の記録がありません
      </div>
    );
  }

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const times = sorted.map((r) => new Date(`${r.date}T00:00:00`).getTime());
  const minTime = times[0];
  const maxTime = times[times.length - 1];
  const timeSpan = maxTime - minTime || 1;

  const values = sorted.flatMap((r) => [r.systolic, r.diastolic]);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueSpan = maxValue - minValue || 1;
  const yPad = valueSpan * 0.15 || 1;
  const scaledSpan = valueSpan + yPad * 2;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const xScale = (time: number) => PADDING.left + ((time - minTime) / timeSpan) * plotWidth;
  const yScale = (value: number) =>
    PADDING.top + plotHeight - ((value - (minValue - yPad)) / scaledSpan) * plotHeight;

  const buildLine = (pick: (r: BloodPressureRecord) => number) =>
    sorted
      .map((record, i) => `${i === 0 ? "M" : "L"}${xScale(times[i]).toFixed(1)},${yScale(pick(record)).toFixed(1)}`)
      .join(" ");

  // 最高線→(逆順で)最低線を繋いだ閉領域=脈圧の帯
  const bandPath =
    `${sorted.map((r, i) => `${i === 0 ? "M" : "L"}${xScale(times[i]).toFixed(1)},${yScale(r.systolic).toFixed(1)}`).join(" ")} ` +
    `${[...sorted].reverse().map((r) => `L${xScale(new Date(`${r.date}T00:00:00`).getTime()).toFixed(1)},${yScale(r.diastolic).toFixed(1)}`).join(" ")} Z`;

  const ticks = axisTicks(minValue - yPad, maxValue + yPad);
  const lastTime = times[times.length - 1];
  const lastRecord = sorted[sorted.length - 1];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", display: "block" }} role="img" aria-label="血圧推移グラフ">
      {ticks.map((tick) => (
        <g key={tick.value}>
          <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={yScale(tick.value)} y2={yScale(tick.value)} stroke={COLORS.grid} strokeWidth={1} />
          <text x={PADDING.left - 5} y={yScale(tick.value) + 3} textAnchor="end" fontSize={9} fill={COLORS.label}>
            {tick.label}
          </text>
        </g>
      ))}

      {sorted.length > 1 && <path d={bandPath} fill={COLORS.band} fillOpacity={0.08} stroke="none" />}

      {(["systolic", "diastolic"] as const).map((key) => (
        <path
          key={key}
          d={buildLine((r) => r[key])}
          fill="none"
          stroke={COLORS[key]}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {sorted.slice(0, -1).map((record, i) => (
        <g key={record.id}>
          <circle cx={xScale(times[i])} cy={yScale(record.systolic)} r={3.2} fill={COLORS.systolic} stroke={COLORS.pointBorder} strokeWidth={1.5} />
          <circle cx={xScale(times[i])} cy={yScale(record.diastolic)} r={3.2} fill={COLORS.diastolic} stroke={COLORS.pointBorder} strokeWidth={1.5} />
        </g>
      ))}

      {/* 最新の点を上下とも強調する(Issue #128) */}
      <g>
        <circle cx={xScale(lastTime)} cy={yScale(lastRecord.systolic)} r={4.5} fill={COLORS.systolic} stroke={COLORS.pointBorder} strokeWidth={2} />
        <circle cx={xScale(lastTime)} cy={yScale(lastRecord.diastolic)} r={4.5} fill={COLORS.diastolic} stroke={COLORS.pointBorder} strokeWidth={2} />
      </g>

      {/* X軸: 両端+途中の日付目盛り。ラベルはX位置(時間軸)に対応する日付にする(Issue #128) */}
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
