import type { DailyWaterTotal } from "@/db/waterRecords";
import { formatMonthDay } from "@/lib/date";
import { tokens } from "@/theme";

interface WaterChartProps {
  data: DailyWaterTotal[];
  /** 目標水分摂取量(ml)。未設定(null)の間は目標ラインを表示しない(画面設計書5章) */
  targetMl: number | null;
}

const WIDTH = 320;
const HEIGHT = 160;
const PADDING = { top: 22, right: 12, bottom: 20, left: 8 };
const COLORS = {
  bar: tokens.waterMain,
  target: tokens.waterMain,
  label: "#8C8C8C",
};

export default function WaterChart({ data, targetMl }: WaterChartProps) {
  if (data.length === 0) {
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
        記録がありません
      </div>
    );
  }

  const maxMl = Math.max(...data.map((d) => d.amountMl), targetMl ?? 0) * 1.1 || 1;
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const slotWidth = plotWidth / data.length;
  const barWidth = Math.max(1, slotWidth * 0.6);

  const yScale = (ml: number) => PADDING.top + plotHeight - (ml / maxMl) * plotHeight;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", display: "block" }} role="img" aria-label="水分摂取量推移グラフ">
      {targetMl !== null && (
        <>
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={yScale(targetMl)}
            y2={yScale(targetMl)}
            stroke={COLORS.target}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <text x={PADDING.left} y={12} fontSize={9} fill={COLORS.target}>
            目標 {targetMl.toLocaleString()}ml
          </text>
        </>
      )}

      {data.map((day, i) => {
        const x = PADDING.left + i * slotWidth + (slotWidth - barWidth) / 2;
        const y = yScale(day.amountMl);
        const height = PADDING.top + plotHeight - y;
        return (
          <rect
            key={day.date}
            x={x}
            y={y}
            width={barWidth}
            height={Math.max(height, 0)}
            rx={Math.min(3, barWidth / 2)}
            fill={COLORS.bar}
          />
        );
      })}

      <text x={PADDING.left} y={HEIGHT - 4} fontSize={9} fill={COLORS.label}>
        {formatMonthDay(data[0].date)}
      </text>
      <text x={WIDTH - PADDING.right} y={HEIGHT - 4} textAnchor="end" fontSize={9} fill={COLORS.label}>
        {formatMonthDay(data[data.length - 1].date)}
      </text>
    </svg>
  );
}
