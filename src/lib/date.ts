import type { MealType } from "../types";

export function todayDateString(): string {
  return formatDate(new Date());
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
}

/** <input type="datetime-local">用のローカル時刻文字列(YYYY-MM-DDTHH:mm)に変換する */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  const h = `${d.getHours()}`.padStart(2, "0");
  const mi = `${d.getMinutes()}`.padStart(2, "0");
  return `${y}-${mo}-${day}T${h}:${mi}`;
}

/** M/D HH:mm形式(例: 7/1 21:40)。設定画面の最終同期日時表示などに使う */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${formatTime(iso)}`;
}

/** 指定日数分さかのぼった日付(YYYY-MM-DD)を今日を含めて返す(例: days=6なら直近7日間) */
export function dateStringDaysAgo(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return formatDate(d);
}

const MEAL_TYPE_HOUR: Record<MealType, number> = {
  breakfast: 7,
  lunch: 12,
  dinner: 19,
  snack: 15,
};

/** 現在時刻から一番近い食事区分を返す(画面設計書3-2の初期選択ロジック) */
export function nearestMealType(date: Date = new Date()): MealType {
  const hour = date.getHours() + date.getMinutes() / 60;
  let best: MealType = "breakfast";
  let bestDiff = Infinity;
  for (const [type, targetHour] of Object.entries(MEAL_TYPE_HOUR) as [MealType, number][]) {
    const diff = Math.min(Math.abs(hour - targetHour), 24 - Math.abs(hour - targetHour));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = type;
    }
  }
  return best;
}
