import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { IconFlame, IconSparkle, IconWarning } from "@/components/icons";
import { updateSettings } from "@/db/settings";
import { getMeasuredTdeeAsOfWeek } from "@/db/weeklyNutrition";
import { daysBetween, todayDateString, weekStartOf } from "@/lib/date";
import {
  ACTIVITY_LEVELS,
  calcBmr,
  calcFormulaTdee,
  suggestCalorieTarget,
  type CalorieTargetSuggestion,
} from "@/lib/nutritionCalc";
import { fontRounded, tokens } from "@/theme";
import type { Settings, Sex, WeightRecord } from "@/types";

export type EditTarget =
  | "weight"
  | "goalDate"
  | "baseline"
  | "calories"
  | "waterGoal"
  | "height"
  | "birthYear"
  | "sex"
  | "activityLevel";

const EDIT_LABELS: Record<EditTarget, string> = {
  weight: "目標体重",
  goalDate: "目標日",
  baseline: "基準日",
  calories: "1日の目標カロリー",
  waterGoal: "1日の目標水分摂取量",
  height: "身長",
  birthYear: "生年",
  sex: "性別",
  activityLevel: "活動レベル",
};

const NUMBER_EDIT_UNITS: Partial<Record<EditTarget, string>> = {
  weight: "kg",
  calories: "kcal",
  waterGoal: "ml",
  height: "cm",
  birthYear: "年",
};

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "male", label: "男性" },
  { value: "female", label: "女性" },
];

function initialDraft(target: EditTarget, settings: Settings): string {
  switch (target) {
    case "weight":
      return String(settings.goalWeightKg);
    case "goalDate":
      return settings.goalDate;
    case "baseline":
      return settings.baselineDate ?? "";
    case "calories":
      return String(settings.dailyCalorieTarget);
    case "waterGoal":
      return settings.dailyWaterTargetMl !== undefined ? String(settings.dailyWaterTargetMl) : "";
    case "height":
      return settings.heightCm !== undefined ? String(settings.heightCm) : "";
    case "birthYear":
      return settings.birthYear !== undefined ? String(settings.birthYear) : "";
    case "sex":
      return settings.sex ?? "";
    case "activityLevel":
      return settings.activityLevel !== undefined ? String(settings.activityLevel) : "";
  }
}

interface ValueEditorDrawerProps {
  /** 編集対象の設定項目。nullならドロワーを閉じる */
  target: EditTarget | null;
  settings: Settings;
  /** 直近の体重記録(目標カロリー自動計算に使用)。null=記録なし */
  latestWeightRecord: WeightRecord | null | undefined;
  onClose: () => void;
  /** 目標カロリーが変わり、PFC目標の再計算を提案すべきときに呼ばれる(Issue #47) */
  onCalorieTargetChanged: () => void;
}

/** 設定画面の単一値編集ボトムシート。数値ステッパー/日付/選択式と、目標カロリーの自動計算パネル(Issue #43)を持つ */
export default function ValueEditorDrawer({ target, onClose, ...contentProps }: ValueEditorDrawerProps) {
  return (
    <Drawer
      anchor="bottom"
      open={target !== null}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: { bgcolor: "background.default", borderRadius: "28px 28px 0 0", p: "12px 20px 30px", mx: "auto", maxWidth: 448, width: "100%" },
        },
      }}
    >
      {/* keyでターゲットごとに再マウントし、入力途中の値が別項目へ持ち越されないようにする */}
      {target && <ValueEditorContent key={target} target={target} onClose={onClose} {...contentProps} />}
    </Drawer>
  );
}

