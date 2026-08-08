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

/** 記録が無い日を除いた平均(整数に丸め)。対象が無ければnull */
function meanOfPositive(values: number[]): number | null {
  const positive = values.filter((v) => v > 0);
  if (positive.length === 0) return null;
  return Math.round(positive.reduce((a, b) => a + b, 0) / positive.length);
}

/** カード見出しに出す「現在値/平均」。ラベル(任意)+数値+単位を丸ゴシックで小さくまとめる */
function StatValue({ label, value, unit }: { label?: string; value: string; unit?: string }) {
  return (
    <Typography
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: "3px",
        fontFamily: fontRounded,
        fontWeight: 700,
        fontSize: 17,
        fontVariantNumeric: "tabular-nums",
        color: "text.primary",
        lineHeight: 1,
      }}
    >
      {label && (
        <Box component="span" sx={{ fontSize: 10, fontWeight: 700, color: "text.secondary" }}>
          {label}
        </Box>
      )}
      {value}
      {unit && (
        <Box component="span" sx={{ fontSize: 10, fontWeight: 500, color: "text.secondary" }}>
          {unit}
        </Box>
      )}
    </Typography>
  );
}

/**
 * 期間内の変化量チップ。体重・体脂肪率・おなか周りはいずれも「減る=良い」ため、
 * 減少を前進色(ティール)、増加を注意色(赤)で示す。アクセントの黄は使わない。
 * 矢印アイコンは使わず符号(−/+)と色で方向を表す(CLAUDE.mdの絵文字/アイコン方針のため)。
 */
function DeltaChip({ delta, unit, digits = 1 }: { delta: number; unit: string; digits?: number }) {
  if (Math.abs(delta) < 0.05) return null; // 実質変化なしは出さない
  const down = delta < 0;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: fontRounded,
        fontWeight: 700,
        fontSize: 11,
        px: "7px",
        py: "1px",
        borderRadius: "999px",
        fontVariantNumeric: "tabular-nums",
        color: down ? tokens.secondaryDeep : tokens.errorText,
        bgcolor: down ? tokens.secondarySoft : tokens.errorBg,
      }}
    >
      {down ? "−" : "+"}
      {Math.abs(delta).toFixed(digits)}
      {unit}
    </Box>
  );
}

/** カード見出しの共通レイアウト。狭幅では折り返して崩れないよう flexWrap を効かせる */
function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "6px 10px",
        mb: "12px",
      }}
    >
      {children}
    </Box>
  );
}

