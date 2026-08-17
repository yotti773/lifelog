import { db, type SettingsRow } from "./db";
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
  WaterRecord,
  WeightRecord,
  WorkoutRecord,
} from "@/types";

/**
 * ローカルデータの完全バックアップ(Issue #164)。
 *
 * スプレッドシート同期(#54)はバックアップの主線だが、**シートに列を持たないデータは復元できない**:
 * 設定(`settings`)と、食事のAI推定値・写真参照がそれにあたる
 * (週次・月次のAIコメントは #164 でシート同期の対象にしたため、ここには含まれない)。
 * 本モジュールはその穴を埋めるための「全テーブルまるごと」の退避・復元経路。
 *
 * 機種変更・ブラウザデータ削除に加え、**配信ドメインの変更**でも必要になる。
 * IndexedDBはオリジン単位のため、URLが変わると同じブラウザでも中身は引き継がれない。
 */

/** バックアップ形式のバージョン。1 = フェーズ1時代(体重・食事・設定のみ)、2 = 全テーブル */
export const BACKUP_VERSION = 2;

export interface BackupTables {
  weightRecords: WeightRecord[];
  mealRecords: MealRecord[];
  settings: SettingsRow[];
  foodMasterItems: FoodMasterItem[];
  waterRecords: WaterRecord[];
  diaryRecords: DiaryRecord[];
  workoutRecords: WorkoutRecord[];
  exerciseMasterItems: ExerciseMasterItem[];
  adviceRecords: AdviceRecord[];
  activityRecords: ActivityRecord[];
  monthlyAdviceRecords: MonthlyAdviceRecord[];
  bloodPressureRecords: BloodPressureRecord[];
  bodyMeasurementRecords: BodyMeasurementRecord[];
  habitMasterItems: HabitMasterItem[];
  habitRecords: HabitRecord[];
}

export type BackupTableName = keyof BackupTables;

/**
 * バックアップに**含めない**テーブルと、その理由。
 *
 * テーブルを追加したら `BACKUP_TABLES` かこちらのどちらかに必ず入れること
 * (どちらにも無いと `backup.test.ts` が落ちる)。「入れ忘れ」と「意図的に外した」を
 * 区別できる形にしてあり、除外にはここに理由を書く。
 *
 * - `syncDeletions`: 「シートのこの行を消す」という同期の途中状態(トゥームストーン)であって
 *   利用者のデータではない。復元先へ持ち込むと、復元したレコードがまだ載っているシートの行を
 *   消しにいく恐れがある。退避前に「今すぐ同期」を済ませておけば保留中の削除は反映済みになる
 * - `googleAuth`: Googleのrefresh token(Issue #214)。**認証情報を持ち出せるファイルにしない**
 *   という判断で、#164 で `apiToken` をシート同期から外したのと同じ線(検討メモ12.8の制約3)。
 *   復元後はGoogleと連携し直す
 */
export const BACKUP_EXCLUDED_TABLES = ["syncDeletions", "googleAuth"] as const;

/**
 * バックアップ対象のテーブル。
 *
 * テーブルを追加したらここにも足すこと(漏れは `backup.test.ts` が検出する)。
 * 意図的に外す場合は `BACKUP_EXCLUDED_TABLES` に理由付きで入れる。
 */
export const BACKUP_TABLES: BackupTableName[] = [
  "weightRecords",
  "mealRecords",
  "settings",
  "foodMasterItems",
  "waterRecords",
  "diaryRecords",
  "workoutRecords",
  "exerciseMasterItems",
  "adviceRecords",
  "activityRecords",
  "monthlyAdviceRecords",
  "bloodPressureRecords",
  "bodyMeasurementRecords",
  "habitMasterItems",
  "habitRecords",
];

/** 画面表示用のテーブル名。復元後に「何が戻ったか」を出すために使う */
export const BACKUP_TABLE_LABELS: Record<BackupTableName, string> = {
  weightRecords: "体重",
  mealRecords: "食事",
  settings: "設定",
  foodMasterItems: "食事マスタ",
  waterRecords: "水分",
  diaryRecords: "日記",
  workoutRecords: "筋トレ",
  exerciseMasterItems: "種目マスタ",
  adviceRecords: "週次AIコメント",
  activityRecords: "活動(Garmin)",
  monthlyAdviceRecords: "月次AIコメント",
  bloodPressureRecords: "血圧",
  bodyMeasurementRecords: "周囲径",
  habitMasterItems: "習慣マスタ",
  habitRecords: "習慣",
};

export interface BackupData {
  version: number;
  exportedAt: string;
  /** 取得元のオリジン。ドメイン移行のときに取り違えを防ぐため記録する */
  origin?: string;
  tables: BackupTables;
}

