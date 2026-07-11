import { db } from "./db";
import { addDaysToDateString } from "@/lib/date";
import type { ActivityRecord } from "@/types";

/** 推移グラフ用の日別活動データ(Issue #82)。記録・計測が無い日は0 */
export interface DailyActivityTotal {
  date: string; // YYYY-MM-DD
  steps: number;
  sleepMinutes: number;
}

/**
 * シート取り込みで受け取った活動記録をまとめて保存する(Issue #81)。
 * 他の記録と違い「追加のみ・ローカル優先」ではなく常に上書き(bulkPut)する —
 * 真実の情報源はGarmin側で、アプリ内に編集がないため競合が存在しないうえ、
 * Garminのバックフィルによる過去日の値の訂正を反映できる必要があるため。
 */
export async function bulkSaveActivityRecords(records: ActivityRecord[]): Promise<void> {
  await db.activityRecords.bulkPut(records);
}

/** 履歴確認画面用に全記録を新しい順(日付降順)で返す */
export async function getAllActivityRecordsDesc(): Promise<ActivityRecord[]> {
  return db.activityRecords.orderBy("date").reverse().toArray();
}

/** 指定期間(両端含む)の活動記録を日付昇順で返す(週次レビュー・推移グラフ用。Issue #82) */
export async function getActivityRecordsByDateRange(
  startDate: string,
  endDate: string,
): Promise<ActivityRecord[]> {
  return db.activityRecords.where("date").between(startDate, endDate, true, true).sortBy("date");
}

/**
 * 指定期間の日別歩数・睡眠時間を返す(推移グラフ用。Issue #82)。
 * 記録が無い日も0で埋める — グラフが空白日を圧縮した線ではなく隙間として表示するため
 * (getDailyCalorieTotalsと同じ考え方)
 */
export async function getDailyActivityTotals(
  startDate: string,
  endDate: string,
): Promise<DailyActivityTotal[]> {
  const records = await getActivityRecordsByDateRange(startDate, endDate);
  const byDate = new Map(records.map((r) => [r.date, r]));
  const days: DailyActivityTotal[] = [];
  for (let date = startDate; date <= endDate; date = addDaysToDateString(date, 1)) {
    const record = byDate.get(date);
    days.push({ date, steps: record?.steps ?? 0, sleepMinutes: record?.sleepMinutes ?? 0 });
  }
  return days;
}
