import { formatMonthDay } from "@/lib/date";
import type { WeightRecord } from "@/types";

interface WeightChartProps {
  records: WeightRecord[];
  goalWeightKg?: number;
}

const WIDTH = 320;
const HEIGHT = 160;
const PADDING = { top: 22, right: 12, bottom: 20, left: 8 };
const COLORS = {
  line: "#2EC4B6",
  point: "#2EC4B6",
  pointBorder: "#FFF8F0",
  // アクセントのイエローは「達成した瞬間」専用のため、常時表示される目標線には使わずウォームグレーにする
  goal: "#8C8C8C",
  label: "#8C8C8C",
};

export default function WeightChart({ records, goalWeightKg }: WeightChartProps) {
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
        記録がありません
      </div>
    );
  }

  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const times = sorted.map((r) => new Date(`${r.date}T00:00:00`).getTime());
  const minTime = times[0];
  const maxTime = times[times.length - 1];
  const timeSpan = maxTime - minTime || 1;

  const weights = sorted.map((r) => r.weightKg);
  const values = goalWeightKg !== undefined ? [...weights, goalWeightKg] : weights;
  const minWeight = Math.min(...values);
  const maxWeight = Math.max(...values);
  const weightSpan = maxWeight - minWeight || 1;
  const yPad = weightSpan * 0.2 || 1;
  const scaledSpan = weightSpan + yPad * 2;

  const plotWidth = WIDTH - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const xScale = (time: number) => PADDING.left + ((time - minTime) / timeSpan) * plotWidth;
  const yScale = (weight: number) =>
    PADDING.top + plotHeight - ((weight - (minWeight - yPad)) / scaledSpan) * plotHeight;

  const points = sorted.map((record, i) => ({
    x: xScale(times[i]),
    y: yScale(record.weightKg),
    record,
  }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const goalY = goalWeightKg !== undefined ? yScale(goalWeightKg) : null;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: "100%", display: "block" }} role="img" aria-label="体重推移グラフ">
      {goalY !== null && (
        <>
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={goalY}
            y2={goalY}
            stroke={COLORS.goal}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <text x={WIDTH - PADDING.right} y={12} textAnchor="end" fontSize={9} fill={COLORS.goal}>
            目標 {goalWeightKg}kg
          </text>
        </>
      )}

      <path
        d={linePath}
        fill="none"
        stroke={COLORS.line}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {points.map((p) => (
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
