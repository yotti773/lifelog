import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ActivityHistoryList from "./ActivityHistoryList";
import AddHistoryEntryButton from "./AddHistoryEntryButton";
import BloodPressureHistoryList from "./BloodPressureHistoryList";
import BodyMeasurementHistoryList from "./BodyMeasurementHistoryList";
import DiaryHistoryList from "./DiaryHistoryList";
import GoalBar from "./GoalBar";
import MealHistoryList from "./MealHistoryList";
import ScrollableChips from "@/components/ScrollableChips";
import SegmentedControl from "@/components/SegmentedControl";
import MonthlyReview from "./MonthlyReview";
import WaterHistoryList, { groupWaterHistoryDays } from "./WaterHistoryList";
import WeeklyReview from "./WeeklyReview";
import WeightHistoryList from "./WeightHistoryList";
import WeightTrendCharts, { type Period } from "./charts/WeightTrendCharts";
import WorkoutHistoryList, { groupWorkoutHistoryDays } from "./WorkoutHistoryList";
import { IconSync } from "@/components/icons";
import { db } from "@/db/db";
import { getAllActivityRecordsDesc, getDailyActivityTotals } from "@/db/activityRecords";
import {
  getAllBloodPressureRecordsDesc,
  getBloodPressureRecordsByDateRange,
} from "@/db/bloodPressureRecords";
import {
  getAllBodyMeasurementRecords,
  getAllBodyMeasurementRecordsDesc,
} from "@/db/bodyMeasurementRecords";
import { getAllDiaryRecordsDesc } from "@/db/diaryRecords";
import { getAllMealRecordsDesc, getDailyCalorieTotals } from "@/db/mealRecords";
import { getSettings } from "@/db/settings";
import { getAllWaterRecordsDesc, getDailyWaterTotals } from "@/db/waterRecords";
import { getAllWorkoutRecordsDesc } from "@/db/workoutRecords";
import {
  getAllWeightRecords,
  getAllWeightRecordsDesc,
  getWeightRecord,
  getWeightRecordsByDateRange,
} from "@/db/weightRecords";
import { getMonthlyDigest } from "@/db/monthlyReview";
import { getWeeklyDigest } from "@/db/weeklyReview";
import {
  addDaysToDateString,
  addMonthsToMonthKey,
  dateStringDaysAgo,
  formatDate,
  monthKeyOfWeek,
  todayDateString,
  weekStartOf,
} from "@/lib/date";
import { projectWeightAtDate } from "@/lib/weightProjection";
import { fontRounded, tokens } from "@/theme";
import type {
  ActivityRecord,
  BloodPressureRecord,
  BodyMeasurementRecord,
  DiaryRecord,
  MealRecord,
  MealType,
  WaterRecord,
  WeightRecord,
  WorkoutRecord,
} from "@/types";

type ViewMode = "chart" | "history" | "review";
type HistoryKind =
  | "weight"
  | "meal"
  | "water"
  | "strength"
  | "diary"
  | "activity"
  | "bloodPressure"
  | "bodyMeasurement";
type ReviewSpan = "week" | "month";

const VIEW_MODE_OPTIONS = [
  { value: "chart", label: "グラフ" },
  { value: "history", label: "履歴" },
  { value: "review", label: "レビュー" },
] as const;

const REVIEW_SPAN_OPTIONS = [
  { value: "week", label: "週" },
  { value: "month", label: "月" },
] as const;

const HISTORY_KIND_OPTIONS = [
  { value: "weight", label: "体重" },
  { value: "meal", label: "食事" },
  { value: "water", label: "水分" },
  { value: "strength", label: "筋トレ" },
  { value: "diary", label: "日記" },
  { value: "activity", label: "活動" },
  { value: "bloodPressure", label: "血圧" },
  { value: "bodyMeasurement", label: "サイズ" },
] as const;

