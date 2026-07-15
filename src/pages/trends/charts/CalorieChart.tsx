import type { DailyCalorieTotal } from "@/db/mealRecords";
import DailyBarChart from "./DailyBarChart";

interface CalorieChartProps {
  data: DailyCalorieTotal[];
  targetKcal: number;
}

export default function CalorieChart({ data, targetKcal }: CalorieChartProps) {
  return (
    <DailyBarChart
      data={data.map(({ date, kcal }) => ({ date, value: kcal }))}
      target={targetKcal}
      barColor="#2EC4B6"
      // 最新(今日)の棒はコーラルで強調して「今」を目立たせる(Issue #128)
      todayColor="#FF6B4A"
      // アクセントのイエローは「達成した瞬間」専用のため、常時表示される目標線には使わずウォームグレーにする
      targetColor="#8C8C8C"
      ariaLabel="カロリー推移グラフ"
    />
  );
}
