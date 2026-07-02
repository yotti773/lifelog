import { useEffect, useState, type ChangeEvent, type SubmitEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { exportBackupData, importBackupData, type BackupData } from "../db/backup";
import { getUnsyncedMealRecords } from "../db/mealRecords";
import { getSettings, updateSettings } from "../db/settings";
import { getUnsyncedWeightRecords } from "../db/weightRecords";
import { formatDateTime } from "../lib/date";
import { runSync, type SyncOutcome } from "../sync/syncEngine";

function syncOutcomeMessage(outcome: SyncOutcome): string {
  switch (outcome.status) {
    case "success":
      return `${outcome.syncedCount}件を同期しました`;
    case "skipped-offline":
      return "オフラインのため同期できませんでした";
    case "skipped-nothing-to-sync":
      return "同期する記録はありません";
    case "error":
      return outcome.message;
  }
}

export default function Settings() {
  const settings = useLiveQuery(() => getSettings(), []);
  const unsyncedCount = useLiveQuery(async () => {
    const [weights, meals] = await Promise.all([getUnsyncedWeightRecords(), getUnsyncedMealRecords()]);
    return weights.length + meals.length;
  }, []);

  const [goalWeightKg, setGoalWeightKg] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState("");
  const [baselineDate, setBaselineDate] = useState("");
  const [saved, setSaved] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isSyncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setGoalWeightKg(String(settings.goalWeightKg));
    setGoalDate(settings.goalDate);
    setDailyCalorieTarget(String(settings.dailyCalorieTarget));
    setBaselineDate(settings.baselineDate ?? "");
  }, [settings]);

  const handleSave = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    await updateSettings({
      goalWeightKg: Number(goalWeightKg),
      goalDate,
      dailyCalorieTarget: Number(dailyCalorieTarget),
      baselineDate: baselineDate || undefined,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const outcome = await runSync();
      setSyncMessage(syncOutcomeMessage(outcome));
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = async () => {
    const data = await exportBackupData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifelog-backup-${data.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImportError(null);
    try {
      const data = JSON.parse(await file.text()) as BackupData;
      if (!Array.isArray(data.weightRecords) || !Array.isArray(data.mealRecords) || !data.settings) {
        throw new Error("invalid backup format");
      }
      await importBackupData(data);
    } catch {
      setImportError("ファイルの読み込みに失敗しました。エクスポートしたJSONファイルを選択してください。");
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-28 pt-6">
      <h1 className="font-rounded text-xl font-bold text-ink">設定</h1>

      <form onSubmit={handleSave} className="flex flex-col gap-3 rounded-card bg-white p-4 shadow-soft">
        <h2 className="text-sm font-medium text-muted">目標</h2>
        <label className="flex flex-col gap-1 text-sm text-ink">
          目標体重(kg)
          <input
            type="number"
            step="0.1"
            value={goalWeightKg}
            onChange={(e) => setGoalWeightKg(e.target.value)}
            className="rounded-card border border-black/10 px-3 py-2 font-rounded text-lg focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          目標日
          <input
            type="date"
            value={goalDate}
            onChange={(e) => setGoalDate(e.target.value)}
            className="rounded-card border border-black/10 px-3 py-2 focus:border-primary focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          基準日(進捗バーの起点)
          <input
            type="date"
            value={baselineDate}
            onChange={(e) => setBaselineDate(e.target.value)}
            className="rounded-card border border-black/10 px-3 py-2 focus:border-primary focus:outline-none"
          />
          <span className="text-xs text-muted">未設定の場合、一番古い体重記録を起点にします</span>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          1日の目標摂取カロリー(kcal)
          <input
            type="number"
            value={dailyCalorieTarget}
            onChange={(e) => setDailyCalorieTarget(e.target.value)}
            className="rounded-card border border-black/10 px-3 py-2 font-rounded text-lg focus:border-primary focus:outline-none"
          />
        </label>
        <button type="submit" className="rounded-card bg-primary px-4 py-3 font-medium text-white">
          {saved ? "保存しました" : "保存する"}
        </button>
      </form>

      <section className="flex flex-col gap-3 rounded-card bg-white p-4 shadow-soft">
        <h2 className="text-sm font-medium text-muted">データ同期(スプレッドシート書き出し)</h2>
        <div className="flex items-center justify-between text-sm text-ink">
          <span className="text-muted">最終同期</span>
          <span>{settings?.lastSyncedAt ? formatDateTime(settings.lastSyncedAt) : "未同期"}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-ink">
          <span className="text-muted">未同期の記録</span>
          <span>{unsyncedCount ?? "-"}件</span>
        </div>
        <button
          type="button"
          onClick={handleSyncNow}
          disabled={isSyncing}
          className="rounded-card bg-secondary px-4 py-3 font-medium text-white disabled:opacity-60"
        >
          {isSyncing ? "同期中..." : "今すぐ同期"}
        </button>
        {syncMessage && <p className="text-sm text-muted">{syncMessage}</p>}
      </section>

      <section className="flex flex-col gap-3 rounded-card bg-white p-4 shadow-soft">
        <h2 className="text-sm font-medium text-muted">バックアップ</h2>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-card bg-primary px-4 py-3 font-medium text-white"
        >
          JSONエクスポート
        </button>
        <label className="cursor-pointer rounded-card border border-primary px-4 py-3 text-center font-medium text-primary">
          JSONインポート
          <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
        </label>
        {importError && <p className="text-sm text-primary">{importError}</p>}
      </section>
    </div>
  );
}
