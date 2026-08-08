import type { DailyWaterTotal } from "@/db/waterRecords";
import { tokens } from "@/theme";
import DailyBarChart from "./DailyBarChart";

interface WaterChartProps {
  data: DailyWaterTotal[];
  /** 目標水分摂取量(ml)。未設定(null)の間は目標ラインを表示しない(画面設計書5章) */
  targetMl: number | null;
}

export default function WaterChart({ data, targetMl }: WaterChartProps) {
  return (
    <DailyBarChart
      data={data.map(({ date, amountMl }) => ({ date, value: amountMl }))}
      target={targetMl}
      barColor={tokens.waterMain}
      // 最新(今日)の棒は同系の濃色で強調する(Issue #128)
      todayColor={tokens.waterDeep}
      targetColor={tokens.waterMain}
      ariaLabel="水分摂取量推移グラフ"
    />
  );
}
