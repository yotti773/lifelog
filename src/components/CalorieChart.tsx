import type { DailyCalorieTotal } from "../db/mealRecords";

interface CalorieChartProps {
  data: DailyCalorieTotal[];
  targetKcal: number;
}

const WIDTH = 320;
const HEIGHT = 160;
const PADDING = { top: 22, right: 12, bottom: 20, left: 8 };
const COLORS = {
  bar: "#2EC4B6",
  // アクセントのイエローは「達成した瞬間」専用のため、常時表示される目標線には使わずウォームグレーにする
  target: "#8C8C8C",
  label: "#8C8C8C",
};

export default function CalorieChart({ data, targetKcal }: CalorieChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-card bg-background text-sm text-muted">
        記録がありません
      </div>
    );
  }

  const maxKcal = Math.max(...data.map((d) => d.kcal), targetKcal) * 1.1 || 1;
  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const slotWidth = plotWidth / data.length;
  const barWidth = Math.max(1, slotWidth * 0.6);

  const yScale = (kcal: number) => PADDING.top + plotHeight - (kcal / maxKcal) * plotHeight;
  const targetY = yScale(targetKcal);

  const formatLabel = (date: string) => {
    const [, month, day] = date.split("-");
    return `${Number(month)}/${Number(day)}`;
  };

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="カロリー推移グラフ">
      <line
        x1={PADDING.left}
        x2={WIDTH - PADDING.right}
        y1={targetY}
        y2={targetY}
        stroke={COLORS.target}
        strokeWidth={1.5}
        strokeDasharray="4 4"
      />
      <text x={PADDING.left} y={12} fontSize={9} fill={COLORS.target}>
        目標 {targetKcal}kcal
      </text>

      {data.map((day, i) => {
        const x = PADDING.left + i * slotWidth + (slotWidth - barWidth) / 2;
        const y = yScale(day.kcal);
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
        {formatLabel(data[0].date)}
      </text>
      <text x={WIDTH - PADDING.right} y={HEIGHT - 4} textAnchor="end" fontSize={9} fill={COLORS.label}>
        {formatLabel(data[data.length - 1].date)}
      </text>
    </svg>
  );
}
