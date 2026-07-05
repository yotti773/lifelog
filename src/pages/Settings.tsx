import { useEffect, useState, type ChangeEvent, type SubmitEvent } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { exportBackupData, importBackupData, type BackupData } from "../db/backup";
import { bulkAddFoodMasterItems, deleteFoodMasterItem, getAllFoodMasterItems, updateFoodMasterItem } from "../db/foodMaster";
import { foodMasterSeedData } from "../db/foodMasterSeedData";
import { getUnsyncedMealRecords } from "../db/mealRecords";
import { getSettings, updateSettings } from "../db/settings";
import { getUnsyncedWeightRecords } from "../db/weightRecords";
import { formatDateTime } from "../lib/date";
import { runSync, type SyncOutcome } from "../sync/syncEngine";
import { workerSheetsTransport } from "../sync/workerSheetsTransport";
import type { FoodMasterItem } from "../types";

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

  const foodMasterItems = useLiveQuery(() => getAllFoodMasterItems(), []);
  const [editingMasterId, setEditingMasterId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKcal, setEditKcal] = useState("");
  const [editProteinG, setEditProteinG] = useState("");
  const [editFatG, setEditFatG] = useState("");
  const [editCarbsG, setEditCarbsG] = useState("");
  const [isSeeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

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
      const outcome = await runSync({ transport: workerSheetsTransport });
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

  const startEditMaster = (item: FoodMasterItem) => {
    setEditingMasterId(item.id);
    setEditName(item.name);
    setEditKcal(String(item.kcal));
    setEditProteinG(String(item.proteinG));
    setEditFatG(String(item.fatG));
    setEditCarbsG(String(item.carbsG));
  };

  const cancelEditMaster = () => setEditingMasterId(null);

  const handleSeedMaster = async () => {
    setSeeding(true);
    setSeedMessage(null);
    try {
      const count = await bulkAddFoodMasterItems(foodMasterSeedData);
      setSeedMessage(
        count > 0 ? `${count}件を登録しました` : "追加できる新しい品目はありませんでした(すべて登録済みです)",
      );
    } finally {
      setSeeding(false);
    }
  };

  const saveEditMaster = async () => {
    if (!editingMasterId) return;
    await updateFoodMasterItem(editingMasterId, {
      name: editName.trim(),
      kcal: Number(editKcal),
      proteinG: Number(editProteinG),
      fatG: Number(editFatG),
      carbsG: Number(editCarbsG),
    });
    setEditingMasterId(null);
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
        <h2 className="text-sm font-medium text-muted">食事マスタ(よく食べるもの)</h2>
        <button
          type="button"
          onClick={handleSeedMaster}
          disabled={isSeeding}
          className="rounded-card border border-primary px-4 py-3 font-medium text-primary disabled:opacity-60"
        >
          {isSeeding ? "登録中..." : "モスバーガー・ミスタードーナツ・コンビニの定番メニューを登録"}
        </button>
        {seedMessage && <p className="text-sm text-muted">{seedMessage}</p>}
        {foodMasterItems === undefined ? (
          <p className="text-sm text-muted">読み込み中...</p>
        ) : foodMasterItems.length === 0 ? (
          <p className="text-sm text-muted">
            まだ登録がありません。食事記録の保存時に「マスタに登録する」を選ぶと追加されます。
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {foodMasterItems.map((item) =>
              editingMasterId === item.id ? (
                <li key={item.id} className="flex flex-col gap-2 rounded-card bg-background p-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="rounded-card border border-black/10 px-2 py-1 text-sm focus:border-primary focus:outline-none"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    <input
                      type="number"
                      value={editKcal}
                      onChange={(e) => setEditKcal(e.target.value)}
                      placeholder="kcal"
                      className="rounded-card border border-black/10 px-2 py-1 text-sm focus:border-primary focus:outline-none"
                    />
                    <input
                      type="number"
                      value={editProteinG}
                      onChange={(e) => setEditProteinG(e.target.value)}
                      placeholder="P"
                      className="rounded-card border border-black/10 px-2 py-1 text-sm focus:border-primary focus:outline-none"
                    />
                    <input
                      type="number"
                      value={editFatG}
                      onChange={(e) => setEditFatG(e.target.value)}
                      placeholder="F"
                      className="rounded-card border border-black/10 px-2 py-1 text-sm focus:border-primary focus:outline-none"
                    />
                    <input
                      type="number"
                      value={editCarbsG}
                      onChange={(e) => setEditCarbsG(e.target.value)}
                      placeholder="C"
                      className="rounded-card border border-black/10 px-2 py-1 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveEditMaster}
                      className="flex-1 rounded-card bg-primary px-3 py-1.5 text-sm font-medium text-white"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditMaster}
                      className="flex-1 rounded-card border border-black/10 px-3 py-1.5 text-sm text-muted"
                    >
                      キャンセル
                    </button>
                  </div>
                </li>
              ) : (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-card bg-background p-3"
                >
                  <div>
                    <p className="text-sm text-ink">{item.name}</p>
                    <p className="text-xs text-muted">
                      {item.kcal}kcal(P{item.proteinG}/F{item.fatG}/C{item.carbsG}g)
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEditMaster(item)}
                      className="rounded-card border border-black/10 px-3 py-1.5 text-xs text-ink"
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFoodMasterItem(item.id)}
                      className="rounded-card border border-primary px-3 py-1.5 text-xs text-primary"
                    >
                      削除
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
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
