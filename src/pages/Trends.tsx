import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import BodyFatChart from "../components/BodyFatChart";
import CalorieChart from "../components/CalorieChart";
import GoalBar from "../components/GoalBar";
import WeightChart from "../components/WeightChart";
import { db } from "../db/db";
import { getDailyCalorieTotals } from "../db/mealRecords";
import { getSettings } from "../db/settings";
import { getAllWeightRecords, getWeightRecordsByDateRange } from "../db/weightRecords";
import { dateStringDaysAgo, todayDateString } from "../lib/date";

type Period = "week" | "month" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  week: "週",
  month: "月",
  all: "全期間",
};

export default function Trends() {
  const [period, setPeriod] = useState<Period>("month");

  const settings = useLiveQuery(() => getSettings(), []);
  // .first()/.last()は記録が1件もないとundefinedを返すが、useLiveQueryは
  // 「未解決」もundefinedで表すため区別できず永久ローディングになる。nullに正規化する。
  const firstWeightRecord = useLiveQuery(
    () => db.weightRecords.orderBy("date").first().then((v) => v ?? null),
    [],
  );
  const lastWeightRecord = useLiveQuery(
    () => db.weightRecords.orderBy("date").last().then((v) => v ?? null),
    [],
  );

  const weightChartRecords = useLiveQuery(() => {
    if (period === "all") return getAllWeightRecords();
    const days = period === "week" ? 6 : 29;
    return getWeightRecordsByDateRange(dateStringDaysAgo(days), todayDateString());
  }, [period]);

  const calorieDailyTotals = useLiveQuery(async () => {
    const endDate = todayDateString();
    if (period === "all") {
      const firstMealRecord = await db.mealRecords.orderBy("timestamp").first();
      const startDate = firstMealRecord ? firstMealRecord.timestamp.slice(0, 10) : endDate;
      return getDailyCalorieTotals(startDate, endDate);
    }
    const days = period === "week" ? 6 : 29;
    return getDailyCalorieTotals(dateStringDaysAgo(days), endDate);
  }, [period]);

  if (
    settings === undefined ||
    firstWeightRecord === undefined ||
    lastWeightRecord === undefined ||
    weightChartRecords === undefined ||
    calorieDailyTotals === undefined
  ) {
    return <div className="p-6 text-center text-sm text-muted">読み込み中...</div>;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-28 pt-6">
      <h1 className="font-rounded text-xl font-bold text-ink">推移</h1>

      {lastWeightRecord ? (
        <GoalBar
          startWeightKg={firstWeightRecord?.weightKg ?? lastWeightRecord.weightKg}
          currentWeightKg={lastWeightRecord.weightKg}
          goalWeightKg={settings.goalWeightKg}
          goalDate={settings.goalDate}
        />
      ) : (
        <div className="rounded-card bg-white p-4 text-center text-sm text-muted shadow-soft">
          体重を記録するとここに進捗バーが表示されます
        </div>
      )}

      <div className="flex justify-end gap-1 rounded-full bg-white p-1 shadow-soft">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setPeriod(key)}
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
        <WeightChart records={weightChartRecords} goalWeightKg={settings.goalWeightKg} />
      </section>

      <section className="rounded-card bg-white p-4 shadow-soft">
        <h2 className="mb-3 text-sm font-medium text-muted">体脂肪率推移</h2>
        <BodyFatChart records={weightChartRecords} />
      </section>

      <section className="rounded-card bg-white p-4 shadow-soft">
        <h2 className="mb-3 text-sm font-medium text-muted">カロリー推移</h2>
        <CalorieChart data={calorieDailyTotals} targetKcal={settings.dailyCalorieTarget} />
      </section>
    </div>
  );
}
