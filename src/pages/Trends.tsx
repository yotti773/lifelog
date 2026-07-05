import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import GoalBar from "@/components/GoalBar";
import SegmentedControl from "@/components/SegmentedControl";
import WeightHistoryList from "@/components/WeightHistoryList";
import WeightTrendCharts, { type Period } from "@/components/WeightTrendCharts";
import { IconSync } from "@/components/icons";
import { db } from "@/db/db";
import { getDailyCalorieTotals } from "@/db/mealRecords";
import { getSettings } from "@/db/settings";
import {
  getAllWeightRecords,
  getAllWeightRecordsDesc,
  getWeightRecord,
  getWeightRecordsByDateRange,
} from "@/db/weightRecords";
import { dateStringDaysAgo, formatDate, todayDateString } from "@/lib/date";
import { fontRounded, tokens } from "@/theme";
import type { WeightRecord } from "@/types";

type ViewMode = "chart" | "history";

const VIEW_MODE_OPTIONS = [
  { value: "chart", label: "グラフ" },
  { value: "history", label: "履歴" },
] as const;

export default function Trends() {
  const navigate = useNavigate();
  const location = useLocation();
  const [period, setPeriod] = useState<Period>("month");
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (location.state as { viewMode?: ViewMode } | null)?.viewMode ?? "chart",
  );
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");

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
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  const startWeightKg =
    baselineWeightRecord?.weightKg ?? firstWeightRecord?.weightKg ?? lastWeightRecord?.weightKg;

  // From/To絞込みは日付文字列(YYYY-MM-DD)の辞書順比較で足りる
  const filteredHistory = historyRecords.filter(
    (record) => (!historyFrom || record.date >= historyFrom) && (!historyTo || record.date <= historyTo),
  );

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, display: "flex", flexDirection: "column", gap: "14px", px: "20px", pt: "24px", pb: "130px" }}>
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 22 }}>推移</Typography>

      <SegmentedControl options={VIEW_MODE_OPTIONS} value={viewMode} onChange={setViewMode} />

      {viewMode === "chart" ? (
        <>
          {lastWeightRecord ? (
            <GoalBar
              startWeightKg={startWeightKg ?? lastWeightRecord.weightKg}
              currentWeightKg={lastWeightRecord.weightKg}
              goalWeightKg={settings.goalWeightKg}
              goalDate={settings.goalDate}
            />
          ) : (
            <Card sx={{ p: 2 }}>
              <Typography sx={{ textAlign: "center", fontSize: 14, color: "text.secondary" }}>
                体重を記録するとここに進捗バーが表示されます
              </Typography>
            </Card>
          )}
          <WeightTrendCharts
            period={period}
            onPeriodChange={setPeriod}
            weightChartRecords={weightChartRecords}
            calorieDailyTotals={calorieDailyTotals}
            goalWeightKg={settings.goalWeightKg}
            dailyCalorieTarget={settings.dailyCalorieTarget}
          />
        </>
      ) : (
        <>
          <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <TextField
              type="date"
              label="From"
              size="small"
              value={historyFrom}
              onChange={(e) => setHistoryFrom(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flex: 1 }}
            />
            <Typography sx={{ color: tokens.faint }}>-</Typography>
            <TextField
              type="date"
              label="To"
              size="small"
              value={historyTo}
              onChange={(e) => setHistoryTo(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ flex: 1 }}
            />
            <ButtonBase
              onClick={() => {
                setHistoryFrom("");
                setHistoryTo("");
              }}
              aria-label="絞り込みをリセット"
              sx={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                bgcolor: "background.paper",
                boxShadow: tokens.fieldShadow,
                color: "text.secondary",
                flexShrink: 0,
              }}
            >
              <IconSync size={15} />
            </ButtonBase>
          </Box>
          <Typography sx={{ fontSize: 11, color: "text.secondary" }}>
            {filteredHistory.length}件・新しい順(タップで編集)
          </Typography>
          <WeightHistoryList
            records={filteredHistory}
            baselineDate={settings.baselineDate}
            onSelect={(date) => navigate(`/record/weight?date=${date}`)}
          />
        </>
      )}
    </Box>
  );
}
