import { axisTicks } from "./chartAxis";
import { formatMonthDay } from "@/lib/date";

export interface DailyBarDatum {
  date: string; // YYYY-MM-DD
  value: number;
}

interface DailyBarChartProps {
  data: DailyBarDatum[];
  /** 目標ライン。nullの間は線・ラベルとも表示しない */
  target: number | null;
  /** 目標ラインの左上に出すラベル(例: 「目標 1,900kcal」) */
  targetLabel: string;
  barColor: string;
  targetColor: string;
  ariaLabel: string;
}

const WIDTH = 320;
const HEIGHT = 160;
// leftは縦軸の数値ラベル(Issue #60)の分を確保している
const PADDING = { top: 22, right: 12, bottom: 20, left: 34 };
const LABEL_COLOR = "#8C8C8C";
const GRID_COLOR = "#F0E7DB";

/**
 * 日別合計の棒グラフ(カロリー・水分推移で共用。Issue #59)。
 * 手書きSVGなのはデザインガイドのパレットを厳密にコントロールするため(CLAUDE.md参照)
 */
export default function DailyBarChart({ data, target, targetLabel, barColor, targetColor, ariaLabel }: DailyBarChartProps) {
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

  const maxValue = Math.max(...data.map((d) => d.value), target ?? 0) * 1.1 || 1;
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const slotWidth = plotWidth / data.length;
  const barWidth = Math.max(1, slotWidth * 0.6);

  const yScale = (value: number) => PADDING.top + plotHeight - (value / maxValue) * plotHeight;

  // 0はグラフの底辺と重なるだけなので目盛りから除く
  const ticks = axisTicks(0, maxValue).filter((tick) => tick.value > 0);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", display: "block" }} role="img" aria-label={ariaLabel}>
      {ticks.map((tick) => (
        <g key={tick.value}>
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={yScale(tick.value)}
            y2={yScale(tick.value)}
            stroke={GRID_COLOR}
            strokeWidth={1}
          />
          <text x={PADDING.left - 5} y={yScale(tick.value) + 3} textAnchor="end" fontSize={9} fill={LABEL_COLOR}>
            {tick.label}
          </text>
        </g>
      ))}

      {target !== null && (
        <>
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={yScale(target)}
            y2={yScale(target)}
            stroke={targetColor}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <text x={PADDING.left} y={12} fontSize={9} fill={targetColor}>
            {targetLabel}
          </text>
        </>
      )}

      {data.map((day, i) => {
        const x = PADDING.left + i * slotWidth + (slotWidth - barWidth) / 2;
        const y = yScale(day.value);
        const height = PADDING.top + plotHeight - y;
        return (
          <rect
            key={day.date}
            x={x}
            y={y}
            width={barWidth}
            height={Math.max(height, 0)}
            rx={Math.min(3, barWidth / 2)}
            fill={barColor}
          />
        );
      })}

      <text x={PADDING.left} y={HEIGHT - 4} fontSize={9} fill={LABEL_COLOR}>
        {formatMonthDay(data[0].date)}
      </text>
      <text x={WIDTH - PADDING.right} y={HEIGHT - 4} textAnchor="end" fontSize={9} fill={LABEL_COLOR}>
        {formatMonthDay(data[data.length - 1].date)}
      </text>
    </svg>
  );
}
