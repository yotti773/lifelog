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
  it("returns empty defaults when nothing is saved yet (Issue #217)", async () => {
    const settings = await getSettings();
    // DEFAULT_SETTINGSから目標値を削除したため、保存行がなければ何も返らない
    expect(settings).toEqual({});
  });

  it("persists partial updates (Issue #217)", async () => {
    await updateSettings({ goalWeightKg: 63 });

    const settings = await getSettings();
    expect(settings.goalWeightKg).toBe(63);
    // goalDateはもう既定値ではなく、明示的に設定されない限り undefined
    expect(settings.goalDate).toBeUndefined();
  });

  it("persists a baseline date for the progress bar's starting point", async () => {
    await updateSettings({ baselineDate: "2026-05-01" });

    const settings = await getSettings();
    expect(settings.baselineDate).toBe("2026-05-01");
  });
});

describe("設定のシート同期(Issue #164)", () => {
  it("ユーザーが明示的に設定したもの以外は保存行に入らない(Issue #217)", async () => {
    // 新規端末でAPIトークンだけ入れた状態
    await updateSettings({ apiToken: "secret" });

    const stored = await getStoredSettings();
    expect(stored).toEqual({ apiToken: "secret" });
    // 目標値は明示的に設定されていないから undefined
    expect((await getSettings()).goalWeightKg).toBeUndefined();
    // 同期対象にも目標値は入らない
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