function ValueEditorContent({
  target,
  settings,
  latestWeightRecord,
  onClose,
  onCalorieTargetChanged,
}: ValueEditorDrawerProps & { target: EditTarget }) {
  const [draft, setDraft] = useState(() => initialDraft(target, settings));
  // 目標カロリーの自動計算シート内の提案(提案→確定の2段階。自動では反映しない。Issue #43)
  const [calorieSuggestion, setCalorieSuggestion] = useState<CalorieTargetSuggestion | null>(null);

  const isChoiceEdit = target === "sex" || target === "activityLevel";
  const isNumberEdit =
    target === "weight" ||
    target === "calories" ||
    target === "waterGoal" ||
    target === "height" ||
    target === "birthYear";
  const draftNumber = Number(draft);
  const canSave =
    target === "baseline" ||
    // 目標水分摂取量は「未設定にする」(空欄での保存)を許容する(画面設計書9章)
    (target === "waterGoal"
      ? draft === "" || (!Number.isNaN(draftNumber) && draftNumber > 0)
      : target === "birthYear"
        ? !Number.isNaN(draftNumber) && draftNumber >= 1900 && draftNumber <= new Date().getFullYear()
        : isNumberEdit
          ? draft !== "" && !Number.isNaN(draftNumber) && draftNumber > 0
          : draft !== "");

  const stepDraft = (direction: 1 | -1) => {
    const step =
      target === "weight" ? 0.1 : target === "waterGoal" ? 100 : target === "height" ? 0.5 : target === "birthYear" ? 1 : 50;
    const base = Number.isNaN(draftNumber) ? 0 : draftNumber;
    const next = Math.max(0, base + direction * step);
    setDraft(target === "weight" ? next.toFixed(1) : String(next));
  };

  const handleSaveEdit = async () => {
    if (!canSave) return;
    switch (target) {
      case "weight":
        await updateSettings({ goalWeightKg: draftNumber });
        break;
      case "goalDate":
        await updateSettings({ goalDate: draft });
        break;
      case "baseline":
        await updateSettings({ baselineDate: draft || undefined });
        break;
      case "calories":
        await updateSettings({ dailyCalorieTarget: draftNumber });
        // PFC目標を設定済みなら、目標カロリー変更に合わせた再計算を提案する(自動では上書きしない。Issue #47)
        if (draftNumber !== settings.dailyCalorieTarget && settings.dailyProteinTargetG !== undefined) {
          onCalorieTargetChanged();
        }
        break;
      case "waterGoal":
        await updateSettings({ dailyWaterTargetMl: draft !== "" ? draftNumber : undefined });
        break;
      case "height":
        await updateSettings({ heightCm: draftNumber });
        break;
      case "birthYear":
        await updateSettings({ birthYear: draftNumber });
        break;
      case "sex":
        await updateSettings({ sex: draft as Sex });
        break;
      case "activityLevel":
        await updateSettings({ activityLevel: draftNumber });
        break;
    }
    onClose();
  };

  // 目標カロリーの自動計算(Issue #43)。身体プロフィール・体重記録・残り日数が揃って初めて使える
  const today = todayDateString();
  const hasProfile =
    settings.heightCm !== undefined &&
    settings.birthYear !== undefined &&
    settings.sex !== undefined &&
    settings.activityLevel !== undefined;
  const remainingDays = daysBetween(today, settings.goalDate);
  const calorieAutoCalcHint = !hasProfile
    ? "「あなたのプロフィール」をすべて入力すると自動計算できます"
    : !latestWeightRecord
      ? "体重を記録すると自動計算できます"
      : remainingDays <= 0
        ? "目標日を過ぎているため自動計算できません(目標日を見直してください)"
        : null;

  const handleAutoCalcCalories = async () => {
    if (!hasProfile || !latestWeightRecord || remainingDays <= 0) return;
    const profile = {
      heightCm: settings.heightCm!,
      birthYear: settings.birthYear!,
      sex: settings.sex!,
    };
    const bmrKcal = calcBmr(profile, latestWeightRecord.weightKg, today);
    // 実測TDEE(Issue #44)が得られていれば計算式ベースより実測を優先する(画面設計書9章)
    const measuredTdeeKcal = await getMeasuredTdeeAsOfWeek(weekStartOf(today));
    const suggestion = suggestCalorieTarget({
      bmrKcal,
      tdeeKcal: measuredTdeeKcal ?? calcFormulaTdee(bmrKcal, settings.activityLevel!),
      tdeeSource: measuredTdeeKcal !== null ? "measured" : "formula",
      currentWeightKg: latestWeightRecord.weightKg,
      goalWeightKg: settings.goalWeightKg,
      remainingDays,
    });
    setCalorieSuggestion(suggestion);
  };

  const handleAdoptCalorieSuggestion = async () => {
    if (!calorieSuggestion) return;
    // 「この値を目標にする」が確定操作。ここまで設定値は一切書き換えない(要件定義書4.7章)
    await updateSettings({ dailyCalorieTarget: calorieSuggestion.suggestedKcal });
    if (calorieSuggestion.suggestedKcal !== settings.dailyCalorieTarget && settings.dailyProteinTargetG !== undefined) {
      onCalorieTargetChanged();
    }
    onClose();
  };

  return (
    <>
      <Box sx={{ width: 40, height: 5, borderRadius: "3px", bgcolor: "#E2D8C9", mx: "auto", mb: "18px" }} />
      <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 16, textAlign: "center", mb: "18px" }}>
        {EDIT_LABELS[target]}
      </Typography>
      {isChoiceEdit ? (
        // 性別・活動レベルは選択式(画面設計書9章)。選択中はコーラルの枠で示す
        <Box sx={{ display: "flex", flexDirection: "column", gap: "8px", mb: "18px" }}>
          {(target === "sex"
            ? SEX_OPTIONS
            : ACTIVITY_LEVELS.map((level) => ({ value: String(level.factor), label: level.label }))
          ).map((option) => {
            const active = draft === option.value;
            return (
              <ButtonBase
                key={option.value}
                onClick={() => setDraft(option.value)}
                sx={{
                  p: "13px 16px",
                  borderRadius: "14px",
                  bgcolor: active ? tokens.primarySoft : "background.paper",
                  border: `1.5px solid ${active ? "#FF6B4A" : tokens.border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textAlign: "left",
                }}
              >
                <Typography sx={{ fontSize: 14, fontWeight: active ? 700 : 500 }}>{option.label}</Typography>
                {target === "activityLevel" && (
                  <Typography sx={{ fontFamily: fontRounded, fontSize: 12, color: "text.secondary" }}>
                    ×{option.value}
                  </Typography>
                )}
              </ButtonBase>
            );
          })}
        </Box>
      ) : isNumberEdit ? (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", mb: "18px" }}>
          <IconButton
            onClick={() => stepDraft(-1)}
            sx={{ width: 44, height: 44, bgcolor: "background.paper", boxShadow: tokens.fieldShadow, fontFamily: fontRounded, fontWeight: 700, fontSize: 22, color: "text.primary" }}
          >
            −
          </IconButton>
          <TextField
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            type="text"
            slotProps={{
              htmlInput: {
                inputMode: target === "weight" || target === "height" ? "decimal" : "numeric",
                style: { textAlign: "center", fontFamily: fontRounded, fontWeight: 800, fontSize: 28 },
              },
              input: {
                endAdornment: (
                  <Typography sx={{ fontFamily: fontRounded, color: "text.secondary", fontSize: 14, ml: "4px" }}>
                    {NUMBER_EDIT_UNITS[target]}
                  </Typography>
                ),
              },
            }}
            sx={{ width: 190 }}
          />
          <IconButton
            onClick={() => stepDraft(1)}
            sx={{ width: 44, height: 44, bgcolor: "background.paper", boxShadow: tokens.fieldShadow, fontFamily: fontRounded, fontWeight: 700, fontSize: 22, color: "text.primary" }}
          >
            ＋
          </IconButton>
        </Box>
      ) : (
        <TextField
          type="date"
          fullWidth
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          sx={{ mb: "18px" }}
        />
      )}
      {target === "calories" && (
        // 目標カロリーの自動計算(Issue #43)。計算根拠を行で見せ、確定操作を経て初めて反映する(画面設計書9章)
        <Box sx={{ mb: "18px" }}>
          {calorieSuggestion === null ? (
            <>
              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                onClick={handleAutoCalcCalories}
                disabled={calorieAutoCalcHint !== null}
                startIcon={<IconSparkle />}
                sx={{ height: 44, borderRadius: "13px", fontSize: 13 }}
              >
                プロフィールから自動計算
              </Button>
              {calorieAutoCalcHint && (
                <Typography sx={{ mt: "8px", fontSize: 11, color: "text.secondary", textAlign: "center", lineHeight: 1.6 }}>
                  {calorieAutoCalcHint}
                </Typography>
              )}
            </>
          ) : (
            <Box sx={{ bgcolor: tokens.secondarySoft, borderRadius: "16px", p: "14px 16px" }}>
              {[
                { label: "基礎代謝(Mifflin-St Jeor)", value: `${calorieSuggestion.bmrKcal.toLocaleString()} kcal` },
                {
                  label:
                    calorieSuggestion.tdeeSource === "measured"
                      ? "消費カロリー(実測TDEE)"
                      : `消費カロリー(基礎代謝×${settings.activityLevel})`,
                  value: `${calorieSuggestion.tdeeKcal.toLocaleString()} kcal`,
                },
                {
                  label: `必要ペース(残り${remainingDays}日)`,
                  value: `-${calorieSuggestion.requiredWeeklyLossKg.toFixed(2)} kg/週`,
                },
                { label: "必要日次赤字", value: `${calorieSuggestion.requiredDailyDeficitKcal.toLocaleString()} kcal/日` },
              ].map((row) => (
                <Box key={row.label} sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: "6px" }}>
                  <Typography sx={{ fontSize: 11, color: tokens.secondaryDeep }}>{row.label}</Typography>
                  <Typography sx={{ fontFamily: fontRounded, fontWeight: 700, fontSize: 12, color: tokens.secondaryDeep }}>
                    {row.value}
                  </Typography>
                </Box>
              ))}
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", pt: "8px", borderTop: `1px solid rgba(27,139,128,.18)` }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: "5px", color: tokens.secondaryDeep }}>
                  <IconFlame size={15} />
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: tokens.secondaryDeep }}>提案目標カロリー</Typography>
                </Box>
                <Typography sx={{ fontFamily: fontRounded, fontWeight: 800, fontSize: 20, color: tokens.secondaryDeep }}>
                  {calorieSuggestion.suggestedKcal.toLocaleString()} kcal
                </Typography>
              </Box>
              {calorieSuggestion.clampedToBmr && (
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: "6px", mt: "10px", bgcolor: tokens.warnBg, borderRadius: "10px", p: "8px 10px" }}>
                  <Box sx={{ color: tokens.warnIcon, display: "flex", mt: "1px" }}>
                    <IconWarning size={13} />
                  </Box>
                  <Typography sx={{ fontSize: 11, color: tokens.warnText, lineHeight: 1.5 }}>
                    計算上の値が基礎代謝を下回るため、基礎代謝を下限として提案しています
                  </Typography>
                </Box>
              )}
              {calorieSuggestion.paceTooFast && (
                <Box sx={{ display: "flex", alignItems: "flex-start", gap: "6px", mt: "10px", bgcolor: tokens.errorBg, borderRadius: "10px", p: "8px 10px" }}>
                  <Box sx={{ color: tokens.errorText, display: "flex", mt: "1px" }}>
                    <IconWarning size={13} />
                  </Box>
                  <Typography sx={{ fontSize: 11, color: tokens.errorText, lineHeight: 1.5 }}>
                    必要ペースが週あたり体重の1%を超えています。目標日または目標体重の見直しをおすすめします
                  </Typography>
                </Box>
              )}
              <Button
                fullWidth
                variant="contained"
                color="secondary"
                onClick={handleAdoptCalorieSuggestion}
                sx={{ mt: "12px", height: 44, borderRadius: "13px", fontSize: 13, boxShadow: tokens.secondaryButtonShadow }}
              >
                この値を目標にする
              </Button>
            </Box>
          )}
        </Box>
      )}
      {target === "baseline" && (
        <>
          <Typography sx={{ fontSize: 11, color: "text.secondary", mb: "12px", textAlign: "center" }}>
            未設定の場合、一番古い体重記録を起点にします
          </Typography>
          {draft && (
            <Button
              fullWidth
              variant="text"
              onClick={() => setDraft("")}
              sx={{ mb: "6px", color: "text.secondary" }}
            >
              未設定にする
            </Button>
          )}
        </>
      )}
      {target === "waterGoal" && (
        <>
          <Typography sx={{ fontSize: 11, color: "text.secondary", mb: "12px", textAlign: "center" }}>
            未設定の間はホーム・水分記録画面で合計mlのみ表示します
          </Typography>
          {draft && (
            <Button
              fullWidth
              variant="text"
              onClick={() => setDraft("")}
              sx={{ mb: "6px", color: "text.secondary" }}
            >
              未設定にする
            </Button>
          )}
        </>
      )}
      <Button
        fullWidth
        variant="contained"
        onClick={handleSaveEdit}
        disabled={!canSave}
        sx={{ height: 50, borderRadius: "14px", fontSize: 15, boxShadow: tokens.primaryButtonShadow }}
      >
        保存する
      </Button>
      <Button fullWidth variant="text" onClick={onClose} sx={{ mt: "6px", color: "text.secondary" }}>
        キャンセル
      </Button>
    </>
  );
}
