import { axisTicks } from "./chartAxis";
import { formatMonthDay } from "@/lib/date";
import type { BodyMeasurementRecord } from "@/types";

interface BodyMeasurementChartProps {
  records: BodyMeasurementRecord[];
}

const WIDTH = 320;
const HEIGHT = 160;
const PADDING = { top: 22, right: 12, bottom: 20, left: 34 };
const COLORS = {
  line: "#2EC4B6",
  point: "#2EC4B6",
  pointBorder: "#FFF8F0",
  label: "#8C8C8C",
  grid: "#F0E7DB",
};

/**
 * 周囲径(腹囲)推移グラフ(Issue #118)。手書きSVGの体重グラフと同じパターン。
 * 点が疎(月1程度)でも破綻しないよう、1点だけの場合は線を引かず点のみ描く。
 */
export default function BodyMeasurementChart({ records }: BodyMeasurementChartProps) {
  if (records.length === 0) {
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
        腹囲の記録がありません
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

  // 1点だけのときはX軸中央に置く(timeSpan=1で左端に寄るのを避ける)
  const xScale = (time: number) =>
    sorted.length === 1 ? PADDING.left + plotWidth / 2 : PADDING.left + ((time - minTime) / timeSpan) * plotWidth;
  const yScale = (value: number) =>
    PADDING.top + plotHeight - ((value - (minValue - yPad)) / scaledSpan) * plotHeight;

  const points = sorted.map((record, i) => ({ x: xScale(times[i]), y: yScale(record.waistCm), record }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const ticks = axisTicks(minValue - yPad, maxValue + yPad);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", display: "block" }} role="img" aria-label="腹囲推移グラフ">
      {ticks.map((tick) => (
        <g key={tick.value}>
          <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={yScale(tick.value)} y2={yScale(tick.value)} stroke={COLORS.grid} strokeWidth={1} />
          <text x={PADDING.left - 5} y={yScale(tick.value) + 3} textAnchor="end" fontSize={9} fill={COLORS.label}>
            {tick.label}
          </text>
        </g>
      ))}

      {points.length > 1 && (
        <path d={linePath} fill="none" stroke={COLORS.line} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      )}

      {points.map((p) => (
        <circle key={p.record.id} cx={p.x} cy={p.y} r={3.5} fill={COLORS.point} stroke={COLORS.pointBorder} strokeWidth={1.5} />
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
