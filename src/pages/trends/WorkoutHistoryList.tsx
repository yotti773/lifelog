import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { IconChevronRight } from "@/components/icons";
import { fontRounded, tokens } from "@/theme";
import type { WorkoutRecord } from "@/types";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/** 履歴確認画面の筋トレ1日分(種目名の一覧と総セット数) */
export interface WorkoutHistoryDay {
  date: string; // YYYY-MM-DD
  exerciseNames: string[]; // exerciseOrder順
  setCount: number;
}

/**
 * 日付降順のセットレコードを日付ごとに集約する(Issue #73)。
 * 入力が日付降順である前提のため、挿入順のMapがそのまま日付降順になる
 */
export function groupWorkoutHistoryDays(records: WorkoutRecord[]): WorkoutHistoryDay[] {
  // 種目名を画面上の並び(exerciseOrder)で復元するため、日付ごとに一旦orderでソートする
  const byDate = new Map<string, WorkoutRecord[]>();
  for (const record of records) {
    const list = byDate.get(record.date) ?? [];
    list.push(record);
    byDate.set(record.date, list);
  }
  return [...byDate.entries()].map(([date, dayRecords]) => {
    const sorted = [...dayRecords].sort((a, b) => a.exerciseOrder - b.exerciseOrder || a.setNumber - b.setNumber);
    const exerciseNames: string[] = [];
    let lastOrder = 0;
    for (const record of sorted) {
      if (record.exerciseOrder !== lastOrder) {
        exerciseNames.push(record.exerciseName);
        lastOrder = record.exerciseOrder;
      }
    }
    return { date, exerciseNames, setCount: sorted.length };
  });
}

interface WorkoutHistoryListProps {
  days: WorkoutHistoryDay[];
  onSelect: (date: string) => void;
}

export default function WorkoutHistoryList({ days, onSelect }: WorkoutHistoryListProps) {
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
              <Typography sx={{ fontSize: 11, color: tokens.faint, mt: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {day.exerciseNames.join("・")}
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right", flexShrink: 0 }}>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>
                {day.exerciseNames.length}
                <Box component="span" sx={{ fontSize: 10, color: "text.secondary" }}>
                  種目
                </Box>
              </Typography>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 11, color: "text.secondary", mt: "2px" }}>
                {day.setCount}セット
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