/** 見出し左側: タイトル+統計値を1クラスタにまとめる */
function TitleCluster({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Box sx={{ display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" }}>
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14 }}>{title}</Typography>
      {children}
    </Box>
  );
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
  // 各カード見出しに出す統計値を算出する。いずれも期間内の表示データから求める(Issue #128)
  const weightSorted = [...weightChartRecords].sort((a, b) => a.date.localeCompare(b.date));
  const weightCurrent = weightSorted.at(-1)?.weightKg ?? null;
  const weightDelta =
    weightSorted.length > 1 ? (weightSorted.at(-1) as WeightRecord).weightKg - weightSorted[0].weightKg : null;

  const bodyFatRecorded = weightSorted.filter((r) => r.bodyFatPercent !== undefined);
  const bodyFatCurrent = bodyFatRecorded.at(-1)?.bodyFatPercent ?? null;
  const bodyFatDelta =
    bodyFatRecorded.length > 1
      ? (bodyFatRecorded.at(-1) as WeightRecord).bodyFatPercent! - (bodyFatRecorded[0].bodyFatPercent as number)
      : null;

  const calorieAvg = meanOfPositive(calorieDailyTotals.map((d) => d.kcal));
  const waterAvg = meanOfPositive(waterDailyTotals.map((d) => d.amountMl));
  const stepsAvg = activityDailyTotals ? meanOfPositive(activityDailyTotals.map((d) => d.steps)) : null;
  const sleepMinutes = activityDailyTotals
    ? activityDailyTotals.map((d) => d.sleepMinutes).filter((m) => m > 0)
    : [];
  const sleepAvgHours =
    sleepMinutes.length > 0
      ? (sleepMinutes.reduce((a, b) => a + b, 0) / sleepMinutes.length / 60).toFixed(1)
      : null;

  const bpSorted = [...bloodPressureChartRecords].sort((a, b) => a.date.localeCompare(b.date));
  const bpLatest = bpSorted.at(-1) ?? null;

  const measureSorted = [...bodyMeasurementChartRecords].sort((a, b) => a.date.localeCompare(b.date));
  const measureCurrent = measureSorted.at(-1)?.waistCm ?? null;
  const measureDelta =
    measureSorted.length > 1 ? (measureSorted.at(-1) as BodyMeasurementRecord).waistCm - measureSorted[0].waistCm : null;

  return (
    <>
      <Card sx={{ p: "16px" }}>
        <CardHeader>
          <TitleCluster title="体重">
            {weightCurrent !== null && <StatValue value={weightCurrent.toFixed(1)} unit="kg" />}
            {weightDelta !== null && <DeltaChip delta={weightDelta} unit="kg" />}
          </TitleCluster>
          <SegmentedControl
            options={PERIOD_OPTIONS}
            value={period}
            onChange={onPeriodChange}
            size="small"
            activeVariant="primary"
          />
        </CardHeader>
        <WeightChart records={weightChartRecords} goalWeightKg={goalWeightKg} />
      </Card>

      <Card sx={{ p: "16px" }}>
        <CardHeader>
          <TitleCluster title="体脂肪率">
            {bodyFatCurrent !== undefined && bodyFatCurrent !== null && (
              <StatValue value={String(bodyFatCurrent)} unit="%" />
            )}
            {bodyFatDelta !== null && <DeltaChip delta={bodyFatDelta} unit="%" />}
          </TitleCluster>
        </CardHeader>
        <BodyFatChart records={weightChartRecords} />
      </Card>

      <Card sx={{ p: "16px" }}>
        <CardHeader>
          <TitleCluster title="摂取カロリー">
            {calorieAvg !== null && <StatValue label="平均" value={calorieAvg.toLocaleString()} unit="kcal" />}
          </TitleCluster>
          <Typography sx={{ display: "flex", alignItems: "center", gap: "5px", fontSize: 10, fontWeight: 500, color: "text.secondary" }}>
            <Box component="span" sx={{ width: 14, height: "2px", bgcolor: "text.secondary", display: "inline-block" }} />
            目標 {dailyCalorieTarget.toLocaleString()}
          </Typography>
        </CardHeader>
        <CalorieChart data={calorieDailyTotals} targetKcal={dailyCalorieTarget} />
      </Card>

      <Card sx={{ p: "16px" }}>
        <CardHeader>
          <TitleCluster title="水分摂取量">
            {waterAvg !== null && <StatValue label="平均" value={waterAvg.toLocaleString()} unit="ml" />}
          </TitleCluster>
          {dailyWaterTargetMl !== null && (
            <Typography sx={{ display: "flex", alignItems: "center", gap: "5px", fontSize: 10, fontWeight: 500, color: "text.secondary" }}>
              <Box component="span" sx={{ width: 14, height: "2px", bgcolor: tokens.waterMain, display: "inline-block" }} />
              目標 {dailyWaterTargetMl.toLocaleString()}ml
            </Typography>
          )}
        </CardHeader>
        <WaterChart data={waterDailyTotals} targetMl={dailyWaterTargetMl} />
      </Card>

      {activityDailyTotals !== null && (
        <>
          <Card sx={{ p: "16px" }}>
            <CardHeader>
              <TitleCluster title="歩数">
                {stepsAvg !== null && <StatValue label="平均" value={stepsAvg.toLocaleString()} unit="歩" />}
              </TitleCluster>
              <Typography sx={{ fontSize: 10, fontWeight: 500, color: "text.secondary" }}>Garmin</Typography>
            </CardHeader>
            <StepsChart data={activityDailyTotals} />
          </Card>

          <Card sx={{ p: "16px" }}>
            <CardHeader>
              <TitleCluster title="睡眠時間">
                {sleepAvgHours !== null && <StatValue label="平均" value={sleepAvgHours} unit="時間" />}
              </TitleCluster>
              <Typography sx={{ fontSize: 10, fontWeight: 500, color: "text.secondary" }}>Garmin</Typography>
            </CardHeader>
            <SleepChart data={activityDailyTotals} />
          </Card>
        </>
      )}

      {/* 血圧(Issue #117)。記録が1件も無ければカードごと非表示 */}
      {bloodPressureChartRecords.length > 0 && (
        <Card sx={{ p: "16px" }}>
          <CardHeader>
            <TitleCluster title="血圧">
              {bpLatest && <StatValue value={`${bpLatest.systolic}/${bpLatest.diastolic}`} unit="mmHg" />}
            </TitleCluster>
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
          </CardHeader>
          <BloodPressureChart records={bloodPressureChartRecords} />
        </Card>
      )}

      {/* 周囲径(腹囲。Issue #118)。記録が1件も無ければカードごと非表示 */}
      {bodyMeasurementChartRecords.length > 0 && (
        <Card sx={{ p: "16px" }}>
          <CardHeader>
            <TitleCluster title="おなか周り">
              {measureCurrent !== null && <StatValue value={measureCurrent.toFixed(1)} unit="cm" />}
              {measureDelta !== null && <DeltaChip delta={measureDelta} unit="cm" />}
            </TitleCluster>
          </CardHeader>
          <BodyMeasurementChart records={bodyMeasurementChartRecords} />
        </Card>
      )}
    </>
  );
}
