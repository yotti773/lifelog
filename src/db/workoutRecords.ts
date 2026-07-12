import { db } from "./db";
import { enqueueDeletion } from "./syncDeletions";
import type { WorkoutRecord } from "@/types";

export interface WorkoutSetInput {
  weightKg: number;
  reps: number;
}

export interface WorkoutExerciseInput {
  name: string;
  sets: WorkoutSetInput[];
}

/** 記録画面のドラフト・ホーム表示用に、セットレコードを種目単位にまとめた形 */
export interface WorkoutExercise {
  name: string;
  sets: WorkoutRecord[]; // setNumber昇順
}

/** 指定日の全セットレコードを種目順(exerciseOrder)→セット順(setNumber)で返す */
export async function getWorkoutRecordsForDate(date: string): Promise<WorkoutRecord[]> {
  const records = await db.workoutRecords.where("date").equals(date).toArray();
  return records.sort((a, b) => a.exerciseOrder - b.exerciseOrder || a.setNumber - b.setNumber);
}

/**
 * 履歴確認画面用に全セットレコードを日付降順で返す(Issue #73)。
 * 同一日付内の並びはインデックス順のままだが、履歴側で日付単位に集約するため問題ない
 */
export async function getAllWorkoutRecordsDesc(): Promise<WorkoutRecord[]> {
  return db.workoutRecords.orderBy("date").reverse().toArray();
}

/** getWorkoutRecordsForDateの結果を種目単位にグルーピングする(順序は維持) */
export function groupWorkoutRecordsByExercise(records: WorkoutRecord[]): WorkoutExercise[] {
  const exercises: WorkoutExercise[] = [];
  const byOrder = new Map<number, WorkoutExercise>();
  for (const record of records) {
    let exercise = byOrder.get(record.exerciseOrder);
    if (!exercise) {
      exercise = { name: record.exerciseName, sets: [] };
      byOrder.set(record.exerciseOrder, exercise);
      exercises.push(exercise);
    }
    exercise.sets.push(record);
  }
  return exercises;
}

/**
 * その日の筋トレ記録を丸ごと置き換える(画面設計書7章)。
 * 記録画面は当日の全種目・全セットを1画面で編集するため、保存=「既存の当日分を消して登録し直す」。
 * exercisesを空にして保存すれば当日分の削除になる。
 * 置き換えのたびに全セットへ新しいIDを振り直すため、置き換え前の全セットIDを削除トゥームストーンとして残し、
 * スプレッドシート側の古いセット行を次回同期で消す(Issue #72)
 */
export async function replaceWorkoutRecordsForDate(
  date: string,
  exercises: WorkoutExerciseInput[],
): Promise<WorkoutRecord[]> {
  const timestamp = new Date().toISOString();
  const records: WorkoutRecord[] = exercises.flatMap((exercise, exerciseIndex) =>
    exercise.sets.map((set, setIndex) => ({
      id: crypto.randomUUID(),
      date,
      timestamp,
      exerciseName: exercise.name,
      exerciseOrder: exerciseIndex + 1,
      setNumber: setIndex + 1,
      weightKg: set.weightKg,
      reps: set.reps,
      synced: false,
    })),
  );
  await db.transaction("rw", db.workoutRecords, db.syncDeletions, async () => {
    const existing = await db.workoutRecords.where("date").equals(date).toArray();
    await db.workoutRecords.where("date").equals(date).delete();
    if (records.length > 0) {
      await db.workoutRecords.bulkAdd(records);
    }
    await Promise.all(existing.map((record) => enqueueDeletion("workout", record.id)));
  });
  return records;
}

/** 種目ごとの「前回の記録」1件分(種目名選択時のリファレンス表示用。Issue #100) */
export interface PreviousWorkout {
  date: string; // その内容を記録した日(前回日)
  sets: WorkoutSetInput[]; // setNumber昇順
}

/**
 * 指定日より前で各種目を最後に記録した内容を、種目名→前回内容のMapで返す(Issue #100)。
 * 記録画面で種目名を選ぶと「前回の重量×回数」を参照表示するために使う。
 * beforeDate自身は含めない(編集中の当日を「前回」として出さないため)。
 */
export async function getPreviousWorkoutsByExercise(beforeDate: string): Promise<Map<string, PreviousWorkout>> {
  const records = await db.workoutRecords.where("date").below(beforeDate).toArray();
  // 種目名ごとに最新日付を求める
  const latestDateByName = new Map<string, string>();
  for (const record of records) {
    const current = latestDateByName.get(record.exerciseName);
    if (current === undefined || record.date > current) {
      latestDateByName.set(record.exerciseName, record.date);
    }
  }
  // 各種目の最新日付のセットレコードだけを集める
  const latestRecordsByName = new Map<string, WorkoutRecord[]>();
  for (const record of records) {
    if (record.date !== latestDateByName.get(record.exerciseName)) continue;
    const list = latestRecordsByName.get(record.exerciseName) ?? [];
    list.push(record);
    latestRecordsByName.set(record.exerciseName, list);
  }
  const result = new Map<string, PreviousWorkout>();
  for (const [name, setRecords] of latestRecordsByName) {
    // 同名の種目が同じ日に複数カードで記録されていた場合でも、カード順(exerciseOrder)→セット順で
    // 並べ、カードをまたいでセットが混ざらないようにする
    setRecords.sort((a, b) => a.exerciseOrder - b.exerciseOrder || a.setNumber - b.setNumber);
    result.set(name, {
      date: setRecords[0].date,
      sets: setRecords.map((record) => ({ weightKg: record.weightKg, reps: record.reps })),
    });
  }
  return result;
}

export async function getUnsyncedWorkoutRecords(): Promise<WorkoutRecord[]> {
  return db.workoutRecords.filter((record) => !record.synced).toArray();
}

export async function markWorkoutRecordsSynced(ids: string[]): Promise<void> {
  await db.workoutRecords.where("id").anyOf(ids).modify({ synced: true });
}
