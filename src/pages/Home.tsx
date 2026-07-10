import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import CalorieCard from "@/components/CalorieCard";
import { moodLabel } from "@/components/MoodIcon";
import {
  IconArrow,
  IconBarbell,
  IconBreakfast,
  IconChevronRight,
  IconDiary,
  IconDinner,
  IconDrop,
  IconLunch,
  IconSnack,
} from "@/components/icons";
import { db } from "@/db/db";
import { getDiaryRecord } from "@/db/diaryRecords";
import { getRecordedDateSet } from "@/db/recordedDays";
import { getSettings } from "@/db/settings";
import { getWaterRecordsForDate } from "@/db/waterRecords";
import { getWorkoutRecordsForDate } from "@/db/workoutRecords";
import { formatTime, localDateRangeToUtcIso, todayDateString } from "@/lib/date";
import { currentStreakDays } from "@/lib/recording";
import { fontRounded, tokens } from "@/theme";
import type { MealRecord, MealType } from "@/types";

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

/** 前回比チップ(体重/体脂肪率カードで共通の見た目)。diffが正=増加、負以下=減少として色分けする */
function DiffChip({ diff, unit }: { diff: number; unit: string }) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        bgcolor: diff <= 0 ? tokens.secondarySoft : tokens.primarySoft,
        color: diff <= 0 ? "secondary.main" : "primary.main",
        px: "8px",
        py: "4px",
        borderRadius: "20px",
      }}
    >
      <IconArrow up={diff > 0} />
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 12 }}>
        前回比 {Math.abs(diff).toFixed(1)}
        {unit}
      </Typography>
    </Box>
  );
}

