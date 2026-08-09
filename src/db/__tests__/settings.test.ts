import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/db";
import {
  getSettings,
  getStoredSettings,
  getUnsyncedSettings,
  isInitialSetupComplete,
  markSettingsSynced,
  shouldShowInitialSetup,
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
  it("既定値を保存行に実体化しない(新規端末でAPIトークンだけ入れた状態)", async () => {
    // 回帰(Issue #164): 以前はupdateSettingsが既定値込みのマージ結果を保存していたため、
    // 新規端末でAPIトークンを入れた瞬間に既定値が「ユーザーが設定した値」になり、
    // (1) 次の同期で既定値がシートの実値を上書きし、(2) 取り込みも実値を復元しなかった。
    // Issue #217でDEFAULT_SETTINGSは空になったが、**既定値を保存行に混ぜない**という
    // getSettings/getStoredSettingsの役割分担そのものはこのテストで守り続ける
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

/**
 * 初回セットアップの完了判定(Issue #217)。**ホームのリダイレクトと画面側の「はじめる」活性が
 * 同じ関数を見ていること**がここでの肝で、条件が割れると片方だけ満たしたユーザーが
 * どちらの画面からも抜けられなくなる。
 */
describe("初回セットアップの判定(Issue #217)", () => {
  const goals = { goalWeightKg: 64, goalDate: "2026-10-31", dailyCalorieTarget: 1900 } as const;

  it("目標3項目が揃えば完了。身体プロフィールは条件に含めない", () => {
    expect(isInitialSetupComplete({})).toBe(false);
    expect(isInitialSetupComplete({ goalWeightKg: 64, goalDate: "2026-10-31" })).toBe(false);
    expect(isInitialSetupComplete(goals)).toBe(true);
    // プロフィール・PFC・水分は任意 — 無くても完了とみなす
    expect(isInitialSetupComplete({ ...goals, heightCm: undefined, dailyWaterTargetMl: undefined })).toBe(true);
  });

  it("未設定なら初回セットアップへ誘導する", () => {
    expect(shouldShowInitialSetup({})).toBe(true);
    expect(shouldShowInitialSetup({ goalWeightKg: 64 })).toBe(true);
  });

  it("スキップ済みなら未設定でも誘導しない(移行ユーザーが記録を始められるように)", () => {
    expect(shouldShowInitialSetup({ initialSetupSkipped: true })).toBe(false);
  });

  it("完了していれば誘導しない", () => {
    expect(shouldShowInitialSetup(goals)).toBe(false);
  });
});