export default function TrendsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [period, setPeriod] = useState<Period>("month");
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (location.state as { viewMode?: ViewMode } | null)?.viewMode ?? "chart",
  );
  // 各記録画面から履歴タブへ戻ってきたとき、編集していた種別を維持する(Issue #73)
  const [historyKind, setHistoryKind] = useState<HistoryKind>(
    () => (location.state as { historyKind?: HistoryKind } | null)?.historyKind ?? "weight",
  );
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  // 週次レビューの表示週(月曜起点)。デフォルトは今週(画面設計書8.2章)
  const [reviewWeekStart, setReviewWeekStart] = useState(() => weekStartOf(todayDateString()));
  // レビューの粒度(週/月。Issue #114)と月次レビューの表示月(YYYY-MM)。デフォルトは今週が属する月
  const [reviewSpan, setReviewSpan] = useState<ReviewSpan>("week");
  const [reviewMonth, setReviewMonth] = useState(() => monthKeyOfWeek(weekStartOf(todayDateString())));

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

  // 血圧の推移グラフ用(Issue #117)。体重と同じ期間ロジック
  const bloodPressureChartRecords = useLiveQuery(() => {
    if (period === "all") return getAllBloodPressureRecordsDesc().then((rs) => rs.reverse());
    const days = period === "week" ? 6 : 29;
    return getBloodPressureRecordsByDateRange(dateStringDaysAgo(days), todayDateString());
  }, [period]);

  // 周囲径の推移グラフ用(Issue #118)。低頻度のため期間で切らず常に全期間を表示する(月1の点が消えないように)
  const bodyMeasurementChartRecords = useLiveQuery(() => getAllBodyMeasurementRecords(), []);

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

  // 歩数・睡眠グラフ(Garmin由来。Issue #82)。活動記録が1件も無い(未連携)ならnullでカードごと非表示。
  // undefined(ロード中)と区別するためnullへ正規化する(CLAUDE.mdのuseLiveQueryパターン)
  const activityDailyTotals = useLiveQuery(async () => {
    const firstActivityRecord = await db.activityRecords.orderBy("date").first();
    if (!firstActivityRecord) return null;
    const endDate = todayDateString();
    if (period === "all") {
      return getDailyActivityTotals(firstActivityRecord.date, endDate);
    }
    const days = period === "week" ? 6 : 29;
    return getDailyActivityTotals(dateStringDaysAgo(days), endDate);
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
  const waterHistoryRecords = useLiveQuery(
    () =>
      viewMode === "history" && historyKind === "water"
        ? getAllWaterRecordsDesc()
        : Promise.resolve<WaterRecord[]>([]),
    [viewMode, historyKind],
  );
  const workoutHistoryRecords = useLiveQuery(
    () =>
      viewMode === "history" && historyKind === "strength"
        ? getAllWorkoutRecordsDesc()
        : Promise.resolve<WorkoutRecord[]>([]),
    [viewMode, historyKind],
  );
  const diaryHistoryRecords = useLiveQuery(
    () =>
      viewMode === "history" && historyKind === "diary"
        ? getAllDiaryRecordsDesc()
        : Promise.resolve<DiaryRecord[]>([]),
    [viewMode, historyKind],
  );
  const activityHistoryRecords = useLiveQuery(
    () =>
      viewMode === "history" && historyKind === "activity"
        ? getAllActivityRecordsDesc()
        : Promise.resolve<ActivityRecord[]>([]),
    [viewMode, historyKind],
  );
  const bloodPressureHistoryRecords = useLiveQuery(
    () =>
      viewMode === "history" && historyKind === "bloodPressure"
        ? getAllBloodPressureRecordsDesc()
        : Promise.resolve<BloodPressureRecord[]>([]),
    [viewMode, historyKind],
  );
  const bodyMeasurementHistoryRecords = useLiveQuery(
    () =>
      viewMode === "history" && historyKind === "bodyMeasurement"
        ? getAllBodyMeasurementRecordsDesc()
        : Promise.resolve<BodyMeasurementRecord[]>([]),
    [viewMode, historyKind],
  );
  // 週次レビューのダイジェスト(Issue #45)。レビュータブ表示中のみ集計する。
  // 「未表示」もnullに解決するため、undefined(ロード中)と区別できる(CLAUDE.mdのuseLiveQueryパターン)
  const reviewDigest = useLiveQuery(
    () =>
      viewMode === "review" && reviewSpan === "week"
        ? getWeeklyDigest(reviewWeekStart)
        : Promise.resolve(null),
    [viewMode, reviewSpan, reviewWeekStart],
  );
  // 月次レビューのダイジェスト(Issue #114)。「月」選択中のみ集計する(週次と同じnull正規化パターン)
  const monthlyReviewDigest = useLiveQuery(
    () =>
      viewMode === "review" && reviewSpan === "month"
        ? getMonthlyDigest(reviewMonth)
        : Promise.resolve(null),
    [viewMode, reviewSpan, reviewMonth],
  );

  if (
    settings === undefined ||
    firstWeightRecord === undefined ||
    lastWeightRecord === undefined ||
    baselineWeightRecord === undefined ||
    weightChartRecords === undefined ||
    bloodPressureChartRecords === undefined ||
    bodyMeasurementChartRecords === undefined ||
    calorieDailyTotals === undefined ||
    waterDailyTotals === undefined ||
    activityDailyTotals === undefined ||
    historyRecords === undefined ||
    mealHistoryRecords === undefined ||
    waterHistoryRecords === undefined ||
    workoutHistoryRecords === undefined ||
    diaryHistoryRecords === undefined ||
    activityHistoryRecords === undefined ||
    bloodPressureHistoryRecords === undefined ||
    bodyMeasurementHistoryRecords === undefined ||
    reviewDigest === undefined ||
    monthlyReviewDigest === undefined
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
  const inHistoryRange = (date: string) =>
    (!historyFrom || date >= historyFrom) && (!historyTo || date <= historyTo);
  const filteredHistory = historyRecords.filter((record) => inHistoryRange(record.date));
  // 食事・水分はtimestamp(UTC ISO)を持つため、ローカル日付に直してからFrom/Toで絞り込む
  const filteredMealHistory = mealHistoryRecords.filter((record) =>
    inHistoryRange(formatDate(new Date(record.timestamp))),
  );
  const filteredWaterDays = groupWaterHistoryDays(waterHistoryRecords).filter((day) => inHistoryRange(day.date));
  const filteredWorkoutDays = groupWorkoutHistoryDays(workoutHistoryRecords).filter((day) => inHistoryRange(day.date));
  const filteredDiaryHistory = diaryHistoryRecords.filter((record) => inHistoryRange(record.date));
  const filteredActivityHistory = activityHistoryRecords.filter((record) => inHistoryRange(record.date));
  const filteredBloodPressureHistory = bloodPressureHistoryRecords.filter((record) => inHistoryRange(record.date));
  const filteredBodyMeasurementHistory = bodyMeasurementHistoryRecords.filter((record) => inHistoryRange(record.date));
  // 水分・筋トレは日付単位の行になるため、件数も日数を表す
  const historyCount = {
    weight: filteredHistory.length,
    meal: filteredMealHistory.length,
    water: filteredWaterDays.length,
    strength: filteredWorkoutDays.length,
    diary: filteredDiaryHistory.length,
    activity: filteredActivityHistory.length,
    bloodPressure: filteredBloodPressureHistory.length,
    bodyMeasurement: filteredBodyMeasurementHistory.length,
  }[historyKind];

  // 履歴確認画面から、入れ忘れた過去日の記録を新規に追加する導線(Issue #141)。
  // 体重・血圧・サイズは日付が主キー(1日1件)のため、未記録日でも新規入力画面として開けるよう
  // create=1 を付けて明示的な新規追加であることを伝える(タップ後に削除された、というエッジケースの
  // 「見つかりません」表示と区別するため)。水分・筋トレ・日記・食事は date だけで新規入力画面が開く。
  const handleAddHistoryEntry = (date: string, mealType?: MealType) => {
    switch (historyKind) {
      case "weight":
        navigate(`/record/weight?date=${date}&create=1`);
        break;
      case "meal":
        navigate(`/record/meal?type=${mealType}&date=${date}`);
        break;
      case "water":
        navigate(`/record/water?date=${date}`);
        break;
      case "strength":
        navigate(`/record/strength?date=${date}`);
        break;
      case "diary":
        navigate(`/record/diary?date=${date}`);
        break;
      case "bloodPressure":
        navigate(`/record/blood-pressure?date=${date}&create=1`);
        break;
      case "bodyMeasurement":
        navigate(`/record/measurement?date=${date}&create=1`);
        break;
    }
  };

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
            activityDailyTotals={activityDailyTotals}
            bloodPressureChartRecords={bloodPressureChartRecords}
            bodyMeasurementChartRecords={bodyMeasurementChartRecords}
            goalWeightKg={settings.goalWeightKg}
            dailyCalorieTarget={settings.dailyCalorieTarget}
            dailyWaterTargetMl={settings.dailyWaterTargetMl ?? null}
          />
        </>
      ) : viewMode === "review" ? (
        <>
          {/* レビューの粒度切り替え(週/月。Issue #114)。役割を分ける: 週=行動を変える振り返り、月=俯瞰 */}
          <SegmentedControl options={REVIEW_SPAN_OPTIONS} value={reviewSpan} onChange={setReviewSpan} />
          {reviewSpan === "week"
            ? reviewDigest && (
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
            : monthlyReviewDigest && (
                <MonthlyReview
                  // 週次と同じ理由で、月を切り替えるたびに再マウントしてローカル状態を持ち越さない
                  key={reviewMonth}
                  digest={monthlyReviewDigest}
                  onPrevMonth={() => setReviewMonth(addMonthsToMonthKey(reviewMonth, -1))}
                  onNextMonth={() => setReviewMonth(addMonthsToMonthKey(reviewMonth, 1))}
                  canGoNext={reviewMonth < monthKeyOfWeek(weekStartOf(todayDateString()))}
                />
              )}
        </>
      ) : (
        <>
          {/* 種別は8個と多いため等幅の分割ではなく横スクロールのチップ列にする(潰れ防止) */}
          <ScrollableChips
            options={HISTORY_KIND_OPTIONS}
            value={historyKind}
            onChange={setHistoryKind}
            ariaLabel="履歴の種別"
          />
          {/* From/Toは横並びだとスマホ幅で日付が切れるため縦に積む(Issue #75) */}
          <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
              <TextField
                type="date"
                label="From"
                size="small"
                value={historyFrom}
                onChange={(e) => setHistoryFrom(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                type="date"
                label="To"
                size="small"
                value={historyTo}
                onChange={(e) => setHistoryTo(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
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
            {historyKind === "activity"
              ? `${historyCount}件・新しい順(Garminから自動取得・編集不可)`
              : `${historyCount}件・新しい順(タップで編集)`}
          </Typography>
          {historyKind !== "activity" && (
            // 全期間表示でリストが長くなりやすいため、スクロールせず常に押せる位置(リスト上部)に置く(種別切替時はkeyで開きかけのフォームをリセット)
            <AddHistoryEntryButton key={historyKind} requireMealType={historyKind === "meal"} onAdd={handleAddHistoryEntry} />
          )}
          {historyKind === "weight" ? (
            <WeightHistoryList
              records={filteredHistory}
              baselineDate={settings.baselineDate}
              onSelect={(date) => navigate(`/record/weight?date=${date}`)}
            />
          ) : historyKind === "meal" ? (
            <MealHistoryList
              records={filteredMealHistory}
              onSelect={(date, mealType) => navigate(`/record/meal?type=${mealType}&date=${date}`)}
            />
          ) : historyKind === "water" ? (
            <WaterHistoryList
              days={filteredWaterDays}
              onSelect={(date) => navigate(`/record/water?date=${date}`)}
            />
          ) : historyKind === "strength" ? (
            <WorkoutHistoryList
              days={filteredWorkoutDays}
              onSelect={(date) => navigate(`/record/strength?date=${date}`)}
            />
          ) : historyKind === "diary" ? (
            <DiaryHistoryList
              records={filteredDiaryHistory}
              onSelect={(date) => navigate(`/record/diary?date=${date}`)}
            />
          ) : historyKind === "activity" ? (
            <ActivityHistoryList records={filteredActivityHistory} />
          ) : historyKind === "bloodPressure" ? (
            <BloodPressureHistoryList
              records={filteredBloodPressureHistory}
              onSelect={(date) => navigate(`/record/blood-pressure?date=${date}`)}
            />
          ) : (
            <BodyMeasurementHistoryList
              records={filteredBodyMeasurementHistory}
              onSelect={(date) => navigate(`/record/measurement?date=${date}`)}
            />
          )}
        </>
      )}
    </Box>
  );
}
