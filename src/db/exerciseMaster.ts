import { db } from "./db";
import type { ExerciseMasterItem } from "@/types";

/** 種目マスタは種目名のみを持つ(重量・回数は毎回変わるためマスタ化しない。画面設計書7.1章) */
export async function addExerciseMasterItem(name: string): Promise<ExerciseMasterItem> {
  const item: ExerciseMasterItem = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString(),
  };
  await db.exerciseMasterItems.add(item);
  return item;
}

export async function getAllExerciseMasterItems(): Promise<ExerciseMasterItem[]> {
  return db.exerciseMasterItems.orderBy("name").toArray();
}

export async function updateExerciseMasterItem(id: string, name: string): Promise<ExerciseMasterItem> {
  const existing = await db.exerciseMasterItems.get(id);
  if (!existing) {
    throw new Error(`ExerciseMasterItem not found for id: ${id}`);
  }
  const updated: ExerciseMasterItem = { ...existing, name };
  await db.exerciseMasterItems.put(updated);
  return updated;
}

export async function deleteExerciseMasterItem(id: string): Promise<void> {
  await db.exerciseMasterItems.delete(id);
}
