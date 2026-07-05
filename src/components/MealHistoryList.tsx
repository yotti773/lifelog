import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { IconChevronRight } from "./icons";
import { formatDate, formatTime } from "@/lib/date";
import { fontRounded, tokens } from "@/theme";
import type { MealRecord, MealType } from "@/types";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
};

interface MealHistoryListProps {
  /** 新しい順(タイムスタンプ降順)で渡す。内部でローカル日付ごとにグループ化する */
  records: MealRecord[];
  onSelect: (id: string) => void;
}

export default function MealHistoryList({ records, onSelect }: MealHistoryListProps) {
  if (records.length === 0) {
    return (
      <Card>
        <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>記録がありません</Typography>
      </Card>
    );
  }

  // ローカル日付(YYYY-MM-DD)ごとにグループ化する。recordsは新しい順で渡される前提のため、
  // 挿入順のMapはそのまま日付降順になる。
  const groups = new Map<string, MealRecord[]>();
  for (const record of records) {
    const date = formatDate(new Date(record.timestamp));
    const list = groups.get(date) ?? [];
    list.push(record);
    groups.set(date, list);
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {[...groups.entries()].map(([date, items]) => {
        // 日付内は朝→夜の順で並べる(タイムスタンプ昇順)
        const sorted = [...items].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
        const [, month, day] = date.split("-");
        const weekday = WEEKDAY_LABELS[new Date(`${date}T00:00:00`).getDay()];
        const totalKcal = sorted.reduce((sum, item) => sum + item.confirmedKcal, 0);

        return (
          <Box key={date}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "8px", px: "4px" }}>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 14 }}>
                {Number(month)}月{Number(day)}日
                <Box component="span" sx={{ fontSize: 11, color: "text.secondary", fontWeight: 500, ml: "6px" }}>
                  {weekday}
                </Box>
              </Typography>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 600, fontSize: 12, color: "text.secondary" }}>
                合計 {totalKcal.toLocaleString()} kcal
              </Typography>
            </Box>
            <Card sx={{ overflow: "hidden" }}>
              {sorted.map((item, index) => (
                <ButtonBase
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    width: "100%",
                    p: "13px 15px",
                    textAlign: "left",
                    borderBottom: index < sorted.length - 1 ? `1px solid ${tokens.divider}` : "none",
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "7px", mb: "2px" }}>
                      <Typography sx={{ fontSize: 11, color: tokens.faint }}>{formatTime(item.timestamp)}</Typography>
                      <Typography
                        sx={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: "secondary.main",
                          bgcolor: tokens.secondarySoft,
                          px: "6px",
                          py: "1px",
                          borderRadius: "6px",
                        }}
                      >
                        {MEAL_TYPE_LABELS[item.mealType]}
                      </Typography>
                      {!item.synced && (
                        <Typography
                          sx={{
                            fontSize: 9,
                            fontWeight: 500,
                            color: tokens.warnText,
                            bgcolor: tokens.warnBg,
                            px: "6px",
                            py: "1px",
                            borderRadius: "6px",
                          }}
                        >
                          未同期
                        </Typography>
                      )}
                    </Box>
                    <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.confirmedName}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                    <Typography component="span" sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 15 }}>
                      {item.confirmedKcal}
                    </Typography>
                    <Typography component="span" sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 10, color: "text.secondary", ml: "2px" }}>
                      kcal
                    </Typography>
                  </Box>
                  <Box sx={{ color: "#D0C3AF", display: "flex", flexShrink: 0 }}>
                    <IconChevronRight />
                  </Box>
                </ButtonBase>
              ))}
            </Card>
          </Box>
        );
      })}
    </Box>
  );
}
