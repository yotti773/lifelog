import { db } from "./db";
import type { ActivityRecord } from "@/types";

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
