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

export async function getUnsyncedWorkoutRecords(): Promise<WorkoutRecord[]> {
  return db.workoutRecords.filter((record) => !record.synced).toArray();
}

export async function markWorkoutRecordsSynced(ids: string[]): Promise<void> {
  await db.workoutRecords.where("id").anyOf(ids).modify({ synced: true });
}
