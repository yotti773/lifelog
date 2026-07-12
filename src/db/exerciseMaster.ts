import { db } from "./db";
import { enqueueDeletion } from "./syncDeletions";
import type { ExerciseBodyPart, ExerciseMasterItem } from "@/types";

/** 種目名が既に登録済みか(自分自身のidは除外して判定する)。前後空白は無視して完全一致で比較する */
async function isDuplicateName(name: string, excludeId?: string): Promise<boolean> {
  const trimmed = name.trim();
  const items = await db.exerciseMasterItems.toArray();
  return items.some((item) => item.id !== excludeId && item.name.trim() === trimmed);
}

/**
 * 種目マスタは種目名+任意の部位分類を持つ(重量・回数は毎回変わるためマスタ化しない。画面設計書7.1章、部位はIssue #104)。
 * 同名の重複登録は、筋トレ記録のサジェスト(文字列をキーに使う)が重複しないよう弾く。
 */
export async function addExerciseMasterItem(name: string, bodyPart?: ExerciseBodyPart): Promise<ExerciseMasterItem> {
  if (await isDuplicateName(name)) {
    throw new DuplicateExerciseNameError(name);
  }
  const item: ExerciseMasterItem = {
    id: crypto.randomUUID(),
    name,
    ...(bodyPart !== undefined && { bodyPart }),
    createdAt: new Date().toISOString(),
    synced: false,
  };
  await db.exerciseMasterItems.add(item);
  return item;
}

/** 同名の種目が既に存在するときにadd/updateが投げるエラー(UI側で重複メッセージの出し分けに使う) */
export class DuplicateExerciseNameError extends Error {
  constructor(name: string) {
    super(`ExerciseMasterItem already exists for name: ${name}`);
    this.name = "DuplicateExerciseNameError";
  }
}

export async function getAllExerciseMasterItems(): Promise<ExerciseMasterItem[]> {
  return db.exerciseMasterItems.orderBy("name").toArray();
}

/** bodyPartにundefinedを渡すと「分類なし」に戻す(任意項目のため。Issue #104) */
export async function updateExerciseMasterItem(
  id: string,
  name: string,
  bodyPart?: ExerciseBodyPart,
): Promise<ExerciseMasterItem> {
  const existing = await db.exerciseMasterItems.get(id);
  if (!existing) {
    throw new Error(`ExerciseMasterItem not found for id: ${id}`);
  }
  if (await isDuplicateName(name, id)) {
    throw new DuplicateExerciseNameError(name);
  }
  const { bodyPart: _bodyPart, ...rest } = existing;
  const updated: ExerciseMasterItem = { ...rest, name, ...(bodyPart !== undefined && { bodyPart }), synced: false };
  await db.exerciseMasterItems.put(updated);
  return updated;
}

export async function deleteExerciseMasterItem(id: string): Promise<void> {
  await db.exerciseMasterItems.delete(id);
  // スプレッドシート側の該当行も次回同期で削除するためトゥームストーンを残す(Issue #96)
  await enqueueDeletion("exerciseMaster", id);
}

export async function getUnsyncedExerciseMasterItems(): Promise<ExerciseMasterItem[]> {
  return db.exerciseMasterItems.filter((item) => !item.synced).toArray();
}

export async function markExerciseMasterItemsSynced(ids: string[]): Promise<void> {
  await db.exerciseMasterItems.where("id").anyOf(ids).modify({ synced: true });
}
