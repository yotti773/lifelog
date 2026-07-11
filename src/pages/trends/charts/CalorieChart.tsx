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
      targetLabel={`目標 ${targetKcal}kcal`}
      barColor="#2EC4B6"
      // アクセントのイエローは「達成した瞬間」専用のため、常時表示される目標線には使わずウォームグレーにする
      targetColor="#8C8C8C"
      ariaLabel="カロリー推移グラフ"
    />
  );
}
