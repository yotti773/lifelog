import { db } from "./db";

/**
 * 全レコードを未同期に戻す(Issue #216)。
 *
 * **同期先スプレッドシートを作り直したときに使う。** 新しいシートは空なのに、ローカルのレコードは
 * 前のシートへ送信済み(`synced: true`)のままなので、そのままでは何も送信されず記録が復元されない。
 * ローカルのIndexedDBが真実の情報源なので、全件を未同期に戻して一度フル同期すれば、新しいシートに
 * 同じ内容が再現される。
 *
 * **活動記録(`activityRecords`)は対象外。** Garmin由来の読み取り専用データで、アプリからは
 * 送信しない(シートが真実の情報源。Issue #81)。
 *
 * **削除トゥームストーン(`syncDeletions`)も対象外。** 古いシートの行を消すための指示であり、
 * 新しいシートには最初からその行が無い。持ち越すと、まだ存在しない行を消しにいくだけになる。
 */
export async function markAllRecordsUnsynced(): Promise<void> {
  // Dexieのテーブル型はユニオンにするとmodifyのシグネチャが合わなくなるため、1つずつ書く。
  // **テーブルを増やしたらここにも足すこと**(漏れると、そのテーブルだけ新しいシートに載らない)
  await db.weightRecords.toCollection().modify({ synced: false });
  await db.mealRecords.toCollection().modify({ synced: false });
  await db.waterRecords.toCollection().modify({ synced: false });
  await db.workoutRecords.toCollection().modify({ synced: false });
  await db.diaryRecords.toCollection().modify({ synced: false });
  await db.foodMasterItems.toCollection().modify({ synced: false });
  await db.exerciseMasterItems.toCollection().modify({ synced: false });
  await db.bloodPressureRecords.toCollection().modify({ synced: false });
  await db.bodyMeasurementRecords.toCollection().modify({ synced: false });
  await db.habitMasterItems.toCollection().modify({ synced: false });
  await db.habitRecords.toCollection().modify({ synced: false });
  await db.adviceRecords.toCollection().modify({ synced: false });
  await db.monthlyAdviceRecords.toCollection().modify({ synced: false });
  await db.settings.toCollection().modify({ synced: false });
}
