import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { db } from "@/db/db";
import { getBloodPressureRecord } from "@/db/bloodPressureRecords";
import { getDiaryRecord } from "@/db/diaryRecords";
import { getRecordedDateSet } from "@/db/recordedDays";
import { getSettings } from "@/db/settings";
import { getWaterRecordsForDate } from "@/db/waterRecords";
import { getWorkoutRecordsForDate } from "@/db/workoutRecords";
import { localDateRangeToUtcIso, todayDateString } from "@/lib/date";
import { currentStreakDays } from "@/lib/recording";
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

export default function HomePage() {
  const navigate = useNavigate();
  const today = todayDateString();

  const weight = useLiveQuery(() => db.weightRecords.get(today), [today]);
  // 前回比の基準になる、今日より前の直近の記録。「未解決」と「記録なし」を区別するためnullに正規化する
  const previousWeight = useLiveQuery(
    () => db.weightRecords.where("date").below(today).last().then((v) => v ?? null),
    [today],
  );
  const [todayStartIso, todayEndIso] = localDateRangeToUtcIso(today);
  const meals = useLiveQuery(
    () =>
      db.mealRecords
        .where("timestamp")
        .between(todayStartIso, todayEndIso, true, true)
        .sortBy("timestamp"),
    [todayStartIso, todayEndIso],
  );
  const settings = useLiveQuery(() => getSettings(), []);
  const waterRecords = useLiveQuery(() => getWaterRecordsForDate(today), [today]);
  // 「未記録」に正当に解決しうるクエリはnullに正規化する(undefined=ロード中と区別するため。TrendsPage.tsx参照)
  const diary = useLiveQuery(() => getDiaryRecord(today).then((v) => v ?? null), [today]);
  const workoutRecords = useLiveQuery(() => getWorkoutRecordsForDate(today), [today]);
  // 血圧(今日)・周囲径(最新)。「未記録」とロード中を区別するためnullに正規化する(Issue #117・#118)
  const bloodPressure = useLiveQuery(() => getBloodPressureRecord(today).then((v) => v ?? null), [today]);
  const latestMeasurement = useLiveQuery(
    () => db.bodyMeasurementRecords.orderBy("date").last().then((v) => v ?? null),
    [],
  );
  // 連続記録日数(Issue #46)。常時表示のためaccent色は使わない(デザインガイドの制約)
  const streakDays = useLiveQuery(
    async () => currentStreakDays(await getRecordedDateSet(), today),
    [today],
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

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "24px", pb: "130px" }}>
      {/* ヘッダー */}
      <Box sx={{ mb: "20px" }}>
        <Typography sx={{ fontSize: 13, fontWeight: 500, color: "text.secondary", mb: "3px" }}>
          {greeting(now.getHours())}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 22, letterSpacing: ".01em" }}>
            {now.getMonth() + 1}月{now.getDate()}日
            <Box component="span" sx={{ fontSize: 15, color: "text.secondary", ml: "6px", fontWeight: 500 }}>
              {WEEKDAY_LABELS[now.getDay()]}曜日
            </Box>
          </Typography>
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
              連続{streakDays}日記録中
            </Typography>
          )}
        </Box>
      </Box>

      {/* カロリーカード */}
      <Box sx={{ mb: "14px" }}>
        <CalorieCard
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
        onOpen={() => navigate(`/record/weight?date=${today}`)}
      />

      <TodayMealList meals={meals} totalKcal={totalKcal} />

      <DailyExtrasList
        today={today}
        waterRecords={waterRecords}
        waterTargetMl={settings.dailyWaterTargetMl}
        diary={diary}
        workoutRecords={workoutRecords}
        bloodPressure={bloodPressure}
        latestMeasurement={latestMeasurement}
      />

      <HabitChecklist today={today} />
    </Box>
  );
}
