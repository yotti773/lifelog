import { db } from "./db";
import { formatDate } from "@/lib/date";
import { buildRecordedDateSet } from "@/lib/recording";

/**
 * 全期間の「記録した日」(食事1件以上または体重記録あり)の集合(Issue #46)。
 * 全件走査だが単一ユーザー・1日数件の規模では十分軽い(getUnsynced系と同じ判断。CLAUDE.md参照)。
 */
export async function getRecordedDateSet(): Promise<Set<string>> {
  const [weightDates, mealTimestamps] = await Promise.all([
    db.weightRecords.toCollection().primaryKeys(),
    db.mealRecords.orderBy("timestamp").keys(),
  ]);
  const mealDates = (mealTimestamps as string[]).map((timestamp) => formatDate(new Date(timestamp)));
  return buildRecordedDateSet(weightDates as string[], mealDates);
}
