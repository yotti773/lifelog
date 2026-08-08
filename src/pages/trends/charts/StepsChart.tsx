import DailyBarChart from "./DailyBarChart";
import type { DailyActivityTotal } from "@/db/activityRecords";

interface StepsChartProps {
  data: DailyActivityTotal[];
}

/** 歩数推移(Garmin由来。Issue #82)。目標値の概念は持たないため目標線なし */
export default function StepsChart({ data }: StepsChartProps) {
  return (
    <DailyBarChart
      data={data.map(({ date, steps }) => ({ date, value: steps }))}
      target={null}
      barColor="#FF6B4A"
      // 棒がコーラルのため、最新(今日)は濃いコーラルで強調する(Issue #128)
      todayColor="#FF5A38"
      targetColor="#8C8C8C"
      ariaLabel="歩数推移グラフ"
    />
  );
}
