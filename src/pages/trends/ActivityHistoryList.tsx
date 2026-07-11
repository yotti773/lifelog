import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { fontRounded, tokens } from "@/theme";
import type { ActivityRecord } from "@/types";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/** 睡眠時間(分)を "7時間12分" 形式にする。60分未満は "45分" */
export function formatSleepDuration(sleepMinutes: number): string {
  const hours = Math.floor(sleepMinutes / 60);
  const minutes = sleepMinutes % 60;
  return hours === 0 ? `${minutes}分` : `${hours}時間${minutes}分`;
}

interface ActivityHistoryListProps {
  records: ActivityRecord[];
}

/**
 * 活動記録(Garmin由来)の履歴リスト(Issue #81)。
 * 他の履歴と違い読み取り専用 — 真実の情報源はGarmin側のため、タップしても記録画面には遷移しない。
 */
export default function ActivityHistoryList({ records }: ActivityHistoryListProps) {
  if (records.length === 0) {
    return (
      <Card>
        <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>
          記録がありません(Garmin連携をセットアップし、設定画面の「シートから取り込み」で反映されます)
        </Typography>
      </Card>
    );
  }

  return (
    <Card sx={{ overflow: "hidden" }}>
      {records.map((record, index) => {
        const [, month, dayOfMonth] = record.date.split("-");
        const weekday = WEEKDAY_LABELS[new Date(`${record.date}T00:00:00`).getDay()];
        return (
          <Box
            key={record.date}
            sx={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              p: "15px 16px",
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
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 11, color: "text.secondary", mt: "2px" }}>
                {record.sleepMinutes !== undefined ? `睡眠 ${formatSleepDuration(record.sleepMinutes)}` : "睡眠 −"}
                {record.sleepScore !== undefined && `(スコア${record.sleepScore})`}
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right", width: 84 }}>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>
                {record.steps !== undefined ? (
                  <>
                    {record.steps.toLocaleString()}
                    <Box component="span" sx={{ fontSize: 10, color: "text.secondary", fontWeight: 500 }}>
                      歩
                    </Box>
                  </>
                ) : (
                  "−"
                )}
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right", width: 92 }}>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>
                {record.totalKcal !== undefined ? (
                  <>
                    {Math.round(record.totalKcal).toLocaleString()}
                    <Box component="span" sx={{ fontSize: 10, color: "text.secondary", fontWeight: 500 }}>
                      kcal
                    </Box>
                  </>
                ) : (
                  "−"
                )}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Card>
  );
}
