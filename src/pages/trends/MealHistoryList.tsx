import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { IconChevronRight } from "@/components/icons";
import { MEAL_TYPE_META, MEAL_TYPE_ORDER, isSkippedMealGroup } from "@/components/mealTypeMeta";
import { formatDate } from "@/lib/date";
import { fontRounded, tokens } from "@/theme";
import type { MealRecord, MealType } from "@/types";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

interface MealHistoryListProps {
  /** 新しい順(タイムスタンプ降順)で渡す。内部でローカル日付ごと→区分ごとにグループ化する */
  records: MealRecord[];
  /** 区分行タップで、その日のその区分の記録画面を開く(Issue #126) */
  onSelect: (date: string, mealType: MealType) => void;
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
      {[...groups.entries()].map(([date, dayRecords]) => {
        const [, month, day] = date.split("-");
        const weekday = WEEKDAY_LABELS[new Date(`${date}T00:00:00`).getDay()];
        const totalKcal = dayRecords.reduce((sum, item) => sum + item.confirmedKcal, 0);

        // 区分ごとに集約し、朝→夜の順(未記録の区分は出さない)
        const byType = new Map<MealType, MealRecord[]>();
        for (const record of dayRecords) {
          const list = byType.get(record.mealType) ?? [];
          list.push(record);
          byType.set(record.mealType, list);
        }
        const typeRows = MEAL_TYPE_ORDER.filter((type) => byType.has(type)).map((type) => {
          const items = [...byType.get(type)!].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
          return { type, items };
        });

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
              {typeRows.map(({ type, items }, index) => {
                const { label, Icon, iconBg, iconColor } = MEAL_TYPE_META[type];
                const isSkipped = isSkippedMealGroup(items);
                const kcal = items.reduce((sum, item) => sum + item.confirmedKcal, 0);
                const names = items.map((item) => item.confirmedName).join("、");
                const hasUnsynced = items.some((item) => !item.synced);
                return (
                  <ButtonBase
                    key={type}
                    onClick={() => onSelect(date, type)}
                    aria-label={`${Number(month)}月${Number(day)}日の${label}を開く`}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      width: "100%",
                      p: "12px 14px",
                      textAlign: "left",
                      borderBottom: index < typeRows.length - 1 ? `1px solid ${tokens.divider}` : "none",
                    }}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: "12px",
                        bgcolor: iconBg,
                        color: iconColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={21} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: "7px", mb: "2px" }}>
                        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13.5 }}>{label}</Typography>
                        {isSkipped ? (
                          <Typography sx={{ fontSize: 10, fontWeight: 700, color: "text.secondary", bgcolor: tokens.beigeSoft, px: "7px", borderRadius: "7px" }}>
                            食べなかった
                          </Typography>
                        ) : (
                          <Typography sx={{ fontSize: 10, fontWeight: 700, color: "primary.main", bgcolor: tokens.primarySoft, px: "7px", borderRadius: "7px" }}>
                            {items.length}品
                          </Typography>
                        )}
                        {hasUnsynced && (
                          <Typography sx={{ fontSize: 9, fontWeight: 500, color: tokens.warnText, bgcolor: tokens.warnBg, px: "6px", py: "1px", borderRadius: "6px" }}>
                            未同期
                          </Typography>
                        )}
                      </Box>
                      {!isSkipped && (
                        <Typography sx={{ fontSize: 11.5, color: "text.secondary", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {names}
                        </Typography>
                      )}
                    </Box>
                    {!isSkipped && (
                      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                        <Typography component="span" sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 15 }}>
                          {kcal.toLocaleString()}
                        </Typography>
                        <Typography component="span" sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 10, color: "text.secondary", ml: "2px" }}>
                          kcal
                        </Typography>
                      </Box>
                    )}
                    <Box sx={{ color: "#D0C3AF", display: "flex", flexShrink: 0 }}>
                      <IconChevronRight />
                    </Box>
                  </ButtonBase>
                );
              })}
            </Card>
          </Box>
        );
      })}
    </Box>
  );
}
