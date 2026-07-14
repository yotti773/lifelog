import { db } from "./db";
import { enqueueDeletion } from "./syncDeletions";
import type { HabitMasterItem } from "@/types";

/** 習慣名が既に登録済みか(自分自身のidは除外して判定する)。前後空白は無視して完全一致で比較する */
async function isDuplicateName(name: string, excludeId?: string): Promise<boolean> {
  const trimmed = name.trim();
  const items = await db.habitMasterItems.toArray();
  return items.some((item) => item.id !== excludeId && item.name.trim() === trimmed);
}

/** 同名の習慣が既に存在するときにadd/updateが投げるエラー(UI側で重複メッセージの出し分けに使う) */
export class DuplicateHabitNameError extends Error {
  constructor(name: string) {
    super(`HabitMasterItem already exists for name: ${name}`);
    this.name = "DuplicateHabitNameError";
  }
}

export interface AddHabitMasterItemInput {
  name: string;
  targetWeeklyFrequency?: number; // 週あたり目標日数(1〜7)。任意
}

/**
 * 習慣マスタは習慣名+任意の目標頻度を持つ(Issue #113。要件定義書フェーズ4)。
 * 同名の重複登録は、チェックリストでの識別が曖昧になるため弾く(種目マスタと同じ方針)。
 * orderは末尾に採番し、チェックリストの並び順に使う。
 */
export async function addHabitMasterItem(input: AddHabitMasterItemInput): Promise<HabitMasterItem> {
  if (await isDuplicateName(input.name)) {
    throw new DuplicateHabitNameError(input.name);
  }
  const maxOrder = await db.habitMasterItems
    .orderBy("order")
    .last()
    .then((last) => last?.order ?? 0);
  const item: HabitMasterItem = {
    id: crypto.randomUUID(),
    name: input.name,
    ...(input.targetWeeklyFrequency !== undefined && { targetWeeklyFrequency: input.targetWeeklyFrequency }),
    archived: false,
    order: maxOrder + 1,
    createdAt: new Date().toISOString(),
    synced: false,
  };
  await db.habitMasterItems.add(item);
  return item;
}

/** 全習慣(アーカイブ済みも含む)を並び順で返す。管理画面用 */
export async function getAllHabitMasterItems(): Promise<HabitMasterItem[]> {
  return db.habitMasterItems.orderBy("order").toArray();
}

/** アクティブな(アーカイブされていない)習慣を並び順で返す。ホームのチェックリスト用 */
export async function getActiveHabitMasterItems(): Promise<HabitMasterItem[]> {
  return (await db.habitMasterItems.orderBy("order").toArray()).filter((item) => !item.archived);
}

export async function updateHabitMasterItem(
  id: string,
  patch: Partial<Pick<HabitMasterItem, "name" | "targetWeeklyFrequency" | "archived">>,
): Promise<HabitMasterItem> {
  const existing = await db.habitMasterItems.get(id);
  if (!existing) {
    throw new Error(`HabitMasterItem not found for id: ${id}`);
  }
  if (patch.name !== undefined && (await isDuplicateName(patch.name, id))) {
    throw new DuplicateHabitNameError(patch.name);
  }
  // targetWeeklyFrequencyにundefinedを渡すと「目標なし」に戻す(任意項目のため、キーごと落とす)
  const { targetWeeklyFrequency: _t, ...rest } = existing;
  const nextFrequency =
    "targetWeeklyFrequency" in patch ? patch.targetWeeklyFrequency : existing.targetWeeklyFrequency;
  const updated: HabitMasterItem = {
    ...rest,
    ...(patch.name !== undefined && { name: patch.name }),
    ...(patch.archived !== undefined && { archived: patch.archived }),
    ...(nextFrequency !== undefined && { targetWeeklyFrequency: nextFrequency }),
    synced: false,
  };
  await db.habitMasterItems.put(updated);
  return updated;
}

export async function deleteHabitMasterItem(id: string): Promise<void> {
  await db.habitMasterItems.delete(id);
  // スプレッドシート側の該当行も次回同期で削除するためトゥームストーンを残す(Issue #113)
  await enqueueDeletion("habitMaster", id);
}

export async function getUnsyncedHabitMasterItems(): Promise<HabitMasterItem[]> {
  return db.habitMasterItems.filter((item) => !item.synced).toArray();
}

export async function markHabitMasterItemsSynced(ids: string[]): Promise<void> {
  await db.habitMasterItems.where("id").anyOf(ids).modify({ synced: true });
}
