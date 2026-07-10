import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import GoalBar from "@/components/GoalBar";
import MealHistoryList from "@/components/MealHistoryList";
import SegmentedControl from "@/components/SegmentedControl";
import WeeklyReview from "@/components/WeeklyReview";
import WeightHistoryList from "@/components/WeightHistoryList";
import WeightTrendCharts, { type Period } from "@/components/WeightTrendCharts";
import { IconSync } from "@/components/icons";
import { db } from "@/db/db";
import { getAllMealRecordsDesc, getDailyCalorieTotals } from "@/db/mealRecords";
import { getSettings } from "@/db/settings";
import { getDailyWaterTotals } from "@/db/waterRecords";
import {
  getAllWeightRecords,
  getAllWeightRecordsDesc,
  getWeightRecord,
  getWeightRecordsByDateRange,
} from "@/db/weightRecords";
import { getWeeklyDigest } from "@/db/weeklyReview";
import { addDaysToDateString, dateStringDaysAgo, formatDate, todayDateString, weekStartOf } from "@/lib/date";
import { projectWeightAtDate } from "@/lib/weightProjection";
import { fontRounded, tokens } from "@/theme";
import type { MealRecord, WeightRecord } from "@/types";

type ViewMode = "chart" | "history" | "review";
type HistoryKind = "weight" | "meal";

const VIEW_MODE_OPTIONS = [
  { value: "chart", label: "グラフ" },
  { value: "history", label: "履歴" },
  { value: "review", label: "レビュー" },
] as const;

const HISTORY_KIND_OPTIONS = [
  { value: "weight", label: "体重" },
  { value: "meal", label: "食事" },
] as const;

export default function Trends() {
  const navigate = useNavigate();
  const location = useLocation();
  const [period, setPeriod] = useState<Period>("month");
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (location.state as { viewMode?: ViewMode } | null)?.viewMode ?? "chart",
  );
  const [historyKind, setHistoryKind] = useState<HistoryKind>("weight");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  // 週次レビューの表示週(月曜起点)。デフォルトは今週(画面設計書8.2章)
  const [reviewWeekStart, setReviewWeekStart] = useState(() => weekStartOf(todayDateString()));

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

  const waterDailyTotals = useLiveQuery(async () => {
    const endDate = todayDateString();
    if (period === "all") {
      const firstWaterRecord = await db.waterRecords.orderBy("timestamp").first();
      const startDate = firstWaterRecord ? formatDate(new Date(firstWaterRecord.timestamp)) : endDate;
      return getDailyWaterTotals(startDate, endDate);
    }
    const days = period === "week" ? 6 : 29;
    return getDailyWaterTotals(dateStringDaysAgo(days), endDate);
  }, [period]);

  // 履歴確認画面は期間切り替えと独立して全期間・日付降順で表示する(画面設計書8.1章)。
  // 表示していない種別・タブに対してはDexieへ問い合わせない(無駄なフルスキャンを避ける)
  const historyRecords = useLiveQuery(
    () =>
      viewMode === "history" && historyKind === "weight"
        ? getAllWeightRecordsDesc()
        : Promise.resolve<WeightRecord[]>([]),
    [viewMode, historyKind],
  );
  const mealHistoryRecords = useLiveQuery(
    () =>
      viewMode === "history" && historyKind === "meal"
        ? getAllMealRecordsDesc()
        : Promise.resolve<MealRecord[]>([]),
    [viewMode, historyKind],
  );
  // 週次レビューのダイジェスト(Issue #45)。レビュータブ表示中のみ集計する。
  // 「未表示」もnullに解決するため、undefined(ロード中)と区別できる(CLAUDE.mdのuseLiveQueryパターン)
  const reviewDigest = useLiveQuery(
    () => (viewMode === "review" ? getWeeklyDigest(reviewWeekStart) : Promise.resolve(null)),
    [viewMode, reviewWeekStart],
  );

  if (
    settings === undefined ||
    firstWeightRecord === undefined ||
    lastWeightRecord === undefined ||
    baselineWeightRecord === undefined ||
    weightChartRecords === undefined ||
    calorieDailyTotals === undefined ||
    waterDailyTotals === undefined ||
    historyRecords === undefined ||
    mealHistoryRecords === undefined ||
    reviewDigest === undefined
  ) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  const startWeightKg =
    baselineWeightRecord?.weightKg ?? firstWeightRecord?.weightKg ?? lastWeightRecord?.weightKg;

  // 現在ペースでの着地予測(Issue #25)。起点=基準日の記録(なければ最古の記録)、最新=直近の記録。
  const projectionStart = baselineWeightRecord ?? firstWeightRecord;
  const projectedWeightKg =
    projectionStart && lastWeightRecord
      ? projectWeightAtDate(
          { date: projectionStart.date, weightKg: projectionStart.weightKg },
          { date: lastWeightRecord.date, weightKg: lastWeightRecord.weightKg },
          settings.goalDate,
        )
      : null;

  // From/To絞込みは日付文字列(YYYY-MM-DD)の辞書順比較で足りる
  const filteredHistory = historyRecords.filter(
    (record) => (!historyFrom || record.date >= historyFrom) && (!historyTo || record.date <= historyTo),
  );
  // 食事はtimestamp(UTC ISO)を持つため、ローカル日付に直してからFrom/Toで絞り込む
  const filteredMealHistory = mealHistoryRecords.filter((record) => {
    const date = formatDate(new Date(record.timestamp));
    return (!historyFrom || date >= historyFrom) && (!historyTo || date <= historyTo);
  });
  const historyCount = historyKind === "weight" ? filteredHistory.length : filteredMealHistory.length;

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
              projectedWeightKg={projectedWeightKg}
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
            waterDailyTotals={waterDailyTotals}
            goalWeightKg={settings.goalWeightKg}
            dailyCalorieTarget={settings.dailyCalorieTarget}
            dailyWaterTargetMl={settings.dailyWaterTargetMl ?? null}
          />
        </>
      ) : viewMode === "review" ? (
        reviewDigest && (
          <WeeklyReview
            // 週を切り替えるたびに再マウントし、生成中フラグ・エラー表示・反映済み表示などの
            // ローカル状態が前の週から持ち越されないようにする(週ごとに独立した状態であるべきため)
            key={reviewWeekStart}
            digest={reviewDigest}
            onPrevWeek={() => setReviewWeekStart(addDaysToDateString(reviewWeekStart, -7))}
            onNextWeek={() => setReviewWeekStart(addDaysToDateString(reviewWeekStart, 7))}
            canGoNext={reviewWeekStart < weekStartOf(todayDateString())}
          />
        )
      ) : (
        <>
          <SegmentedControl options={HISTORY_KIND_OPTIONS} value={historyKind} onChange={setHistoryKind} />
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
            {historyCount}件・新しい順(タップで編集)
          </Typography>
          {historyKind === "weight" ? (
            <WeightHistoryList
              records={filteredHistory}
              baselineDate={settings.baselineDate}
              onSelect={(date) => navigate(`/record/weight?date=${date}`)}
            />
          ) : (
            <MealHistoryList
              records={filteredMealHistory}
              onSelect={(id) => navigate(`/record/meal?id=${id}`)}
            />
          )}
        </>
      )}
    </Box>
  );
}
