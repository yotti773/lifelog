import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { IconChevronRight } from "@/components/icons";
import { formatDate } from "@/lib/date";
import { fontRounded, tokens } from "@/theme";
import type { WaterRecord } from "@/types";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/** 履歴確認画面の水分1日分(日付ごとの合計と記録回数) */
export interface WaterHistoryDay {
  date: string; // YYYY-MM-DD
  totalMl: number;
  count: number;
}

/**
 * 新しい順(タイムスタンプ降順)の水分記録をローカル日付ごとに集約する(Issue #73)。
 * 入力が降順である前提のため、挿入順のMapがそのまま日付降順になる
 */
export function groupWaterHistoryDays(records: WaterRecord[]): WaterHistoryDay[] {
  const byDate = new Map<string, WaterHistoryDay>();
  for (const record of records) {
    const date = formatDate(new Date(record.timestamp));
    const day = byDate.get(date) ?? { date, totalMl: 0, count: 0 };
    day.totalMl += record.amountMl;
    day.count += 1;
    byDate.set(date, day);
  }
  return [...byDate.values()];
}

interface WaterHistoryListProps {
  days: WaterHistoryDay[];
  onSelect: (date: string) => void;
}

export default function WaterHistoryList({ days, onSelect }: WaterHistoryListProps) {
  if (days.length === 0) {
    return (
      <Card>
        <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>記録がありません</Typography>
      </Card>
    );
  }

  return (
    <Card sx={{ overflow: "hidden" }}>
      {days.map((day, index) => {
        const [, month, dayOfMonth] = day.date.split("-");
        const weekday = WEEKDAY_LABELS[new Date(`${day.date}T00:00:00`).getDay()];
        return (
          <ButtonBase
            key={day.date}
            onClick={() => onSelect(day.date)}
            sx={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              p: "15px 16px",
              textAlign: "left",
              borderBottom: index < days.length - 1 ? `1px solid ${tokens.divider}` : "none",
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14 }}>
                {Number(month)}月{Number(dayOfMonth)}日
                <Box component="span" sx={{ fontSize: 11, color: "text.secondary", fontWeight: 500, ml: "6px" }}>
                  {weekday}
                </Box>
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16, color: tokens.waterDeep }}>
                {day.totalMl.toLocaleString()}
                <Box component="span" sx={{ fontSize: 10, color: "text.secondary" }}>
                  ml
                </Box>
              </Typography>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 11, color: "text.secondary", mt: "2px" }}>
                {day.count}回
              </Typography>
            </Box>
            <Box sx={{ color: "#D0C3AF", ml: "10px", display: "flex" }}>
              <IconChevronRight />
            </Box>
          </ButtonBase>
        );
      })}
    </Card>
  );
}
