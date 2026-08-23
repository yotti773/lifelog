import Dexie, { type EntityTable } from "dexie";
import type {
  ActivityRecord,
  AdviceRecord,
  BloodPressureRecord,
  BodyMeasurementRecord,
  DiaryRecord,
  ExerciseMasterItem,
  FoodMasterItem,
  HabitMasterItem,
  HabitRecord,
  MealRecord,
  MonthlyAdviceRecord,
  Settings,
  SyncDeletion,
  WaterRecord,
  WeightRecord,
  WorkoutRecord,
} from "@/types";

/**
 * `synced` は設定のシート同期用(Issue #164)。`Settings` 側には持たせない —
 * 画面が読む設定値と、同期の内部状態を混ぜないため。
 * **`Partial` なのは意図的**: 保存行には明示的に設定された項目だけを持たせ、既定値は
 * `getSettings()` が読み取り時に被せる。既定値を保存してしまうと「未設定」と区別できなくなり、
 * 新規端末の初回同期・取り込みが既定値を実値として扱う事故になる(`src/db/settings.ts` 参照)
 */
export type SettingsRow = Partial<Settings> & { id: "default"; synced?: boolean };

export const db = new Dexie("lifelog") as Dexie & {
  weightRecords: EntityTable<WeightRecord, "date">;
  mealRecords: EntityTable<MealRecord, "id">;
  settings: EntityTable<SettingsRow, "id">;
  foodMasterItems: EntityTable<FoodMasterItem, "id">;
  syncDeletions: EntityTable<SyncDeletion, "id">;
  waterRecords: EntityTable<WaterRecord, "id">;
  diaryRecords: EntityTable<DiaryRecord, "date">;
  workoutRecords: EntityTable<WorkoutRecord, "id">;
  exerciseMasterItems: EntityTable<ExerciseMasterItem, "id">;
  adviceRecords: EntityTable<AdviceRecord, "weekStart">;
  activityRecords: EntityTable<ActivityRecord, "date">;
  monthlyAdviceRecords: EntityTable<MonthlyAdviceRecord, "month">;
  bloodPressureRecords: EntityTable<BloodPressureRecord, "date">;
  bodyMeasurementRecords: EntityTable<BodyMeasurementRecord, "date">;
  habitMasterItems: EntityTable<HabitMasterItem, "id">;
  habitRecords: EntityTable<HabitRecord, "id">;
  googleAuth: EntityTable<GoogleAuthRow, "id">;
};

/**
 * ユーザー自身のGoogle認可の保存行(Issue #214)。1行だけ(`id: "default"`)。
 *
 * **refresh token は実質的に権限そのもの**(いつでもaccess tokenを作れる券)。ただしGoogleは
 * その使用にも `client_secret` を要求するため、トークン単体では鍵にならない(検討メモ12.8)。
 * それでも持ち出し経路は塞ぐ: **シート同期にもバックアップにも載せない。**
 * access token は短命なため永続化せず、メモリ上でのみ保持する(`src/api/googleOAuth.ts`)。
 */
export interface GoogleAuthRow {
  id: "default";
  refreshToken: string;
  connectedAt: string; // ISO8601
}

// weightRecords: dateを主キーにすることで、同じ日付のput()が自動的に上書き(後勝ち)になる
db.version(1).stores({
  weightRecords: "date, timestamp",
  mealRecords: "id, mealType, timestamp",
  settings: "id",
});

db.version(2).stores({
  foodMasterItems: "id, name",
});

// syncDeletions: 削除された同期対象記録のトゥームストーン置き場(Issue #30)。sheetでの絞り込み用にインデックスを張る
db.version(3).stores({
  syncDeletions: "id, sheet",
});

// フェーズ2(Issue #8〜#10): 水分・日記・筋トレ・種目マスタ。
// diaryRecordsはweightRecordsと同じく日付を主キーにして「1日1件、後勝ち」を成立させる
db.version(4).stores({
  waterRecords: "id, timestamp",
  diaryRecords: "date, timestamp",
  workoutRecords: "id, date",
  exerciseMasterItems: "id, name",
});

// フェーズ3(Issue #12): AIコーチコメントのキャッシュ。
// 週の開始日(月曜)を主キーにして「1週1件、再生成で上書き(後勝ち)」を成立させる
db.version(5).stores({
  adviceRecords: "weekStart",
});

// Garmin由来の日次活動記録(Issue #81)。dateを主キーにして「1日1件、後勝ち」を成立させる
db.version(6).stores({
  activityRecords: "date",
});

// 食事マスタ・種目マスタをスプレッドシート同期の対象に加える(Issue #96)。
// インデックスは変えず、既存行に synced: false を付与して次回同期でまとめて送信させる
db.version(7)
  .stores({})
  .upgrade(async (tx) => {
    await tx.table("foodMasterItems").toCollection().modify({ synced: false });
    await tx.table("exerciseMasterItems").toCollection().modify({ synced: false });
  });

// 月次AIコーチコメントのキャッシュ(Issue #114)。
// 月(YYYY-MM)を主キーにして「1月1件、再生成で上書き(後勝ち)」を成立させる(週次のadviceRecordsと同じ仕組み)
db.version(8).stores({
  monthlyAdviceRecords: "month",
});

// 血圧記録(Issue #117)。体重・日記と同じくdateを主キーにして「1日1件、後勝ち」を成立させる
db.version(9).stores({
  bloodPressureRecords: "date, timestamp",
});

// 周囲径記録(Issue #118)。血圧と同じくdateを主キーにして「1日1件、後勝ち」を成立させる
db.version(10).stores({
  bodyMeasurementRecords: "date, timestamp",
});

// 習慣トラッカー(Issue #113。要件定義書フェーズ4)。
// habitRecordsは`${date}_${habitId}`を主キーにして「1日1習慣1件、後勝ち」を成立させる
db.version(11).stores({
  habitMasterItems: "id, name, archived, order",
  habitRecords: "id, date, habitId",
});

// 週次・月次AIコメントをスプレッドシート同期の対象に加える(Issue #164)。
// インデックスは変えず、既存行に synced: false を付与して次回同期でまとめて送信させる
// (食事マスタ・種目マスタを同期対象にしたversion 7と同じ手当て)
db.version(12)
  .stores({})
  .upgrade(async (tx) => {
    await tx.table("adviceRecords").toCollection().modify({ synced: false });
    await tx.table("monthlyAdviceRecords").toCollection().modify({ synced: false });
    await tx.table("settings").toCollection().modify({ synced: false });
  });

// ユーザー自身のGoogle認可(Issue #214)。1行だけを持つ(id: "default")。
// **Settings に相乗りさせない** — Settings はシート同期にも完全バックアップにも乗るため、
// refresh token が同期先のシートやバックアップJSONへ流出する。専用テーブルに分けたうえで
// BACKUP_EXCLUDED_TABLES(src/db/backup.ts)で明示的に除外している
db.version(13).stores({
  googleAuth: "id",
});
