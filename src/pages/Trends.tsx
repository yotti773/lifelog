import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocation, useNavigate } from "react-router-dom";
import GoalBar from "../components/GoalBar";
import WeightHistoryList from "../components/WeightHistoryList";
import WeightTrendCharts, { type Period } from "../components/WeightTrendCharts";
import { db } from "../db/db";
import { getDailyCalorieTotals } from "../db/mealRecords";
import { getSettings } from "../db/settings";
import {
  getAllWeightRecords,
  getAllWeightRecordsDesc,
  getWeightRecord,
  getWeightRecordsByDateRange,
} from "../db/weightRecords";
import { dateStringDaysAgo, formatDate, todayDateString } from "../lib/date";
import type { WeightRecord } from "../types";

type ViewMode = "chart" | "history";

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  chart: "グラフ",
  history: "履歴",
};

export default function Trends() {
  const navigate = useNavigate();
  const location = useLocation();
  const [period, setPeriod] = useState<Period>("month");
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (location.state as { viewMode?: ViewMode } | null)?.viewMode ?? "chart",
  );

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
      const startDate = firstMealRecord ? formatDate(new Date(firstMealRecord.timestamp)) : endDate;
      return getDailyCalorieTotals(startDate, endDate);
    }
    const days = period === "week" ? 6 : 29;
    return getDailyCalorieTotals(dateStringDaysAgo(days), endDate);
  }, [period]);

  // 履歴確認画面は期間切り替えと独立して全期間・日付降順で表示する(画面設計書9章、詳細は今後検討)。
  // 履歴タブを開いていない間はDexieへ問い合わせない(グラフ表示中の無駄なフルスキャンを避ける)
  const historyRecords = useLiveQuery(
    () => (viewMode === "history" ? getAllWeightRecordsDesc() : Promise.resolve<WeightRecord[]>([])),
    [viewMode],
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
        <WeightTrendCharts
          period={period}
          onPeriodChange={setPeriod}
          weightChartRecords={weightChartRecords}
          calorieDailyTotals={calorieDailyTotals}
          goalWeightKg={settings.goalWeightKg}
          dailyCalorieTarget={settings.dailyCalorieTarget}
        />
      ) : (
        <WeightHistoryList
          records={historyRecords}
          onSelect={(date) => navigate(`/record/weight?date=${date}`)}
        />
      )}
    </div>
  );
}
