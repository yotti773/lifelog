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
      targetLabel={targetMl !== null ? `目標 ${targetMl.toLocaleString()}ml` : ""}
      barColor={tokens.waterMain}
      targetColor={tokens.waterMain}
      ariaLabel="水分摂取量推移グラフ"
    />
  );
}
