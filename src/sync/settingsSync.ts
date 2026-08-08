import type { Settings } from "@/types";

/**
 * 設定のスプレッドシート同期(Issue #164)。1設定=1行の key-value 形式で書き出す。
 *
 * **`worker/sheetsSync.ts` の `SETTINGS_FIELDS` と手で同期を保つこと。**
 * worker/tsconfig.json は src/ に依存しない独立ビルドのため、共有できず両側に持っている
 * (同期エンジンの `Pulled*` 型が worker 側に複製されているのと同じ事情)。
 *
 * **`apiToken` は対象外。** 取り込みAPIの呼び出しに `Authorization: Bearer` としてこの値が要るため、
 * 入力済みでなければ取り込みが始まらない = シートからは原理的に復元できない。
 * **`lastSyncedAt` も対象外**(端末ごとの同期状態であって利用者の設定ではない)。
 */
export type SettingsFieldType = "number" | "date" | "text" | "boolean";

export const SETTINGS_SYNC_FIELDS: { key: keyof Settings; type: SettingsFieldType }[] = [
  { key: "goalWeightKg", type: "number" },
  { key: "goalDate", type: "date" },
  { key: "baselineDate", type: "date" },
  { key: "dailyCalorieTarget", type: "number" },
  { key: "dailyWaterTargetMl", type: "number" },
  { key: "dailyProteinTargetG", type: "number" },
  { key: "dailyFatTargetG", type: "number" },
  { key: "dailyCarbsTargetG", type: "number" },
  { key: "heightCm", type: "number" },
  { key: "birthYear", type: "number" },
  { key: "sex", type: "text" },
  { key: "activityLevel", type: "number" },
  { key: "sendDiaryTextToAi", type: "boolean" },
];

export const BOOLEAN_TRUE_LABEL = "はい";
export const BOOLEAN_FALSE_LABEL = "いいえ";

/** worker側の formatCalendarDate と同じ表記にそろえる(YYYY-MM-DD → 2026年10月31日) */
function toCalendarDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[1]}年${match[2]}月${match[3]}日` : value;
}

export interface SettingsEntry {
  key: string;
  value: string;
}

/**
 * 送信用の key-value に変換する。未設定(undefined)の項目は行を作らない。
 * 日付・真偽をそのまま書くと Sheets の USER_ENTERED が解釈し直すため、
 * 日付は漢字入り・真偽は「はい/いいえ」にして解釈させない。
 */
export function toSettingsEntries(settings: Partial<Settings>): SettingsEntry[] {
  const entries: SettingsEntry[] = [];
  for (const field of SETTINGS_SYNC_FIELDS) {
    const value = settings[field.key];
    if (value === undefined || value === null || value === "") continue;
    if (field.type === "date") {
      entries.push({ key: field.key, value: toCalendarDate(String(value)) });
    } else if (field.type === "boolean") {
      entries.push({ key: field.key, value: value ? BOOLEAN_TRUE_LABEL : BOOLEAN_FALSE_LABEL });
    } else {
      entries.push({ key: field.key, value: String(value) });
    }
  }
  return entries;
}

/** 取り込んだ key-value を Settings の部分パッチへ戻す。未知のキーは無視する */
export function fromSettingsEntries(
  entries: { key: string; value: string | number | boolean }[],
): Partial<Settings> {
  const known = new Set(SETTINGS_SYNC_FIELDS.map((f) => f.key as string));
  const patch: Record<string, unknown> = {};
  for (const entry of entries) {
    if (!known.has(entry.key)) continue;
    patch[entry.key] = entry.value;
  }
  return patch as Partial<Settings>;
}