export default function Home() {
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
  const waterRecords = useLiveQuery(() => getWaterRecordsForDate(today), [today]);
  // 「未記録」に正当に解決しうるクエリはnullに正規化する(undefined=ロード中と区別するため。Trends.tsx参照)
  const diary = useLiveQuery(() => getDiaryRecord(today).then((v) => v ?? null), [today]);
  const workoutRecords = useLiveQuery(() => getWorkoutRecordsForDate(today), [today]);
  // 連続記録日数(Issue #46)。常時表示のためaccent色は使わない(デザインガイドの制約)
  const streakDays = useLiveQuery(
    async () => currentStreakDays(await getRecordedDateSet(), today),
    [today],
  );

  if (
    meals === undefined ||
    settings === undefined ||
    waterRecords === undefined ||
    diary === undefined ||
    workoutRecords === undefined
  ) {
    return <Typography sx={{ p: 3, textAlign: "center", fontSize: 14, color: "text.secondary" }}>読み込み中...</Typography>;
  }

  const mealsByType = new Map<MealType, MealRecord[]>();
  for (const meal of meals) {
    const list = mealsByType.get(meal.mealType) ?? [];
    list.push(meal);
    mealsByType.set(meal.mealType, list);
  }

  const totalKcal = meals.reduce((sum, meal) => sum + meal.confirmedKcal, 0);
  // PFCは手入力で小数値を取りうるため、合算時の浮動小数点誤差(例: 17.900000000000002)を丸めて吸収する
  const totalProteinG = Math.round(meals.reduce((sum, meal) => sum + meal.confirmedProteinG, 0) * 10) / 10;
  const totalFatG = Math.round(meals.reduce((sum, meal) => sum + meal.confirmedFatG, 0) * 10) / 10;
  const totalCarbsG = Math.round(meals.reduce((sum, meal) => sum + meal.confirmedCarbsG, 0) * 10) / 10;

  const now = new Date();
  const weightDiff = weight && previousWeight ? weight.weightKg - previousWeight.weightKg : null;
  const bodyFatDiff =
    weight?.bodyFatPercent !== undefined && previousWeight?.bodyFatPercent !== undefined
      ? weight.bodyFatPercent - previousWeight.bodyFatPercent
      : null;

  const goToWeightRecord = () => navigate(`/record/weight?date=${today}`);

  // その他の記録(水分・日記・筋トレ)のサマリー(画面設計書2章)
  const waterTotalMl = waterRecords.reduce((sum, record) => sum + record.amountMl, 0);
  const waterTargetMl = settings.dailyWaterTargetMl;
  const waterProgress = waterTargetMl ? Math.max(0, Math.min(100, (waterTotalMl / waterTargetMl) * 100)) : 0;
  const workoutExerciseCount = new Set(workoutRecords.map((record) => record.exerciseOrder)).size;

  return (
    <Box sx={{ mx: "auto", maxWidth: 448, px: "20px", pt: "24px", pb: "130px" }}>
      {/* ヘッダー */}
      <Box sx={{ mb: "20px" }}>
        <Typography sx={{ fontSize: 13, fontWeight: 500, color: "text.secondary", mb: "3px" }}>
          {greeting(now.getHours())}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 22, letterSpacing: ".01em" }}>
            {now.getMonth() + 1}月{now.getDate()}日
            <Box component="span" sx={{ fontSize: 15, color: "text.secondary", ml: "6px", fontWeight: 500 }}>
              {WEEKDAY_LABELS[now.getDay()]}曜日
            </Box>
          </Typography>
          {streakDays !== undefined && streakDays > 0 && (
            <Typography
              sx={{
                fontFamily: fontRounded,
                fontWeight: 700,
                fontSize: 11,
                color: tokens.secondaryDeep,
                bgcolor: tokens.secondarySoft,
                px: "10px",
                py: "5px",
                borderRadius: "20px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              連続{streakDays}日記録中
            </Typography>
          )}
        </Box>
      </Box>

      {/* カロリーカード */}
      <Box sx={{ mb: "14px" }}>
        <CalorieCard
          consumedKcal={totalKcal}
          targetKcal={settings.dailyCalorieTarget}
          proteinG={totalProteinG}
          fatG={totalFatG}
          carbsG={totalCarbsG}
          pfcTargets={
            settings.dailyProteinTargetG !== undefined &&
            settings.dailyFatTargetG !== undefined &&
            settings.dailyCarbsTargetG !== undefined
              ? {
                  proteinG: settings.dailyProteinTargetG,
                  fatG: settings.dailyFatTargetG,
                  carbsG: settings.dailyCarbsTargetG,
                }
              : null
          }
        />
      </Box>

      {/* 体重・体脂肪率カード(タップで体重記録画面へ。当日分の記録があれば編集、なければ新規入力) */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: "14px", mb: "22px" }}>
        <ButtonBase onClick={goToWeightRecord} sx={{ display: "block", textAlign: "left", borderRadius: "22px" }}>
          <Card sx={{ p: "18px", width: "100%" }}>
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
                {weightDiff !== null && <DiffChip diff={weightDiff} unit="kg" />}
              </>
            ) : (
              <Typography sx={{ fontSize: 13, color: tokens.faint }}>未記録</Typography>
            )}
          </Card>
        </ButtonBase>
        <ButtonBase onClick={goToWeightRecord} sx={{ display: "block", textAlign: "left", borderRadius: "22px" }}>
          <Card sx={{ p: "18px", width: "100%" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 500, color: "text.secondary", mb: "10px" }}>体脂肪率</Typography>
            {weight?.bodyFatPercent !== undefined ? (
              <>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: "4px", mb: "8px" }}>
                  <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 34, lineHeight: 1 }}>
                    {weight.bodyFatPercent}
                  </Typography>
                  <Typography sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 14, color: "text.secondary" }}>%</Typography>
                </Box>
                {bodyFatDiff !== null ? (
                  <DiffChip diff={bodyFatDiff} unit="%" />
                ) : (
                  <Typography sx={{ fontSize: 11, color: tokens.faint }}>体組成計より</Typography>
                )}
              </>
            ) : (
              <Typography sx={{ fontSize: 13, color: tokens.faint }}>未計測</Typography>
            )}
          </Card>
        </ButtonBase>
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

      {/* その他の記録(水分・日記・筋トレ。画面設計書2章) */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", m: "24px 0 12px", px: "2px" }}>
        <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>その他の記録</Typography>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* 水分: 合計+進捗バー、タップで水分記録画面へ */}
        <ButtonBase
          onClick={() => navigate("/record/water")}
          sx={{
            bgcolor: "background.paper",
            borderRadius: "18px",
            boxShadow: tokens.rowCardShadow,
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
              bgcolor: tokens.waterSoft,
              color: tokens.waterMain,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconDrop size={21} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: waterTargetMl ? "5px" : 0 }}>
              水分
            </Typography>
            {waterTargetMl && (
              <Box sx={{ height: 6, bgcolor: tokens.track, borderRadius: "6px", overflow: "hidden" }}>
                <Box
                  sx={{
                    height: "100%",
                    width: `${waterProgress}%`,
                    bgcolor: tokens.waterMain,
                    borderRadius: "6px",
                    transition: "width .4s",
                  }}
                />
              </Box>
            )}
          </Box>
          <Box sx={{ textAlign: "right", flexShrink: 0 }}>
            <Typography component="span" sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16 }}>
              {waterTotalMl.toLocaleString()}
            </Typography>
            <Typography component="span" sx={{ fontFamily: fontRounded, fontWeight: 500, fontSize: 10, color: "text.secondary", ml: "2px" }}>
              {waterTargetMl ? `/ ${waterTargetMl.toLocaleString()}ml` : "ml"}
            </Typography>
          </Box>
          <Box sx={{ color: "text.primary", opacity: 0.35, display: "flex", flexShrink: 0 }}>
            <IconChevronRight size={13} />
          </Box>
        </ButtonBase>

        {/* 日記: 気分タグ+本文プレビュー、タップで日記画面へ */}
        <ButtonBase
          onClick={() => navigate("/record/diary")}
          sx={{
            bgcolor: "background.paper",
            borderRadius: "18px",
            boxShadow: tokens.rowCardShadow,
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
              bgcolor: tokens.warnBg,
              color: tokens.warnIcon,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconDiary size={21} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "7px", mb: "2px" }}>
              <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13 }}>日記</Typography>
              {diary?.mood && (
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
                  {moodLabel(diary.mood)}
                </Typography>
              )}
            </Box>
            <Typography
              sx={{
                fontSize: 12,
                color: diary?.text ? "text.secondary" : tokens.faint,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {diary?.text ? diary.text : "未記録"}
            </Typography>
          </Box>
          <Box sx={{ color: "text.primary", opacity: 0.35, display: "flex", flexShrink: 0 }}>
            <IconChevronRight size={13} />
          </Box>
        </ButtonBase>

        {/* 筋トレ: 当日サマリー(◯種目・◯セット)、タップで筋トレ記録画面へ */}
        <ButtonBase
          onClick={() => navigate("/record/strength")}
          sx={{
            bgcolor: "background.paper",
            borderRadius: "18px",
            boxShadow: tokens.rowCardShadow,
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
              bgcolor: tokens.strengthBg,
              color: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconBarbell size={21} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 13, mb: "2px" }}>筋トレ</Typography>
            <Typography
              sx={{
                fontSize: 12,
                color: workoutRecords.length > 0 ? "text.secondary" : tokens.faint,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {workoutRecords.length > 0 ? `${workoutExerciseCount}種目・${workoutRecords.length}セット` : "未記録"}
            </Typography>
          </Box>
          <Box sx={{ color: "text.primary", opacity: 0.35, display: "flex", flexShrink: 0 }}>
            <IconChevronRight size={13} />
          </Box>
        </ButtonBase>
      </Box>
    </Box>
  );
}
