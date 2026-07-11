import { formatDate } from "./date";

/**
 * timestampを持つレコード群を日別に合計し、startDate〜endDate(両端含む)の全日を0埋めで返す(Issue #59)。
 * 記録の無い日をグラフ上で隙間(0)として見せるカロリー/水分推移の共通前提(CLAUDE.mdのデータ層の注記を参照)
 */
export function sumDailyTotals<T>(
  records: T[],
  startDate: string,
  endDate: string,
  getTimestamp: (record: T) => string,
  getValue: (record: T) => number,
): { date: string; total: number }[] {
  const totalsByDate = new Map<string, number>();
  for (const record of records) {
    const date = formatDate(new Date(getTimestamp(record)));
    totalsByDate.set(date, (totalsByDate.get(date) ?? 0) + getValue(record));
  }

  const totals: { date: string; total: number }[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cursor <= end) {
    const date = formatDate(cursor);
    totals.push({ date, total: totalsByDate.get(date) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return totals;
}
