import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import BodyFatChart from "./BodyFatChart";
import CalorieChart from "./CalorieChart";
import SegmentedControl from "./SegmentedControl";
import WaterChart from "./WaterChart";
import WeightChart from "./WeightChart";
import { fontRounded, tokens } from "@/theme";
import type { DailyCalorieTotal } from "@/db/mealRecords";
import type { DailyWaterTotal } from "@/db/waterRecords";
import type { WeightRecord } from "@/types";

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
    </>
  );
}
