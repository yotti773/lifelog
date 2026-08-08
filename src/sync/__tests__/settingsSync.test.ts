import { describe, expect, it } from "vitest";
import {
  BOOLEAN_FALSE_LABEL,
  BOOLEAN_TRUE_LABEL,
  fromSettingsEntries,
  SETTINGS_SYNC_FIELDS,
  toSettingsEntries,
} from "@/sync/settingsSync";
import type { Settings } from "@/types";

const base: Settings = { goalWeightKg: 64, goalDate: "2026-10-31", dailyCalorieTarget: 1730 };

describe("toSettingsEntries", () => {
  it("日付は漢字入り・真偽は「はい/いいえ」で書き出す(Sheetsに解釈し直されないため)", () => {
    const entries = toSettingsEntries({ ...base, sendDiaryTextToAi: true });
    expect(entries).toContainEqual({ key: "goalDate", value: "2026年10月31日" });
    expect(entries).toContainEqual({ key: "sendDiaryTextToAi", value: BOOLEAN_TRUE_LABEL });
    expect(entries).toContainEqual({ key: "goalWeightKg", value: "64" });
  });

  it("falseも「いいえ」として書き出す(未設定と区別する)", () => {
    const entries = toSettingsEntries({ ...base, sendDiaryTextToAi: false });
    expect(entries).toContainEqual({ key: "sendDiaryTextToAi", value: BOOLEAN_FALSE_LABEL });
  });

  it("未設定の項目は行を作らない", () => {
    const keys = toSettingsEntries(base).map((e) => e.key);
    expect(keys).not.toContain("heightCm");
    expect(keys).not.toContain("baselineDate");
  });

  it("apiToken・lastSyncedAtは書き出さない", () => {
    // apiTokenは取り込みAPIの認証に使うため、そもそもシートからは復元できない
    const entries = toSettingsEntries({ ...base, apiToken: "secret", lastSyncedAt: "2026-08-08T00:00:00.000Z" });
    const keys = entries.map((e) => e.key);
    expect(keys).not.toContain("apiToken");
    expect(keys).not.toContain("lastSyncedAt");
    expect(SETTINGS_SYNC_FIELDS.map((f) => f.key as string)).not.toContain("apiToken");
  });
});

describe("fromSettingsEntries", () => {
  it("既知のキーだけをパッチへ戻す", () => {
    const patch = fromSettingsEntries([
      { key: "goalWeightKg", value: 64 },
      { key: "goalDate", value: "2026-10-31" },
      { key: "sendDiaryTextToAi", value: true },
      { key: "unknownKey", value: "x" },
    ]);
    expect(patch).toEqual({ goalWeightKg: 64, goalDate: "2026-10-31", sendDiaryTextToAi: true });
  });

  it("シートに書かれていてもapiTokenは戻さない", () => {
    expect(fromSettingsEntries([{ key: "apiToken", value: "secret" }])).toEqual({});
  });
});

describe("往復", () => {
  it("書き出して読み戻すと元の値に戻る", () => {
    const settings: Settings = {
      ...base,
      baselineDate: "2026-05-18",
      heightCm: 172,
      birthYear: 1990,
      sex: "male",
      activityLevel: 1.55,
      sendDiaryTextToAi: false,
    };
    // シート側のパース(数値・日付・真偽)を模して戻す
    const parsed = toSettingsEntries(settings).map((e) => {
      const field = SETTINGS_SYNC_FIELDS.find((f) => f.key === e.key)!;
      if (field.type === "number") return { key: e.key, value: Number(e.value) };
      if (field.type === "boolean") return { key: e.key, value: e.value === BOOLEAN_TRUE_LABEL };
      if (field.type === "date") {
        const m = e.value.match(/^(\d{4})年(\d{2})月(\d{2})日$/)!;
        return { key: e.key, value: `${m[1]}-${m[2]}-${m[3]}` };
      }
      return { key: e.key, value: e.value };
    });

    expect(fromSettingsEntries(parsed)).toEqual(settings);
  });
});

describe("新規端末での復元(回帰)", () => {
  it("既定値とのマージ結果ではなく保存行を見る、という前提を型で示す", () => {
    // getSettings()は行が無いとDEFAULT_SETTINGSを返すため、それで「設定済み」を判定すると
    // 新規端末で goalWeightKg・goalDate・dailyCalorieTarget が復元されない。
    // importEngineは db.settings.get("default") の行そのものを見る実装にしてある
    const defaults = ["goalWeightKg", "goalDate", "dailyCalorieTarget"];
    for (const key of defaults) {
      expect(SETTINGS_SYNC_FIELDS.map((f) => f.key as string)).toContain(key);
    }
  });
});
