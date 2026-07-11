import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { IconChevronRight } from "@/components/icons";
import { fontRounded, tokens } from "@/theme";
import type { WeightRecord } from "@/types";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

interface WeightHistoryListProps {
  records: WeightRecord[];
  onSelect: (date: string) => void;
  /** 基準日バッジ表示用(設定の基準日と一致する行に付ける) */
  baselineDate?: string;
}

export default function WeightHistoryList({ records, onSelect, baselineDate }: WeightHistoryListProps) {
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
        const [, month, day] = record.date.split("-");
        const weekday = WEEKDAY_LABELS[new Date(`${record.date}T00:00:00`).getDay()];
        return (
          <ButtonBase
            key={record.id}
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
                {Number(month)}月{Number(day)}日
                <Box component="span" sx={{ fontSize: 11, color: "text.secondary", fontWeight: 500, ml: "6px" }}>
                  {weekday}
                </Box>
                {baselineDate === record.date && (
                  <Box
                    component="span"
                    sx={{
                      fontSize: 9,
                      color: "secondary.main",
                      bgcolor: tokens.secondarySoft,
                      px: "6px",
                      py: "2px",
                      borderRadius: "6px",
                      ml: "7px",
                      verticalAlign: "middle",
                    }}
                  >
                    基準日
                  </Box>
                )}
              </Typography>
              {record.note && (
                <Typography sx={{ fontSize: 11, color: tokens.faint, mt: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {record.note}
                </Typography>
              )}
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>
                {record.weightKg}
                <Box component="span" sx={{ fontSize: 10, color: "text.secondary" }}>
                  kg
                </Box>
              </Typography>
              <Typography
                sx={{
                  fontFamily: fontRounded,
                  fontWeight: 500,
                  fontSize: 11,
                  color: record.bodyFatPercent !== undefined ? "text.secondary" : tokens.faint2,
                  mt: "2px",
                }}
              >
                {record.bodyFatPercent !== undefined ? `${record.bodyFatPercent}%` : "-"}
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
