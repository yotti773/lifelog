import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import MoodIcon from "@/components/MoodIcon";
import { IconChevronRight } from "@/components/icons";
import { fontRounded, tokens } from "@/theme";
import type { DiaryRecord } from "@/types";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

interface DiaryHistoryListProps {
  /** 日付降順で渡す */
  records: DiaryRecord[];
  onSelect: (date: string) => void;
}

export default function DiaryHistoryList({ records, onSelect }: DiaryHistoryListProps) {
  if (records.length === 0) {
    return (
      <Card>
        <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>記録がありません</Typography>
      </Card>
    );
  }

  return (
    <Card sx={{ overflow: "hidden" }}>
      {records.map((record, index) => {
        const [, month, dayOfMonth] = record.date.split("-");
        const weekday = WEEKDAY_LABELS[new Date(`${record.date}T00:00:00`).getDay()];
        return (
          <ButtonBase
            key={record.date}
            onClick={() => onSelect(record.date)}
            sx={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              p: "15px 16px",
              textAlign: "left",
              borderBottom: index < records.length - 1 ? `1px solid ${tokens.divider}` : "none",
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14 }}>
                {Number(month)}月{Number(dayOfMonth)}日
                <Box component="span" sx={{ fontSize: 11, color: "text.secondary", fontWeight: 500, ml: "6px" }}>
                  {weekday}
                </Box>
              </Typography>
              {record.text !== "" && (
                <Typography sx={{ fontSize: 11, color: tokens.faint, mt: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {record.text}
                </Typography>
              )}
            </Box>
            {record.mood && (
              <Box sx={{ ml: "10px", display: "flex", flexShrink: 0 }}>
                <MoodIcon mood={record.mood} size={24} />
              </Box>
            )}
            <Box sx={{ color: "#D0C3AF", ml: "10px", display: "flex" }}>
              <IconChevronRight />
            </Box>
          </ButtonBase>
        );
      })}
    </Card>
  );
}
