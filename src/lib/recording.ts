import { addDaysToDateString } from "./date";

/**
 * 記録率・連続記録日数(Issue #46。要件定義書4.7.4章)。
 * 「記録した日」= その日に食事記録が1件以上、または体重記録がある日。
 * 日付はすべてローカル日付(YYYY-MM-DD)基準(UTC日付基準にしない — Issue #23の教訓)。
 */

/** 体重記録の日付と食事記録のローカル日付から「記録した日」の集合を作る */
export function buildRecordedDateSet(weightDates: Iterable<string>, mealDates: Iterable<string>): Set<string> {
  const recorded = new Set<string>();
  for (const date of weightDates) recorded.add(date);
  for (const date of mealDates) recorded.add(date);
  return recorded;
}

/**
 * 指定日で終わる連続記録日数(その日を含めて過去へさかのぼる)。
 * **その日が未記録なら0** — 過去日を振り返るとき(Issue #226)は「その日時点で何日続いていたか」を
 * そのまま出すため、未記録の日に前日までの連続日数を出さない。
 */
export function streakDaysEndingOn(recordedDates: ReadonlySet<string>, date: string): number {
  let cursor = date;
  let streak = 0;
  while (recordedDates.has(cursor)) {
    streak += 1;
    cursor = addDaysToDateString(cursor, -1);
  }
  return streak;
}

/**
 * 今日時点の連続記録日数。
 * 「切れた」判定に当日は含めない: 今日まだ記録していなくても、昨日まで連続していれば継続中として数える。
 * この猶予は**当日にだけ認める** — 過去日にはstreakDaysEndingOn()を使う(Issue #226)。
 */
export function currentStreakDays(recordedDates: ReadonlySet<string>, today: string): number {
  // 起点は今日(記録済みなら)または昨日。どちらも未記録なら連続は切れている
  const from = recordedDates.has(today) ? today : addDaysToDateString(today, -1);
  return streakDaysEndingOn(recordedDates, from);
}

/** 指定範囲(両端含む)の「記録した日」の数。週次レビューの記録率(◯/7日)に使う */
export function countRecordedDaysInRange(
  recordedDates: ReadonlySet<string>,
  startDate: string,
  endDate: string,
): number {
  let count = 0;
  for (let date = startDate; date <= endDate; date = addDaysToDateString(date, 1)) {
    if (recordedDates.has(date)) count += 1;
  }
  return count;
}