/** フェーズ1時代の形式(体重・食事・設定のみをトップレベルに持つ) */
interface BackupDataV1 {
  exportedAt: string;
  weightRecords: WeightRecord[];
  mealRecords: MealRecord[];
  settings: Settings;
}

export async function exportBackupData(): Promise<BackupData> {
  // 読み取りも1つのトランザクションで行う。自動同期・取り込みが並走したとき、
  // テーブルごとに読むタイミングがズレると内部的に矛盾した断面を書き出してしまう
  // (復元側が全テーブル1トランザクションなのと対で、書き出し側も断面を保証する)
  const entries = await db.transaction(
    "r",
    BACKUP_TABLES.map((name) => db.table(name)),
    async () =>
      Promise.all(BACKUP_TABLES.map(async (name) => [name, await db.table(name).toArray()] as const)),
  );
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    origin: typeof location === "undefined" ? undefined : location.origin,
    tables: Object.fromEntries(entries) as unknown as BackupTables,
  };
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 読み込んだJSONをバックアップとして検証し、現行形式に正規化する。
 * **復元は全削除を伴うため、壊れたファイルで既存データを消さないよう必ずここを通す。**
 * 妥当でなければ日本語のメッセージ付きでthrowする。
 */
export function parseBackupData(raw: unknown): BackupData {
  if (!isRecordObject(raw)) {
    throw new Error("バックアップファイルの形式が正しくありません");
  }

  let version: number;
  let tables: Record<string, unknown>;

  // v1: tablesを持たず、体重・食事・設定がトップレベルにある。
  // ここで現行形式へ寄せるだけにして、検証は下の共通処理に必ず通す
  // (v1だけ検証を素通りすると、切り詰められたJSONで全テーブルを失いうる)
  if (!("tables" in raw) && Array.isArray(raw.weightRecords)) {
    const v1 = raw as unknown as BackupDataV1;
    version = 1;
    tables = {
      weightRecords: v1.weightRecords,
      mealRecords: v1.mealRecords,
      settings: v1.settings ? [{ id: "default", ...v1.settings }] : [],
    };
  } else {
    if (!isRecordObject(raw.tables)) {
      throw new Error("バックアップファイルにデータが含まれていません");
    }
    version = typeof raw.version === "number" ? raw.version : BACKUP_VERSION;
    tables = raw.tables;
  }

  // 未知のテーブル名は無視し、既知のテーブルは配列であることだけ確かめる。
  // 将来のバージョンで増えたテーブルを読んでも落ちないようにするため、欠けは空配列で埋める
  const normalized = Object.fromEntries(
    BACKUP_TABLES.map((name) => {
      const value = tables[name];
      if (value !== undefined && !Array.isArray(value)) {
        throw new Error(`バックアップファイルの ${name} が壊れています`);
      }
      return [name, value ?? []];
    }),
  ) as unknown as BackupTables;

  if (BACKUP_TABLES.every((name) => normalized[name].length === 0)) {
    throw new Error("バックアップファイルが空です");
  }

  return {
    version,
    exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : new Date().toISOString(),
    origin: typeof raw.origin === "string" ? raw.origin : undefined,
    tables: normalized,
  };
}

/** テーブルごとの件数。エクスポート前の確認と復元後の結果表示に使う */
export function countBackupRows(data: BackupData): Record<BackupTableName, number> {
  return Object.fromEntries(BACKUP_TABLES.map((name) => [name, data.tables[name].length])) as Record<
    BackupTableName,
    number
  >;
}

/**
 * 既存データを全て置き換える(機種変更・ドメイン移行・復元用)。
 * 途中で失敗しても中途半端な状態が残らないよう、全テーブルを1つのトランザクションで処理する。
 */
export async function importBackupData(data: BackupData): Promise<Record<BackupTableName, number>> {
  const tables = BACKUP_TABLES.map((name) => db.table(name));
  await db.transaction("rw", [...tables, db.syncDeletions], async () => {
    for (const name of BACKUP_TABLES) {
      const table = db.table(name);
      await table.clear();
      const rows = data.tables[name];
      if (rows.length > 0) await table.bulkPut(rows);
    }
    // 復元先に残っていた保留中のトゥームストーンも消す。バックアップは断面なので、
    // その断面に含まれない「削除待ち」を持ち越してはいけない。残すと、次の同期で
    // 復元したレコードに対応するシートの行が deleteDimension で消される。復元レコードは
    // synced: true のため再送信もされず、シート側から恒久的に失われる
    await db.syncDeletions.clear();
  });
  return countBackupRows(data);
}
