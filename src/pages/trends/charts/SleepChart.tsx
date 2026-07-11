import DailyBarChart from "./DailyBarChart";
import type { DailyActivityTotal } from "@/db/activityRecords";

interface SleepChartProps {
  data: DailyActivityTotal[];
}

/**
 * 睡眠時間推移(Garmin由来。Issue #82)。縦軸は時間(h)に変換して表示する(分のままだと目盛りが読みにくい)。
 * バーの黄はPFCのFと同じくグラフ系列色としての使用(theme.tsのaccent注記参照)
 */
export default function SleepChart({ data }: SleepChartProps) {
  return (
    <DailyBarChart
      data={data.map(({ date, sleepMinutes }) => ({ date, value: Math.round((sleepMinutes / 60) * 10) / 10 }))}
      target={null}
      targetLabel=""
      barColor="#FFC145"
      targetColor="#8C8C8C"
      ariaLabel="睡眠時間推移グラフ"
    />
  );
}
