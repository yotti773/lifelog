import { db } from "./db";
import type { FoodMasterItem } from "@/types";

export interface AddFoodMasterItemInput {
  name: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  source?: string;
}

export async function addFoodMasterItem(input: AddFoodMasterItemInput): Promise<FoodMasterItem> {
  const item: FoodMasterItem = {
    id: crypto.randomUUID(),
    name: input.name,
    kcal: input.kcal,
    proteinG: input.proteinG,
    fatG: input.fatG,
    carbsG: input.carbsG,
    source: input.source,
    createdAt: new Date().toISOString(),
  };
  await db.foodMasterItems.add(item);
  return item;
}

export async function getAllFoodMasterItems(): Promise<FoodMasterItem[]> {
  return db.foodMasterItems.orderBy("name").toArray();
}

export async function updateFoodMasterItem(
  id: string,
  patch: Partial<Omit<FoodMasterItem, "id" | "createdAt">>,
): Promise<FoodMasterItem> {
  const existing = await db.foodMasterItems.get(id);
  if (!existing) {
    throw new Error(`FoodMasterItem not found for id: ${id}`);
  }
  const updated: FoodMasterItem = { ...existing, ...patch };
  await db.foodMasterItems.put(updated);
  return updated;
}

export async function deleteFoodMasterItem(id: string): Promise<void> {
  await db.foodMasterItems.delete(id);
}

/**
 * シードデータ等の一括登録用。同名(完全一致)の既存項目があるものはスキップし、
 * 実際に追加した件数を返す。
 */
export async function bulkAddFoodMasterItems(items: AddFoodMasterItemInput[]): Promise<number> {
  const existingNames = new Set((await getAllFoodMasterItems()).map((item) => item.name));
  const toInsert = items
    .filter((item) => !existingNames.has(item.name))
    .map((item) => ({
      id: crypto.randomUUID(),
      name: item.name,
      kcal: item.kcal,
      proteinG: item.proteinG,
      fatG: item.fatG,
      carbsG: item.carbsG,
      source: item.source,
      createdAt: new Date().toISOString(),
    }));
  if (toInsert.length === 0) return 0;
  await db.foodMasterItems.bulkAdd(toInsert);
  return toInsert.length;
}
