import { axisTicks, xAxisTicks } from "./chartAxis";
import { formatMonthDay } from "@/lib/date";

export interface DailyBarDatum {
  date: string; // YYYY-MM-DD
  value: number;
}

interface DailyBarChartProps {
  data: DailyBarDatum[];
  /** 目標ライン。nullの間は線を表示しない。ラベルはカード見出しの凡例が担うためグラフ内には出さない */
  target: number | null;
  barColor: string;
  targetColor: string;
  ariaLabel: string;
  /** 最新(=末尾。通常は今日)の棒に使う強調色。未指定なら barColor と同じ(Issue #128) */
  todayColor?: string;
  /** 最新の棒の上に出す値ラベルの整形。未指定なら桁区切り整数 */
  formatTodayValue?: (value: number) => string;
}

const WIDTH = 320;
const HEIGHT = 176;
// topは最新の棒の上に出す値ラベル、bottomはX軸日付ラベル、leftは縦軸の数値ラベル(Issue #60)の分
const PADDING = { top: 26, right: 12, bottom: 22, left: 34 };
const LABEL_COLOR = "#8C8C8C";
const GRID_COLOR = "#F0E7DB";
// 未記録日(0)のスタブ。実際に少なかった日と「記録し忘れ」を見分けるための淡い破線
const EMPTY_STUB_COLOR = "#C3B29A";

/**
 * 日別合計の棒グラフ(カロリー・水分・歩数・睡眠で共用。Issue #59)。
 * 手書きSVGなのはデザインガイドのパレットを厳密にコントロールするため(CLAUDE.md参照)。
 * 最新(末尾)の棒を強調し値ラベルを添え、X軸は途中にも日付目盛りを出す(Issue #128)。
 */
export default function DailyBarChart({
  data,
  target,
  barColor,
  targetColor,
  ariaLabel,
  todayColor,
  formatTodayValue = (v) => v.toLocaleString(),
}: DailyBarChartProps) {
  if (data.length === 0) {
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

  const maxValue = Math.max(...data.map((d) => d.value), target ?? 0) * 1.1 || 1;
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const slotWidth = plotWidth / data.length;
  const barWidth = Math.max(1, slotWidth * 0.6);
  const baseY = PADDING.top + plotHeight;

  const yScale = (value: number) => PADDING.top + plotHeight - (value / maxValue) * plotHeight;

  // 0はグラフの底辺と重なるだけなので目盛りから除く
  const ticks = axisTicks(0, maxValue).filter((tick) => tick.value > 0);
  const lastIndex = data.length - 1;
  const lastValue = data[lastIndex].value;

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
        <line
          x1={PADDING.left}
          x2={WIDTH - PADDING.right}
          y1={yScale(target)}
          y2={yScale(target)}
          stroke={targetColor}
          strokeWidth={1.5}
          strokeDasharray="4 4"
        />
      )}

      {data.map((day, i) => {
        const x = PADDING.left + i * slotWidth + (slotWidth - barWidth) / 2;
        // 未記録日(0)は棒を描かず、底辺に淡い破線スタブだけ置いて「空白」を明示する
        if (day.value === 0) {
          return (
            <rect
              key={day.date}
              x={x}
              y={baseY - 3}
              width={barWidth}
              height={3}
              rx={1.5}
              fill="none"
              stroke={EMPTY_STUB_COLOR}
              strokeWidth={1}
              strokeDasharray="2 2"
            />
          );
        }
        const y = yScale(day.value);
        const height = baseY - y;
        return (
          <rect
            key={day.date}
            x={x}
            y={y}
            width={barWidth}
            height={Math.max(height, 0)}
            rx={Math.min(3, barWidth / 2)}
            fill={i === lastIndex ? todayColor ?? barColor : barColor}
          />
        );
      })}

      {/* 最新(今日)の棒の値ラベル。0の日はラベルを出さない */}
      {lastValue > 0 && (
        <text
          x={PADDING.left + lastIndex * slotWidth + slotWidth / 2}
          y={yScale(lastValue) - 5}
          textAnchor="middle"
          fontSize={10}
          fontWeight={700}
          fill={todayColor ?? barColor}
        >
          {formatTodayValue(lastValue)}
        </text>
      )}

      {/* X軸: 両端+途中の日付目盛り。末尾は「今日」を強調色で示す(Issue #128)。
          棒はインデックス等間隔(各棒がスロット中央)に並ぶため、ラベルは時間比率ではなく
          対応する棒スロットの中央に合わせる(時間比率で置くと最大半スロットずれる) */}
      {xAxisTicks(data.length).map((tick) => {
        const index = Math.round(tick.fraction * lastIndex);
        const isLast = index === lastIndex;
        const x = PADDING.left + (index + 0.5) * slotWidth;
        return (
          <text
            key={tick.fraction}
            x={x}
            y={HEIGHT - 5}
            textAnchor={tick.anchor}
            fontSize={9}
            fontWeight={isLast ? 700 : 400}
            fill={isLast ? todayColor ?? LABEL_COLOR : LABEL_COLOR}
          >
            {isLast ? "今日" : formatMonthDay(data[index].date)}
          </text>
        );
      })}
    </svg>
  );
}
