import { useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import ShareCardLauncher from "@/components/ShareCardLauncher";
import { IconBack, IconChevronRight } from "@/components/icons";
import { db } from "@/db/db";
import { getBloodPressureRecord } from "@/db/bloodPressureRecords";
import { getDiaryRecord } from "@/db/diaryRecords";
import { getRecordedDateSet } from "@/db/recordedDays";
import { getSettings, shouldShowInitialSetup } from "@/db/settings";
import { getWaterRecordsForDate } from "@/db/waterRecords";
import { getWorkoutRecordsForDate } from "@/db/workoutRecords";
import { addDaysToDateString, daysBetween, localDateRangeToUtcIso, todayDateString } from "@/lib/date";
import { currentStreakDays, streakDaysEndingOn } from "@/lib/recording";
import { buildDailyShareCard, hasShareCardContent, type DailyShareSource } from "@/lib/shareCard";
import { fontRounded, tokens } from "@/theme";
import BodyMetricsCards from "./BodyMetricsCards";
import CalorieCard from "./CalorieCard";
import DailyExtrasList from "./DailyExtrasList";
import HabitChecklist from "./HabitChecklist";
import TodayMealList from "./TodayMealList";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function greeting(hour: number): string {
  if (hour < 11) return "おはよう、今日も記録しよう";
  if (hour < 18) return "こんにちは、今日も記録しよう";
  return "こんばんは、今日も記録しよう";
}

/** 過去日を表示しているときの見出し(Issue #226)。何日前かが一目で分かるようにする */
function pastDayLabel(daysAgo: number): string {
  if (daysAgo === 1) return "昨日の記録";
  if (daysAgo === 2) return "一昨日の記録";
  return `${daysAgo}日前の記録`;
}

/**
 * 表示する日付をURLパラメータ(?date=YYYY-MM-DD)から決める(Issue #226)。
 * 未来日・不正な値は今日に倒す — 未来の記録は存在せず、空の画面を見せても意味がないため
 */
function resolveViewDate(param: string | null, today: string): string {
  if (param === null || !/^\d{4}-\d{2}-\d{2}$/.test(param)) return today;
  return param > today ? today : param;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const today = todayDateString();
  // 表示中の日付。既定は今日で、?date= を付けると過去日をそのまま振り返れる(Issue #226)
  const date = resolveViewDate(searchParams.get("date"), today);
  const isToday = date === today;
  const daysAgo = daysBetween(date, today);

  const settings = useLiveQuery(() => getSettings(), []);

  // 目標が未設定のまま(かつスキップもしていない)なら初回セットアップへ送る(Issue #217)
  useEffect(() => {
    if (settings !== undefined && shouldShowInitialSetup(settings)) {
      navigate("/setup", { replace: true });
    }
  }, [settings, navigate]);

  const weight = useLiveQuery(() => db.weightRecords.get(date), [date]);
  // 前回比の基準になる、表示日より前の直近の記録。「未解決」と「記録なし」を区別するためnullに正規化する
  const previousWeight = useLiveQuery(
    () => db.weightRecords.where("date").below(date).last().then((v) => v ?? null),
    [date],
  );
  const [dayStartIso, dayEndIso] = localDateRangeToUtcIso(date);
  const meals = useLiveQuery(
    () =>
      db.mealRecords
        .where("timestamp")
        .between(dayStartIso, dayEndIso, true, true)
        .sortBy("timestamp"),
    [dayStartIso, dayEndIso],
  );
  const waterRecords = useLiveQuery(() => getWaterRecordsForDate(date), [date]);
  // 「未記録」に正当に解決しうるクエリはnullに正規化する(undefined=ロード中と区別するため。TrendsPage.tsx参照)
  const diary = useLiveQuery(() => getDiaryRecord(date).then((v) => v ?? null), [date]);
  const workoutRecords = useLiveQuery(() => getWorkoutRecordsForDate(date), [date]);
  // 血圧(表示日)・周囲径(最新)。「未記録」とロード中を区別するためnullに正規化する(Issue #117・#118)
  const bloodPressure = useLiveQuery(() => getBloodPressureRecord(date).then((v) => v ?? null), [date]);
  const latestMeasurement = useLiveQuery(
    () => db.bodyMeasurementRecords.orderBy("date").last().then((v) => v ?? null),
    [],
  );
  // 表示日の活動記録(SNS共有カードの歩数。Issue #235)。Garmin連携は前日分を翌3時に取り込むため
  // 当日分は通常まだ無い — 「未記録」とロード中を区別するためnullに正規化する
  const activity = useLiveQuery(() => db.activityRecords.get(date).then((v) => v ?? null), [date]);
  // 連続記録日数(Issue #46)。常時表示のためaccent色は使わない(デザインガイドの制約)。
  // **過去日では「その日時点」の連続日数を出す**(当日だけ「未記録でも継続中」の猶予を認める。Issue #226)
  const streakDays = useLiveQuery(
    async () => {
      const recorded = await getRecordedDateSet();
      return isToday ? currentStreakDays(recorded, today) : streakDaysEndingOn(recorded, date);
    },
    [date, isToday, today],
  );

  if (
    meals === undefined ||
    settings === undefined ||
    waterRecords === undefined ||
    diary === undefined ||
    workoutRecords === undefined ||
    bloodPressure === undefined ||
    latestMeasurement === undefined
  ) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  const totalKcal = meals.reduce((sum, meal) => sum + meal.confirmedKcal, 0);
  // PFCは手入力で小数値を取りうるため、合算時の浮動小数点誤差(例: 17.900000000000002)を丸めて吸収する
  const totalProteinG = Math.round(meals.reduce((sum, meal) => sum + meal.confirmedProteinG, 0) * 10) / 10;
  const totalFatG = Math.round(meals.reduce((sum, meal) => sum + meal.confirmedFatG, 0) * 10) / 10;
  const totalCarbsG = Math.round(meals.reduce((sum, meal) => sum + meal.confirmedCarbsG, 0) * 10) / 10;

  const now = new Date();

  // SNS共有カード(Issue #235)。画面が既に読み込んでいる表示日分の値だけで組み立てる
  const shareSource: DailyShareSource = {
    date,
    weightKg: weight?.weightKg ?? null,
    previousWeightKg: previousWeight?.weightKg ?? null,
    // 食事記録が1件も無い日は「0kcal」ではなく未記録として扱う
    intakeKcal: meals.length > 0 ? totalKcal : null,
    targetKcal: settings.dailyCalorieTarget ?? null,
    proteinG: meals.length > 0 ? totalProteinG : null,
    fatG: meals.length > 0 ? totalFatG : null,
    carbsG: meals.length > 0 ? totalCarbsG : null,
    waterMl: waterRecords.length > 0 ? waterRecords.reduce((sum, record) => sum + record.amountMl, 0) : null,
    steps: activity?.steps ?? null,
    workoutSets: workoutRecords.map(({ exerciseName, exerciseOrder, setNumber, weightKg, reps }) => ({
      exerciseName,
      exerciseOrder,
      setNumber,
      weightKg,
      reps,
    })),
    streakDays: streakDays ?? 0,
  };
  const shareCardHasContent = hasShareCardContent(buildDailyShareCard(shareSource, { today }));

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "24px", pb: "130px" }}>
      {/* ヘッダー。日付ナビで過去日を振り返れる(Issue #226) */}
      <Box sx={{ mb: "20px" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", mb: "3px" }}>
          <Typography sx={{ fontSize: 13, fontWeight: 500, color: "text.secondary" }}>
            {isToday ? greeting(now.getHours()) : pastDayLabel(daysAgo)}
          </Typography>
          {/* 過去日からは1タップで今日へ戻れるようにする(◀▶の連打で戻らせない) */}
          {!isToday && (
            <ButtonBase
              onClick={() => navigate("/")}
              sx={{
                fontFamily: fontRounded,
                fontWeight: 700,
                fontSize: 11,
                color: "primary.main",
                bgcolor: tokens.primarySoft,
                px: "10px",
                py: "4px",
                borderRadius: "20px",
                flexShrink: 0,
              }}
            >
              今日へ
            </ButtonBase>
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
            <ButtonBase
              onClick={() => navigate(`/?date=${addDaysToDateString(date, -1)}`)}
              aria-label="前の日"
              sx={{ width: 30, height: 30, borderRadius: "50%", bgcolor: "background.paper", boxShadow: tokens.fieldShadow, color: "text.secondary", flexShrink: 0 }}
            >
              <IconBack size={12} />
            </ButtonBase>
            <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 22, letterSpacing: ".01em", whiteSpace: "nowrap" }}>
              {Number(date.slice(5, 7))}月{Number(date.slice(8, 10))}日
              <Box component="span" sx={{ fontSize: 15, color: "text.secondary", ml: "6px", fontWeight: 500 }}>
                {WEEKDAY_LABELS[new Date(`${date}T00:00:00`).getDay()]}曜日
              </Box>
            </Typography>
            <ButtonBase
              onClick={() => navigate(`/?date=${addDaysToDateString(date, 1)}`)}
              disabled={isToday}
              aria-label="次の日"
              sx={{ width: 30, height: 30, borderRadius: "50%", bgcolor: "background.paper", boxShadow: tokens.fieldShadow, color: "text.secondary", opacity: isToday ? 0.35 : 1, flexShrink: 0 }}
            >
              <IconChevronRight size={12} />
            </ButtonBase>
          </Box>
          {streakDays !== undefined && streakDays > 0 && (
            <Typography
              sx={{
                fontFamily: fontRounded,
                fontWeight: 700,
                fontSize: 11,
                color: tokens.secondaryDeep,
                bgcolor: tokens.secondarySoft,
                px: "10px",
                py: "5px",
                borderRadius: "20px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              連続{streakDays}日{isToday ? "記録中" : ""}
            </Typography>
          )}
        </Box>
      </Box>

      {/* カロリーカード */}
      <Box sx={{ mb: "14px" }}>
        <CalorieCard
          isToday={isToday}
          consumedKcal={totalKcal}
          targetKcal={settings.dailyCalorieTarget}
          proteinG={totalProteinG}
          fatG={totalFatG}
          carbsG={totalCarbsG}
          pfcTargets={
            settings.dailyProteinTargetG !== undefined &&
            settings.dailyFatTargetG !== undefined &&
            settings.dailyCarbsTargetG !== undefined
              ? {
                  proteinG: settings.dailyProteinTargetG,
                  fatG: settings.dailyFatTargetG,
                  carbsG: settings.dailyCarbsTargetG,
                }
              : null
          }
        />
      </Box>

      <BodyMetricsCards
        weight={weight}
        previousWeight={previousWeight}
        onOpen={() => navigate(`/record/weight?date=${date}${isToday ? "" : "&create=1"}`)}
      />

      <TodayMealList meals={meals} totalKcal={totalKcal} date={date} isToday={isToday} />

      <DailyExtrasList
        date={date}
        isToday={isToday}
        waterRecords={waterRecords}
        waterTargetMl={settings.dailyWaterTargetMl}
        diary={diary}
        workoutRecords={workoutRecords}
        bloodPressure={bloodPressure}
        latestMeasurement={latestMeasurement}
      />

      <HabitChecklist date={date} isToday={isToday} />

      {/* SNS共有カード(Issue #235)。載せる数字が無い日は導線ごと出さない */}
      {shareCardHasContent && (
        <Box sx={{ mt: "14px" }}>
          <ShareCardLauncher
            buildModel={(options) => buildDailyShareCard(shareSource, { ...options, today })}
            description={
              isToday
                ? "今日の記録をカード画像にして、SNSに投稿できます"
                : "この日の記録をカード画像にして、SNSに投稿できます"
            }
          />
        </Box>
      )}
    </Box>
  );
}
