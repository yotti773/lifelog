import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import {
  getSettings,
  getStoredSettings,
  getUnsyncedSettings,
  markSettingsSynced,
  updateSettings,
} from "@/db/settings";

beforeEach(async () => {
  await db.settings.clear();
});

describe("settings", () => {
  it("returns the requirements-doc defaults when nothing is saved yet", async () => {
    const settings = await getSettings();
    expect(settings).toEqual({
      goalWeightKg: 64,
      goalDate: "2026-10-31",
      dailyCalorieTarget: 1900,
    });
  });

  it("persists partial updates merged with the current values", async () => {
    await updateSettings({ goalWeightKg: 63 });

    const settings = await getSettings();
    expect(settings.goalWeightKg).toBe(63);
    expect(settings.goalDate).toBe("2026-10-31");
  });

  it("persists a baseline date for the progress bar's starting point", async () => {
    await updateSettings({ baselineDate: "2026-05-01" });

    const settings = await getSettings();
    expect(settings.baselineDate).toBe("2026-05-01");
  });
});

describe("設定のシート同期(Issue #164)", () => {
  it("既定値を保存行に実体化しない(新規端末でAPIトークンだけ入れた状態)", async () => {
    // 回帰: 以前はupdateSettingsが既定値込みのマージ結果を保存していたため、
    // 新規端末でAPIトークンを入れた瞬間に goalWeightKg:64 等が「ユーザーが設定した値」になり、
    // (1) 次の同期で既定値がシートの実値を上書きし、(2) 取り込みも実値を復元しなかった
    await updateSettings({ apiToken: "secret" });

    const stored = await getStoredSettings();
    expect(stored).toEqual({ apiToken: "secret" });
    // 画面が読む値には既定値が被る(表示は従来どおり)
    expect((await getSettings()).goalWeightKg).toBe(64);
    // 同期対象にも既定値は入らない(apiTokenはtoSettingsEntries側で除外される)
    expect(await getUnsyncedSettings()).toEqual({ apiToken: "secret" });
  });

  it("送信中に別の変更が入ったら同期済みにしない(取りこぼし防止)", async () => {
    await updateSettings({ goalWeightKg: 63 });
    const snapshot = await getUnsyncedSettings();

    // 送信中(スナップショット取得後)にユーザーが値を変える
    await updateSettings({ goalWeightKg: 60 });
    await markSettingsSynced(snapshot!);

    // 変更後の値は未同期のまま残り、次回同期で送られる
    expect(await getUnsyncedSettings()).not.toBeNull();
    expect((await getUnsyncedSettings())!.goalWeightKg).toBe(60);
  });

  it("送信中に変更が無ければ同期済みになる", async () => {
    await updateSettings({ goalWeightKg: 63 });
    const snapshot = await getUnsyncedSettings();
    await markSettingsSynced(snapshot!);
    expect(await getUnsyncedSettings()).toBeNull();
  });

  it("lastSyncedAtだけの更新では同期済み状態を壊さない", async () => {
    await updateSettings({ goalWeightKg: 63 });
    await markSettingsSynced((await getUnsyncedSettings())!);

    await updateSettings({ lastSyncedAt: "2026-08-08T10:00:00.000Z" });
    expect(await getUnsyncedSettings()).toBeNull();
  });
});
