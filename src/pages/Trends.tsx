import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import BodyFatChart from "../components/BodyFatChart";
import CalorieChart from "../components/CalorieChart";
import GoalBar from "../components/GoalBar";
import WeightChart from "../components/WeightChart";
import { db } from "../db/db";
import { getDailyCalorieTotals } from "../db/mealRecords";
import { getSettings } from "../db/settings";
import { getAllWeightRecords, getWeightRecord, getWeightRecordsByDateRange } from "../db/weightRecords";
import { dateStringDaysAgo, todayDateString } from "../lib/date";

type Period = "week" | "month" | "all";
type ViewMode = "chart" | "history";

const PERIOD_LABELS: Record<Period, string> = {
  week: "週",
  month: "月",
  all: "全期間",
};

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  chart: "グラフ",
  history: "履歴",
};

function formatHistoryDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export default function Trends() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("month");
  const [viewMode, setViewMode] = useState<ViewMode>("chart");

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
  // 基準日に記録がない(または基準日未設定の)場合は一番古い記録を起点にフォールバックする
  const baselineWeightRecord = useLiveQuery(
    () => (settings?.baselineDate ? getWeightRecord(settings.baselineDate).then((v) => v ?? null) : Promise.resolve(null)),
    [settings?.baselineDate],
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

  // 履歴確認画面は期間切り替えと独立して全期間・日付降順で表示する(画面設計書9章、詳細は今後検討)
  const historyRecords = useLiveQuery(
    () => getAllWeightRecords().then((records) => [...records].reverse()),
    [],
  );

  if (
    settings === undefined ||
    firstWeightRecord === undefined ||
    lastWeightRecord === undefined ||
    baselineWeightRecord === undefined ||
    weightChartRecords === undefined ||
    calorieDailyTotals === undefined ||
    historyRecords === undefined
  ) {
    return <div className="p-6 text-center text-sm text-muted">読み込み中...</div>;
  }

  const startWeightKg =
    baselineWeightRecord?.weightKg ?? firstWeightRecord?.weightKg ?? lastWeightRecord?.weightKg;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-28 pt-6">
      <h1 className="font-rounded text-xl font-bold text-ink">推移</h1>

      {lastWeightRecord ? (
        <GoalBar
          startWeightKg={startWeightKg ?? lastWeightRecord.weightKg}
          currentWeightKg={lastWeightRecord.weightKg}
          goalWeightKg={settings.goalWeightKg}
          goalDate={settings.goalDate}
        />
      ) : (
        <div className="rounded-card bg-white p-4 text-center text-sm text-muted shadow-soft">
          体重を記録するとここに進捗バーが表示されます
        </div>
      )}

      <div className="flex gap-1 rounded-full bg-white p-1 shadow-soft">
        {(Object.keys(VIEW_MODE_LABELS) as ViewMode[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setViewMode(key)}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === key ? "bg-primary text-white" : "text-muted"
            }`}
          >
            {VIEW_MODE_LABELS[key]}
          </button>
        ))}
      </div>

      {viewMode === "chart" ? (
        <>
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
        </>
      ) : (
        <section className="rounded-card bg-white p-2 shadow-soft">
          {historyRecords.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted">記録がありません</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {historyRecords.map((record) => (
                <li key={record.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/record/weight?date=${record.date}`)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                  >
                    <div className="flex flex-col">
                      <span className="text-xs text-muted">{formatHistoryDate(record.date)}</span>
                      {record.note && <span className="text-xs text-muted">{record.note}</span>}
                    </div>
                    <div className="flex items-baseline gap-3 font-rounded">
                      <span className="text-lg font-bold text-ink">{record.weightKg}kg</span>
                      <span className="w-12 text-right text-sm text-muted">
                        {record.bodyFatPercent !== undefined ? `${record.bodyFatPercent}%` : "-"}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
