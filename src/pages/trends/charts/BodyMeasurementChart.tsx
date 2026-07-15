import { axisTicks, xAxisTicks } from "./chartAxis";
import { formatDate, formatMonthDay } from "@/lib/date";
import type { BodyMeasurementRecord } from "@/types";

interface BodyMeasurementChartProps {
  records: BodyMeasurementRecord[];
}

const WIDTH = 320;
const HEIGHT = 180;
const PADDING = { top: 18, right: 12, bottom: 24, left: 34 };
const COLORS = {
  line: "#2EC4B6",
  area: "#2EC4B6",
  point: "#2EC4B6",
  pointBorder: "#FFF8F0",
  label: "#8C8C8C",
  grid: "#F0E7DB",
};

/**
 * 周囲径(腹囲)推移グラフ(Issue #118)。手書きSVGの体重グラフと同じパターン。
 * 点が疎(月1程度)でも破綻しないよう、1点だけの場合は線・面を引かず点のみ描く。
 */
export default function BodyMeasurementChart({ records }: BodyMeasurementChartProps) {
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
        おなか周りの記録がありません
      </div>
    );
  }

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const times = sorted.map((r) => new Date(`${r.date}T00:00:00`).getTime());
  const minTime = times[0];
  const maxTime = times[times.length - 1];
  const timeSpan = maxTime - minTime || 1;

  const values = sorted.map((r) => r.waistCm);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueSpan = maxValue - minValue || 1;
  const yPad = valueSpan * 0.2 || 1;
  const scaledSpan = valueSpan + yPad * 2;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const baseY = PADDING.top + plotHeight;

  // 1点だけのときはX軸中央に置く(timeSpan=1で左端に寄るのを避ける)
  const single = sorted.length === 1;
  const xScale = (time: number) =>
    single ? PADDING.left + plotWidth / 2 : PADDING.left + ((time - minTime) / timeSpan) * plotWidth;
  const yScale = (value: number) =>
    PADDING.top + plotHeight - ((value - (minValue - yPad)) / scaledSpan) * plotHeight;

  const points = sorted.map((record, i) => ({ x: xScale(times[i]), y: yScale(record.waistCm), record }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${baseY} L${points[0].x.toFixed(1)},${baseY} Z`;
  const ticks = axisTicks(minValue - yPad, maxValue + yPad);
  const last = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", display: "block" }} role="img" aria-label="おなか周りの推移グラフ">
      <defs>
        <linearGradient id="measureAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.area} stopOpacity={0.2} />
          <stop offset="100%" stopColor={COLORS.area} stopOpacity={0} />
        </linearGradient>
      </defs>

      {ticks.map((tick) => (
        <g key={tick.value}>
          <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={yScale(tick.value)} y2={yScale(tick.value)} stroke={COLORS.grid} strokeWidth={1} />
          <text x={PADDING.left - 5} y={yScale(tick.value) + 3} textAnchor="end" fontSize={9} fill={COLORS.label}>
            {tick.label}
          </text>
        </g>
      ))}

      {points.length > 1 && (
        <>
          <path d={areaPath} fill="url(#measureAreaGrad)" stroke="none" />
          <path d={linePath} fill="none" stroke={COLORS.line} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {points.slice(0, -1).map((p) => (
        <circle key={p.record.id} cx={p.x} cy={p.y} r={3.5} fill={COLORS.point} stroke={COLORS.pointBorder} strokeWidth={1.5} />
      ))}

      {/* 最新の点を強調(Issue #128) */}
      <circle cx={last.x} cy={last.y} r={6.5} fill={COLORS.point} opacity={0.18} />
      <circle cx={last.x} cy={last.y} r={4.5} fill={COLORS.point} stroke={COLORS.pointBorder} strokeWidth={2} />

      {/* X軸: 両端+途中の日付目盛り。ラベルはX位置(時間軸)に対応する日付にする(点が疎でもズレない。単点なら中央に1つ。Issue #128) */}
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
