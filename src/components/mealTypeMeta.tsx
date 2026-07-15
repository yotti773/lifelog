import { IconBreakfast, IconDinner, IconLunch, IconSnack } from "@/components/icons";
import { tokens } from "@/theme";
import type { MealType } from "@/types";

/** 区分ごとのラベル・アイコン・アイコンチップ配色。ホーム・履歴・記録画面で共有する(Issue #126) */
export const MEAL_TYPE_META: Record<
  MealType,
  { label: string; Icon: typeof IconBreakfast; iconBg: string; iconColor: string }
> = {
  breakfast: { label: "朝食", Icon: IconBreakfast, iconBg: tokens.breakfastBg, iconColor: tokens.warnIcon },
  lunch: { label: "昼食", Icon: IconLunch, iconBg: "#FFE6DE", iconColor: "#FF6B4A" },
  dinner: { label: "夕食", Icon: IconDinner, iconBg: tokens.secondarySoft, iconColor: "#2EC4B6" },
  snack: { label: "間食", Icon: IconSnack, iconBg: tokens.warnBg, iconColor: tokens.warnText },
};

/** 区分の表示順(朝→昼→夕→間食) */
export const MEAL_TYPE_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const MEAL_TYPES = new Set<string>(MEAL_TYPE_ORDER);
export function isMealType(value: string | null | undefined): value is MealType {
  return value != null && MEAL_TYPES.has(value);
}
