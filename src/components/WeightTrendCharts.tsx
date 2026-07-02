import BodyFatChart from "./BodyFatChart";
import CalorieChart from "./CalorieChart";
import WeightChart from "./WeightChart";
import type { DailyCalorieTotal } from "../db/mealRecords";
import type { WeightRecord } from "../types";

export type Period = "week" | "month" | "all";

export const PERIOD_LABELS: Record<Period, string> = {
  week: "週",
  month: "月",
  all: "全期間",
};

interface WeightTrendChartsProps {
  period: Period;
  onPeriodChange: (period: Period) => void;
  weightChartRecords: WeightRecord[];
  calorieDailyTotals: DailyCalorieTotal[];
  goalWeightKg: number;
  dailyCalorieTarget: number;
}

export default function WeightTrendCharts({
  period,
  onPeriodChange,
  weightChartRecords,
  calorieDailyTotals,
  goalWeightKg,
  dailyCalorieTarget,
}: WeightTrendChartsProps) {
  return (
    <>
      <div className="flex justify-end gap-1 rounded-full bg-white p-1 shadow-soft">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onPeriodChange(key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              period === key ? "bg-primary text-white" : "text-muted"
            }`}
          >
            {PERIOD_LABELS[key]}
          </button>
        ))}
      </div>

      <section className="rounded-card bg-white p-4 shadow-soft">
        <h2 className="mb-3 text-sm font-medium text-muted">体重推移</h2>
        <WeightChart records={weightChartRecords} goalWeightKg={goalWeightKg} />
      </section>

      <section className="rounded-card bg-white p-4 shadow-soft">
        <h2 className="mb-3 text-sm font-medium text-muted">体脂肪率推移</h2>
        <BodyFatChart records={weightChartRecords} />
      </section>

      <section className="rounded-card bg-white p-4 shadow-soft">
        <h2 className="mb-3 text-sm font-medium text-muted">カロリー推移</h2>
        <CalorieChart data={calorieDailyTotals} targetKcal={dailyCalorieTarget} />
      </section>
    </>
  );
}
