import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import {
  IconBreakfast,
  IconChevronRight,
  IconDinner,
  IconLunch,
  IconSnack,
} from "@/components/icons";
import { formatTime } from "@/lib/date";
import { fontRounded, tokens } from "@/theme";
import type { MealRecord, MealType } from "@/types";

const MEAL_STYLES: Record<MealType, { label: string; Icon: typeof IconBreakfast; iconBg: string; iconColor: string }> = {
  breakfast: { label: "朝食", Icon: IconBreakfast, iconBg: tokens.breakfastBg, iconColor: tokens.warnIcon },
  lunch: { label: "昼食", Icon: IconLunch, iconBg: "#FFE6DE", iconColor: "#FF6B4A" },
  dinner: { label: "夕食", Icon: IconDinner, iconBg: tokens.secondarySoft, iconColor: "#2EC4B6" },
  snack: { label: "間食", Icon: IconSnack, iconBg: tokens.warnBg, iconColor: tokens.warnText },
};
const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

interface TodayMealListProps {
  /** 今日の食事記録(時刻昇順) */
  meals: MealRecord[];
  totalKcal: number;
}

/** ホーム画面の「今日の食事」セクション。区分ごとに記録を並べ、未記録の区分は追加導線を出す */
export default function TodayMealList({ meals, totalKcal }: TodayMealListProps) {
  const navigate = useNavigate();

  const mealsByType = new Map<MealType, MealRecord[]>();
  for (const meal of meals) {
    const list = mealsByType.get(meal.mealType) ?? [];
    list.push(meal);
    mealsByType.set(meal.mealType, list);
  }

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "12px", px: "2px" }}>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>今日の食事</Typography>
        <Typography sx={{ fontSize: 12, fontWeight: 500, color: "text.secondary" }}>
          合計 {totalKcal.toLocaleString()} kcal
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {MEAL_ORDER.map((mealType) => {
          const { label, Icon, iconBg, iconColor } = MEAL_STYLES[mealType];
          const items = mealsByType.get(mealType);
          const goToNewMeal = () => navigate(`/record/meal?type=${mealType}`);

          if (!items) {
            return (
              <ButtonBase
                key={mealType}
                onClick={goToNewMeal}
                sx={{
                  border: `1.5px dashed #DED4C4`,
                  borderRadius: "18px",
                  p: "14px 15px",
                  display: "flex",
                  alignItems: "center",
                  gap: "13px",
                  textAlign: "left",
                }}
              >
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: "13px",
                    bgcolor: tokens.beigeSoft,
                    color: tokens.faint2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={22} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, color: "text.secondary" }}>
                    {label}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: tokens.faint, mt: "2px" }}>未記録</Typography>
                </Box>
              </ButtonBase>
            );
          }

          return items.map((item, index) => (
            <Box
              key={item.id}
              sx={{
                bgcolor: "background.paper",
                borderRadius: "18px",
                display: "flex",
                alignItems: "stretch",
                boxShadow: tokens.rowCardShadow,
              }}
            >
              {/* 区分ラベル部分(アイコン+ラベル): タップすると同じ区分の新規記録を開く */}
              <ButtonBase
                onClick={goToNewMeal}
                aria-label={`${label}を追加で記録する`}
                sx={{ display: "flex", alignItems: "center", gap: "10px", p: "14px 10px 14px 15px", borderRadius: "18px 0 0 18px", flexShrink: 0 }}
              >
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: "13px",
                    bgcolor: iconBg,
                    color: iconColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={22} />
                </Box>
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap" }}>
                  {label}
                  {items.length > 1 ? ` ${index + 1}` : ""}
                </Typography>
              </ButtonBase>
              {/* 品目詳細部分: タップするとこの品目の編集画面を開く */}
              <ButtonBase
                onClick={() => navigate(`/record/meal?id=${item.id}`)}
                sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "10px", p: "14px 15px 14px 6px", textAlign: "left", borderRadius: "0 18px 18px 0" }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "7px", mb: "2px" }}>
                    <Typography sx={{ fontSize: 11, color: tokens.faint }}>{formatTime(item.timestamp)}</Typography>
                    {!item.synced && (
                      <Typography
                        sx={{
                          fontSize: 9,
                          fontWeight: 500,
                          color: tokens.warnText,
                          bgcolor: tokens.warnBg,
                          px: "6px",
                          py: "2px",
                          borderRadius: "6px",
                        }}
                      >
                        未同期
                      </Typography>
                    )}
                  </Box>
                  <Typography sx={{ fontSize: 12, color: "text.secondary", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.confirmedName}
                  </Typography>
                </Box>
                <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                  <Typography component="span" sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>
                    {item.confirmedKcal}
                  </Typography>
                  <Typography component="span" sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 10, color: "text.secondary", ml: "2px" }}>
                    kcal
                  </Typography>
                </Box>
                <Box sx={{ color: "text.primary", opacity: 0.35, display: "flex", flexShrink: 0 }}>
                  <IconChevronRight size={13} />
                </Box>
              </ButtonBase>
            </Box>
          ));
        })}
      </Box>
      <Typography sx={{ mt: "12px", textAlign: "center", fontSize: 11, color: tokens.faint }}>
        区分名をタップすると新規追加、品目をタップすると編集・削除できます
      </Typography>
    </>
  );
}
