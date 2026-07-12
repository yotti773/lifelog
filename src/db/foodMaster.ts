import { db } from "./db";
import { enqueueDeletion } from "./syncDeletions";
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
    synced: false,
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
  const updated: FoodMasterItem = { ...existing, ...patch, synced: patch.synced ?? false };
  await db.foodMasterItems.put(updated);
  return updated;
}

export async function deleteFoodMasterItem(id: string): Promise<void> {
  await db.foodMasterItems.delete(id);
  // スプレッドシート側の該当行も次回同期で削除するためトゥームストーンを残す(Issue #96)
  await enqueueDeletion("foodMaster", id);
}

export async function getUnsyncedFoodMasterItems(): Promise<FoodMasterItem[]> {
  return db.foodMasterItems.filter((item) => !item.synced).toArray();
}

export async function markFoodMasterItemsSynced(ids: string[]): Promise<void> {
  await db.foodMasterItems.where("id").anyOf(ids).modify({ synced: true });
}
