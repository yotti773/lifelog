import { useState, type ChangeEvent, type SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { judgeMealPhoto, type MealJudgment } from "../api/judgeMeal";
import FoodMasterPicker from "../components/FoodMasterPicker";
import { addFoodMasterItem, getAllFoodMasterItems } from "../db/foodMaster";
import { addMealRecord } from "../db/mealRecords";
import { nearestMealType, toDatetimeLocalValue } from "../lib/date";
import type { FoodMasterItem, MealType } from "../types";

const MEAL_OPTIONS: { type: MealType; label: string }[] = [
  { type: "breakfast", label: "朝食" },
  { type: "lunch", label: "昼食" },
  { type: "dinner", label: "夕食" },
  { type: "snack", label: "間食" },
];

interface PendingMealItem {
  name: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  aiEstimatedName?: string;
  aiEstimatedKcal?: number;
  aiEstimatedProteinG?: number;
  aiEstimatedFatG?: number;
  aiEstimatedCarbsG?: number;
  registerToMaster: boolean;
}

export default function MealRecordPage() {
  const navigate = useNavigate();
  const [mealType, setMealType] = useState<MealType>(() => nearestMealType());
  const [dateTime, setDateTime] = useState(() => toDatetimeLocalValue(new Date().toISOString()));
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [fatG, setFatG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [isJudging, setJudging] = useState(false);
  const [judgeError, setJudgeError] = useState<string | null>(null);
  const [aiJudgment, setAiJudgment] = useState<MealJudgment | null>(null);
  const [registerToMaster, setRegisterToMaster] = useState(false);
  const [pendingItems, setPendingItems] = useState<PendingMealItem[]>([]);

  const foodMasterItems = useLiveQuery(() => getAllFoodMasterItems(), []);

  const parsedKcal = Number(kcal);
  const parsedProteinG = Number(proteinG);
  const parsedFatG = Number(fatG);
  const parsedCarbsG = Number(carbsG);

  const handlePhotoSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setJudging(true);
    setJudgeError(null);
    try {
      const judgment = await judgeMealPhoto(file, mealType, note);
      setAiJudgment(judgment);
      setName(judgment.dishName);
      setKcal(String(Math.round(judgment.kcal)));
      setProteinG(String(Math.round(judgment.proteinG)));
      setFatG(String(Math.round(judgment.fatG)));
      setCarbsG(String(Math.round(judgment.carbsG)));
    } catch (err) {
      setJudgeError(err instanceof Error ? err.message : "食事の判定に失敗しました");
    } finally {
      setJudging(false);
    }
  };

  const handleSelectMaster = (item: FoodMasterItem) => {
    setAiJudgment(null);
    setName(item.name);
    setKcal(String(item.kcal));
    setProteinG(String(item.proteinG));
    setFatG(String(item.fatG));
    setCarbsG(String(item.carbsG));
  };

  const isCurrentItemFilled =
    name.trim() !== "" && kcal !== "" && proteinG !== "" && fatG !== "" && carbsG !== "";

  const buildCurrentItem = (): PendingMealItem | null => {
    if (
      !isCurrentItemFilled ||
      Number.isNaN(parsedKcal) ||
      Number.isNaN(parsedProteinG) ||
      Number.isNaN(parsedFatG) ||
      Number.isNaN(parsedCarbsG)
    ) {
      return null;
    }
    return {
      name: name.trim(),
      kcal: parsedKcal,
      proteinG: parsedProteinG,
      fatG: parsedFatG,
      carbsG: parsedCarbsG,
      aiEstimatedName: aiJudgment?.dishName,
      aiEstimatedKcal: aiJudgment?.kcal,
      aiEstimatedProteinG: aiJudgment?.proteinG,
      aiEstimatedFatG: aiJudgment?.fatG,
      aiEstimatedCarbsG: aiJudgment?.carbsG,
      registerToMaster,
    };
  };

  const resetItemFields = () => {
    setName("");
    setKcal("");
    setProteinG("");
    setFatG("");
    setCarbsG("");
    setNote("");
    setAiJudgment(null);
    setRegisterToMaster(false);
  };

  const handleAddToList = () => {
    const item = buildCurrentItem();
    if (!item) {
      setError("料理名・カロリー・PFC(たんぱく質/脂質/炭水化物)を入力してください");
      return;
    }
    setPendingItems((prev) => [...prev, item]);
    resetItemFields();
    setError(null);
  };

  const handleRemovePending = (index: number) => {
    setPendingItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const currentItem = buildCurrentItem();
    const items = currentItem ? [...pendingItems, currentItem] : pendingItems;
    if (items.length === 0) {
      setError("料理名・カロリー・PFC(たんぱく質/脂質/炭水化物)を入力してください");
      return;
    }
    for (const item of items) {
      await addMealRecord({
        mealType,
        confirmedName: item.name,
        confirmedKcal: item.kcal,
        confirmedProteinG: item.proteinG,
        confirmedFatG: item.fatG,
        confirmedCarbsG: item.carbsG,
        timestamp: new Date(dateTime).toISOString(),
        aiEstimatedName: item.aiEstimatedName,
        aiEstimatedKcal: item.aiEstimatedKcal,
        aiEstimatedProteinG: item.aiEstimatedProteinG,
        aiEstimatedFatG: item.aiEstimatedFatG,
        aiEstimatedCarbsG: item.aiEstimatedCarbsG,
      });
      if (item.registerToMaster) {
        await addFoodMasterItem({
          name: item.name,
          kcal: item.kcal,
          proteinG: item.proteinG,
          fatG: item.fatG,
          carbsG: item.carbsG,
        });
      }
    }
    navigate("/");
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-10 pt-6">
      <h1 className="font-rounded text-xl font-bold text-ink">食事を記録</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <section className="flex flex-col gap-4 rounded-card bg-white p-4 shadow-soft">
          <div className="flex flex-col gap-1 text-sm text-ink">
            区分
            <div className="flex gap-2">
              {MEAL_OPTIONS.map((option) => (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => setMealType(option.type)}
                  className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                    mealType === option.type ? "bg-primary text-white" : "bg-background text-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm text-ink">
            日時
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="rounded-card border border-black/10 px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            料理名
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 鶏肉と野菜炒め"
              className="rounded-card border border-black/10 px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            カロリー(kcal)
            <input
              type="number"
              inputMode="numeric"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              placeholder="580"
              className="rounded-card border border-black/10 px-3 py-2 font-rounded text-2xl focus:border-primary focus:outline-none"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1 text-sm text-ink">
              P(g)
              <input
                type="number"
                inputMode="numeric"
                value={proteinG}
                onChange={(e) => setProteinG(e.target.value)}
                placeholder="40"
                className="rounded-card border border-black/10 px-3 py-2 focus:border-primary focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              F(g)
              <input
                type="number"
                inputMode="numeric"
                value={fatG}
                onChange={(e) => setFatG(e.target.value)}
                placeholder="20"
                className="rounded-card border border-black/10 px-3 py-2 focus:border-primary focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              C(g)
              <input
                type="number"
                inputMode="numeric"
                value={carbsG}
                onChange={(e) => setCarbsG(e.target.value)}
                placeholder="50"
                className="rounded-card border border-black/10 px-3 py-2 focus:border-primary focus:outline-none"
              />
            </label>
          </div>
        </section>

        <section className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-soft">
          <h2 className="text-sm font-medium text-muted">写真から記録する</h2>
          <label className="flex flex-col gap-1 text-sm text-ink">
            補足情報(任意)
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例: 唐揚げ弁当、ご飯少なめ / サラダとスープも別皿である"
              className="rounded-card border border-black/10 px-3 py-2 focus:border-primary focus:outline-none"
            />
          </label>
          <label className="cursor-pointer rounded-card bg-secondary px-4 py-3 text-center font-medium text-white">
            {isJudging ? "判定中..." : "写真から判定する"}
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoSelected}
              disabled={isJudging}
              className="hidden"
            />
          </label>
          {judgeError && <p className="text-sm text-primary">{judgeError}</p>}
          {aiJudgment?.isMixedOrUncertain && (
            <p className="text-xs text-muted">
              複数の料理が写っている、または判定に自信が低いため、誤差が大きい場合があります。上の内容を確認・修正してください。
            </p>
          )}
        </section>

        <section className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-soft">
          <h2 className="text-sm font-medium text-muted">よく食べるものから選ぶ</h2>
          <FoodMasterPicker items={foodMasterItems ?? []} onSelect={handleSelectMaster} />
        </section>

        {pendingItems.length > 0 && (
          <section className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-soft">
            <h2 className="text-sm font-medium text-muted">今回まとめて記録する品目({pendingItems.length}件)</h2>
            <ul className="flex flex-col gap-1">
              {pendingItems.map((item, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between gap-2 rounded-card bg-background px-3 py-2 text-sm text-ink"
                >
                  <span>
                    {item.name}({item.kcal}kcal)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemovePending(index)}
                    className="text-xs text-primary"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-4 rounded-card bg-white p-4 shadow-soft">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={registerToMaster}
              onChange={(e) => setRegisterToMaster(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            この内容をマスタに登録する(次回から選んで入力できるようになります)
          </label>
          {error && <p className="text-sm text-primary">{error}</p>}
          <button
            type="button"
            onClick={handleAddToList}
            className="rounded-card border border-primary px-4 py-3 font-medium text-primary"
          >
            この品目をリストに追加してもう1品記録する
          </button>
          <button type="submit" className="rounded-card bg-primary px-4 py-3 font-medium text-white">
            {pendingItems.length > 0
              ? `まとめて保存する(${pendingItems.length + (isCurrentItemFilled ? 1 : 0)}件)`
              : "保存する"}
          </button>
        </section>
      </form>
    </div>
  );
}
