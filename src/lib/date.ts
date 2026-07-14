import type { MealType } from "@/types";

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

/**
 * ローカル日付(YYYY-MM-DD)の00:00:00.000〜23:59:59.999を、その境界のUTC ISO文字列(開始・終了)に変換する。
 * MealRecord.timestampはUTCのISO文字列で保存されているため、ローカル日付基準で範囲を絞り込むにはUTC境界へ変換する必要がある。
 */
export function localDateRangeToUtcIso(date: string): [string, string] {
  return [new Date(`${date}T00:00:00`).toISOString(), new Date(`${date}T23:59:59.999`).toISOString()];
}

/** 指定日数分さかのぼった日付(YYYY-MM-DD)を今日を含めて返す(例: days=6なら直近7日間) */
export function dateStringDaysAgo(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return formatDate(d);
}

/** YYYY-MM-DDにdays日を加えた日付(YYYY-MM-DD)を返す(負数で過去方向) */
export function addDaysToDateString(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/** 2つのYYYY-MM-DDの日数差(end − start)。ローカル日付の0時基準 */
export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();
  return Math.round((end - start) / 86_400_000);
}

/** その日が属する週の開始日(月曜、YYYY-MM-DD)を返す。週の定義は月曜〜日曜(画面設計書8.2章) */
export function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  // getDay(): 日曜=0。月曜起点のオフセットに変換する(月曜=0、日曜=6)
  const offset = (d.getDay() + 6) % 7;
  return addDaysToDateString(date, -offset);
}

/**
 * 週(月曜起点)が属する月(YYYY-MM)を返す。月次レビュー(Issue #114)の月の定義は
 * 「その月に週の終わり(日曜)が含まれる週の集合」— 暦月は月曜始まりの週と端が揃わないため、
 * 週を分割せず日曜の属する月へ丸ごと割り当てる。これにより全ての週がちょうど1つの月に属する。
 */
export function monthKeyOfWeek(weekStart: string): string {
  return addDaysToDateString(weekStart, 6).slice(0, 7);
}

/**
 * 月(YYYY-MM)に属する週の開始日(月曜)の一覧を昇順で返す(4〜5週)。
 * 月初の日を含む週の日曜は必ずその月の1〜7日に落ちるため、先頭は常にweekStartOf(月初)。
 */
export function weekStartsOfMonth(monthKey: string): string[] {
  const weekStarts: string[] = [];
  let weekStart = weekStartOf(`${monthKey}-01`);
  while (monthKeyOfWeek(weekStart) === monthKey) {
    weekStarts.push(weekStart);
    weekStart = addDaysToDateString(weekStart, 7);
  }
  return weekStarts;
}

/** YYYY-MMにmonthsか月を加えた月(YYYY-MM)を返す(負数で過去方向) */
export function addMonthsToMonthKey(monthKey: string, months: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month - 1 + months, 1);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}`;
}

/** YYYY-MM形式の月文字列を「YYYY年M月」に変換する(月次レビューの見出し表示用) */
export function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${year}年${Number(month)}月`;
}

/** YYYY-MM-DD形式の日付文字列をM/D形式(例: 7/1)に変換する。グラフのX軸ラベルや履歴一覧の日付表示で共通利用する */
export function formatMonthDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
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
