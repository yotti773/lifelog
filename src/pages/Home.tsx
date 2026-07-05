import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import CalorieCard from "../components/CalorieCard";
import { IconArrow, IconBreakfast, IconChevronRight, IconDinner, IconLunch, IconPlus, IconSnack } from "../components/icons";
import { db } from "../db/db";
import { getSettings } from "../db/settings";
import { formatTime, localDateRangeToUtcIso, todayDateString } from "../lib/date";
import { fontRounded, tokens } from "../theme";
import type { MealRecord, MealType } from "../types";

const MEAL_STYLES: Record<MealType, { label: string; Icon: typeof IconBreakfast; iconBg: string; iconColor: string }> = {
  breakfast: { label: "朝食", Icon: IconBreakfast, iconBg: tokens.breakfastBg, iconColor: tokens.warnIcon },
  lunch: { label: "昼食", Icon: IconLunch, iconBg: "#FFE6DE", iconColor: "#FF6B4A" },
  dinner: { label: "夕食", Icon: IconDinner, iconBg: tokens.secondarySoft, iconColor: "#2EC4B6" },
  snack: { label: "間食", Icon: IconSnack, iconBg: tokens.warnBg, iconColor: tokens.warnText },
};
const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function greeting(hour: number): string {
  if (hour < 11) return "おはよう、今日も記録しよう";
  if (hour < 18) return "こんにちは、今日も記録しよう";
  return "こんばんは、今日も記録しよう";
}

interface HomeProps {
  onOpenActionSheet: () => void;
}

export default function Home({ onOpenActionSheet }: HomeProps) {
  const navigate = useNavigate();
  const today = todayDateString();

  const weight = useLiveQuery(() => db.weightRecords.get(today), [today]);
  // 前回比の基準になる、今日より前の直近の記録。「未解決」と「記録なし」を区別するためnullに正規化する
  const previousWeight = useLiveQuery(
    () => db.weightRecords.where("date").below(today).last().then((v) => v ?? null),
    [today],
  );
  const [todayStartIso, todayEndIso] = localDateRangeToUtcIso(today);
  const meals = useLiveQuery(
    () =>
      db.mealRecords
        .where("timestamp")
        .between(todayStartIso, todayEndIso, true, true)
        .sortBy("timestamp"),
    [todayStartIso, todayEndIso],
  );
  const settings = useLiveQuery(() => getSettings(), []);

  if (meals === undefined || settings === undefined) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  const mealsByType = new Map<MealType, MealRecord[]>();
  for (const meal of meals) {
    const list = mealsByType.get(meal.mealType) ?? [];
    list.push(meal);
    mealsByType.set(meal.mealType, list);
  }

  const totalKcal = meals.reduce((sum, meal) => sum + meal.confirmedKcal, 0);
  const totalProteinG = meals.reduce((sum, meal) => sum + meal.confirmedProteinG, 0);
  const totalFatG = meals.reduce((sum, meal) => sum + meal.confirmedFatG, 0);
  const totalCarbsG = meals.reduce((sum, meal) => sum + meal.confirmedCarbsG, 0);

  const now = new Date();
  const weightDiff = weight && previousWeight ? weight.weightKg - previousWeight.weightKg : null;

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "24px", pb: "130px" }}>
      {/* ヘッダー */}
      <Box sx={{ mb: "20px" }}>
        <Typography sx={{ fontSize: 13, fontWeight: 500, color: "text.secondary", mb: "3px" }}>
          {greeting(now.getHours())}
        </Typography>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 22, letterSpacing: ".01em" }}>
          {now.getMonth() + 1}月{now.getDate()}日
          <Box component="span" sx={{ fontSize: 15, color: "text.secondary", ml: "6px", fontWeight: 500 }}>
            {WEEKDAY_LABELS[now.getDay()]}曜日
          </Box>
        </Typography>
      </Box>

      {/* カロリーカード */}
      <Box sx={{ mb: "14px" }}>
        <CalorieCard
          consumedKcal={totalKcal}
          targetKcal={settings.dailyCalorieTarget}
          proteinG={totalProteinG}
          fatG={totalFatG}
          carbsG={totalCarbsG}
        />
      </Box>

      {/* 体重・体脂肪率カード */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: "14px", mb: "22px" }}>
        <Card sx={{ p: "18px" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "10px" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 500, color: "text.secondary" }}>体重</Typography>
            {weight && <Typography sx={{ fontSize: 11, color: tokens.faint }}>{formatTime(weight.timestamp)}</Typography>}
          </Box>
          {weight ? (
            <>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: "4px", mb: "8px" }}>
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 34, lineHeight: 1 }}>
                  {weight.weightKg}
                </Typography>
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 14, color: "text.secondary" }}>kg</Typography>
              </Box>
              {weightDiff !== null && (
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    bgcolor: weightDiff <= 0 ? tokens.secondarySoft : tokens.primarySoft,
                    color: weightDiff <= 0 ? "secondary.main" : "primary.main",
                    px: "8px",
                    py: "4px",
                    borderRadius: "20px",
                  }}
                >
                  <IconArrow up={weightDiff > 0} />
                  <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 12 }}>
                    前回比 {Math.abs(weightDiff).toFixed(1)}kg
                  </Typography>
                </Box>
              )}
            </>
          ) : (
            <Typography sx={{ fontSize: 13, color: tokens.faint }}>未記録</Typography>
          )}
        </Card>
        <Card sx={{ p: "18px" }}>
          <Typography sx={{ fontSize: 13, fontWeight: 500, color: "text.secondary", mb: "10px" }}>体脂肪率</Typography>
          {weight?.bodyFatPercent !== undefined ? (
            <>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: "4px", mb: "8px" }}>
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 34, lineHeight: 1 }}>
                  {weight.bodyFatPercent}
                </Typography>
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 14, color: "text.secondary" }}>%</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: tokens.faint }}>体組成計より</Typography>
            </>
          ) : (
            <Typography sx={{ fontSize: 13, color: tokens.faint }}>未計測</Typography>
          )}
        </Card>
      </Box>

      {/* 今日の食事 */}
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

          if (!items) {
            return (
              <ButtonBase
                key={mealType}
                onClick={onOpenActionSheet}
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
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    bgcolor: tokens.primarySoft,
                    color: "primary.main",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <IconPlus size={13} />
                </Box>
              </ButtonBase>
            );
          }

          return items.map((item, index) => (
            <ButtonBase
              key={item.id}
              onClick={() => navigate(`/record/meal?id=${item.id}`)}
              sx={{
                bgcolor: "background.paper",
                borderRadius: "18px",
                p: "14px 15px",
                display: "flex",
                alignItems: "center",
                gap: "13px",
                boxShadow: tokens.rowCardShadow,
                textAlign: "left",
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
                  <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13 }}>
                    {label}
                    {items.length > 1 ? ` ${index + 1}` : ""}
                  </Typography>
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
          ));
        })}
      </Box>
      <Typography sx={{ mt: "12px", textAlign: "center", fontSize: 11, color: tokens.faint }}>
        品目をタップすると編集・削除できます
      </Typography>
    </Box>
  );
}
