import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import BloodPressureChart from "./BloodPressureChart";
import BodyFatChart from "./BodyFatChart";
import BodyMeasurementChart from "./BodyMeasurementChart";
import CalorieChart from "./CalorieChart";
import SegmentedControl from "@/components/SegmentedControl";
import SleepChart from "./SleepChart";
import StepsChart from "./StepsChart";
import WaterChart from "./WaterChart";
import WeightChart from "./WeightChart";
import { fontRounded, tokens } from "@/theme";
import type { DailyActivityTotal } from "@/db/activityRecords";
import type { DailyCalorieTotal } from "@/db/mealRecords";
import type { DailyWaterTotal } from "@/db/waterRecords";
import type { BloodPressureRecord, BodyMeasurementRecord, WeightRecord } from "@/types";

export type Period = "week" | "month" | "all";

const PERIOD_OPTIONS = [
  { value: "week", label: "週" },
  { value: "month", label: "月" },
  { value: "all", label: "全期間" },
] as const;

interface WeightTrendChartsProps {
  period: Period;
  onPeriodChange: (period: Period) => void;
  weightChartRecords: WeightRecord[];
  calorieDailyTotals: DailyCalorieTotal[];
  waterDailyTotals: DailyWaterTotal[];
  /** 日別の歩数・睡眠(Garmin由来。Issue #82)。活動記録が1件も無い(未連携)場合はnullでカードごと非表示 */
  activityDailyTotals: DailyActivityTotal[] | null;
  /** 血圧記録(期間内。Issue #117)。1件も無ければカードごと非表示 */
  bloodPressureChartRecords: BloodPressureRecord[];
  /** 周囲径記録(期間内。Issue #118)。1件も無ければカードごと非表示 */
  bodyMeasurementChartRecords: BodyMeasurementRecord[];
  goalWeightKg: number;
  dailyCalorieTarget: number;
  dailyWaterTargetMl: number | null;
}

export default function WeightTrendCharts({
  period,
  onPeriodChange,
  weightChartRecords,
  calorieDailyTotals,
  waterDailyTotals,
  activityDailyTotals,
  bloodPressureChartRecords,
  bodyMeasurementChartRecords,
  goalWeightKg,
  dailyCalorieTarget,
  dailyWaterTargetMl,
}: WeightTrendChartsProps) {
  // 直近の体脂肪率(体脂肪率カードのヘッダー表示用)
  const latestBodyFat = [...weightChartRecords].reverse().find((r) => r.bodyFatPercent !== undefined)?.bodyFatPercent;

  return (
    <>
      <Card sx={{ p: "16px" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "12px" }}>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14 }}>体重</Typography>
          <SegmentedControl
            options={PERIOD_OPTIONS}
            value={period}
            onChange={onPeriodChange}
            size="small"
            activeVariant="primary"
          />
        </Box>
        <WeightChart records={weightChartRecords} goalWeightKg={goalWeightKg} />
      </Card>

      <Card sx={{ p: "16px" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "12px" }}>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14 }}>体脂肪率</Typography>
          {latestBodyFat !== undefined && (
            <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 15 }}>
              {latestBodyFat}
              <Box component="span" sx={{ fontSize: 11, color: "text.secondary" }}>
                %
              </Box>
            </Typography>
          )}
        </Box>
        <BodyFatChart records={weightChartRecords} />
      </Card>

      <Card sx={{ p: "16px" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "14px" }}>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14 }}>摂取カロリー</Typography>
          <Typography sx={{ display: "flex", alignItems: "center", gap: "5px", fontSize: 10, fontWeight: 500, color: "text.secondary" }}>
            <Box component="span" sx={{ width: 14, height: "2px", bgcolor: "primary.main", display: "inline-block" }} />
            目標 {dailyCalorieTarget.toLocaleString()}
          </Typography>
        </Box>
        <CalorieChart data={calorieDailyTotals} targetKcal={dailyCalorieTarget} />
      </Card>

      <Card sx={{ p: "16px" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "14px" }}>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14 }}>水分摂取量</Typography>
          {dailyWaterTargetMl !== null && (
            <Typography sx={{ display: "flex", alignItems: "center", gap: "5px", fontSize: 10, fontWeight: 500, color: "text.secondary" }}>
              <Box component="span" sx={{ width: 14, height: "2px", bgcolor: tokens.waterMain, display: "inline-block" }} />
              目標 {dailyWaterTargetMl.toLocaleString()}ml
            </Typography>
          )}
        </Box>
        <WaterChart data={waterDailyTotals} targetMl={dailyWaterTargetMl} />
      </Card>

      {activityDailyTotals !== null && (
        <>
          <Card sx={{ p: "16px" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "14px" }}>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14 }}>歩数</Typography>
              <Typography sx={{ fontSize: 10, fontWeight: 500, color: "text.secondary" }}>Garmin</Typography>
            </Box>
            <StepsChart data={activityDailyTotals} />
          </Card>

          <Card sx={{ p: "16px" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "14px" }}>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14 }}>睡眠時間</Typography>
              <Typography sx={{ fontSize: 10, fontWeight: 500, color: "text.secondary" }}>Garmin・時間</Typography>
            </Box>
            <SleepChart data={activityDailyTotals} />
          </Card>
        </>
      )}

      {/* 血圧(Issue #117)。記録が1件も無ければカードごと非表示 */}
      {bloodPressureChartRecords.length > 0 && (
        <Card sx={{ p: "16px" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "12px" }}>
            <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14 }}>血圧</Typography>
            <Box sx={{ display: "flex", gap: "10px" }}>
              <Typography sx={{ display: "flex", alignItems: "center", gap: "4px", fontSize: 10, fontWeight: 500, color: "text.secondary" }}>
                <Box component="span" sx={{ width: 10, height: "2px", bgcolor: "#FF6B4A", display: "inline-block" }} />
                最高
              </Typography>
              <Typography sx={{ display: "flex", alignItems: "center", gap: "4px", fontSize: 10, fontWeight: 500, color: "text.secondary" }}>
                <Box component="span" sx={{ width: 10, height: "2px", bgcolor: "#2EC4B6", display: "inline-block" }} />
                最低
              </Typography>
            </Box>
          </Box>
          <BloodPressureChart records={bloodPressureChartRecords} />
        </Card>
      )}

      {/* 周囲径(腹囲。Issue #118)。記録が1件も無ければカードごと非表示 */}
      {bodyMeasurementChartRecords.length > 0 && (
        <Card sx={{ p: "16px" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "12px" }}>
            <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14 }}>おなか周り</Typography>
            <Typography sx={{ fontSize: 10, fontWeight: 500, color: "text.secondary" }}>cm</Typography>
          </Box>
          <BodyMeasurementChart records={bodyMeasurementChartRecords} />
        </Card>
      )}
    </>
  );
}
