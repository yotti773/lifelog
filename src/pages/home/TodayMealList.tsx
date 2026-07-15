import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { IconChevronRight } from "@/components/icons";
import { MEAL_TYPE_META, MEAL_TYPE_ORDER } from "@/components/mealTypeMeta";
import { fontRounded, tokens } from "@/theme";
import type { MealRecord, MealType } from "@/types";

interface TodayMealListProps {
  /** 今日の食事記録(時刻昇順) */
  meals: MealRecord[];
  totalKcal: number;
}

/**
 * ホーム画面の「今日の食事」セクション。区分ごとに1つの入り口を出し、
 * 記録済みは品数・料理名プレビュー・区分合計を表示する。タップでその区分の記録画面へ(Issue #126)
 */
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
        {MEAL_TYPE_ORDER.map((mealType) => {
          const { label, Icon, iconBg, iconColor } = MEAL_TYPE_META[mealType];
          const items = mealsByType.get(mealType);
          const openMeal = () => navigate(`/record/meal?type=${mealType}`);

          if (!items) {
            return (
              <ButtonBase
                key={mealType}
                onClick={openMeal}
                aria-label={`${label}を記録する`}
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

          const kcal = items.reduce((sum, item) => sum + item.confirmedKcal, 0);
          const names = items.map((item) => item.confirmedName).join("、");
          const hasUnsynced = items.some((item) => !item.synced);

          return (
            <ButtonBase
              key={mealType}
              onClick={openMeal}
              aria-label={`${label}を編集する`}
              sx={{
                bgcolor: "background.paper",
                borderRadius: "18px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                p: "13px 15px",
                textAlign: "left",
                boxShadow: tokens.rowCardShadow,
              }}
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
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: "7px", mb: "2px" }}>
                  <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13 }}>{label}</Typography>
                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: "primary.main", bgcolor: tokens.primarySoft, px: "7px", borderRadius: "7px" }}>
                    {items.length}品
                  </Typography>
                  {hasUnsynced && (
                    <Typography sx={{ fontSize: 9, fontWeight: 500, color: tokens.warnText, bgcolor: tokens.warnBg, px: "6px", py: "2px", borderRadius: "6px" }}>
                      未同期
                    </Typography>
                  )}
                </Box>
                <Typography sx={{ fontSize: 12, color: "text.secondary", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {names}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                <Typography component="span" sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>
                  {kcal.toLocaleString()}
                </Typography>
                <Typography component="span" sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 10, color: "text.secondary", ml: "2px" }}>
                  kcal
                </Typography>
              </Box>
              <Box sx={{ color: "text.primary", opacity: 0.35, display: "flex", flexShrink: 0 }}>
                <IconChevronRight size={13} />
              </Box>
            </ButtonBase>
          );
        })}
      </Box>
      <Typography sx={{ mt: "12px", textAlign: "center", fontSize: 11, color: tokens.faint }}>
        区分をタップすると、その食事の記録・編集ができます
      </Typography>
    </>
  );
}
