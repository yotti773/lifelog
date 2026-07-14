import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { IconChevronRight } from "@/components/icons";
import { fontRounded, tokens } from "@/theme";
import type { BodyMeasurementRecord } from "@/types";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

interface BodyMeasurementHistoryListProps {
  records: BodyMeasurementRecord[];
  onSelect: (date: string) => void;
}

/** 周囲径の履歴一覧(Issue #118)。腹囲を主に、胸囲・太ももがあれば併記する。 */
export default function BodyMeasurementHistoryList({ records, onSelect }: BodyMeasurementHistoryListProps) {
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
        const extras = [
          record.chestCm !== undefined ? `胸 ${record.chestCm}` : null,
          record.thighCm !== undefined ? `腿 ${record.thighCm}` : null,
        ].filter((v): v is string => v !== null);
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
              </Typography>
              {record.note && (
                <Typography sx={{ fontSize: 11, color: tokens.faint, mt: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {record.note}
                </Typography>
              )}
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>
                {record.waistCm}
                <Box component="span" sx={{ fontSize: 10, color: "text.secondary", ml: "2px" }}>
                  cm
                </Box>
              </Typography>
              <Typography
                sx={{
                  fontFamily: fontRounded,
                  fontWeight: 500,
                  fontSize: 11,
                  color: extras.length > 0 ? "text.secondary" : tokens.faint2,
                  mt: "2px",
                }}
              >
                {extras.length > 0 ? extras.join(" / ") : "-"}
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
