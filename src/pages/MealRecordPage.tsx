import { useState, type ChangeEvent, type SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import { judgeMealPhoto, type MealJudgment } from "../api/judgeMeal";
import { addMealRecord } from "../db/mealRecords";
import { nearestMealType, toDatetimeLocalValue } from "../lib/date";
import type { MealType } from "../types";

const MEAL_OPTIONS: { type: MealType; label: string }[] = [
  { type: "breakfast", label: "朝食" },
  { type: "lunch", label: "昼食" },
  { type: "dinner", label: "夕食" },
  { type: "snack", label: "間食" },
];

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

  const [isJudging, setJudging] = useState(false);
  const [judgeError, setJudgeError] = useState<string | null>(null);
  const [aiJudgment, setAiJudgment] = useState<MealJudgment | null>(null);

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
      const judgment = await judgeMealPhoto(file, mealType);
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

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (
      name.trim() === "" ||
      kcal === "" ||
      proteinG === "" ||
      fatG === "" ||
      carbsG === "" ||
      Number.isNaN(parsedKcal) ||
      Number.isNaN(parsedProteinG) ||
      Number.isNaN(parsedFatG) ||
      Number.isNaN(parsedCarbsG)
    ) {
      setError("料理名・カロリー・PFC(たんぱく質/脂質/炭水化物)を入力してください");
      return;
    }
    await addMealRecord({
      mealType,
      confirmedName: name.trim(),
      confirmedKcal: parsedKcal,
      confirmedProteinG: parsedProteinG,
      confirmedFatG: parsedFatG,
      confirmedCarbsG: parsedCarbsG,
      timestamp: new Date(dateTime).toISOString(),
      aiEstimatedName: aiJudgment?.dishName,
      aiEstimatedKcal: aiJudgment?.kcal,
      aiEstimatedProteinG: aiJudgment?.proteinG,
      aiEstimatedFatG: aiJudgment?.fatG,
      aiEstimatedCarbsG: aiJudgment?.carbsG,
    });
    navigate("/");
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-10 pt-6">
      <h1 className="font-rounded text-xl font-bold text-ink">食事を記録</h1>

      <section className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-soft">
        <label className="cursor-pointer rounded-card bg-secondary px-4 py-3 text-center font-medium text-white">
          {isJudging ? "判定中..." : "写真から判定する"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoSelected}
            disabled={isJudging}
            className="hidden"
          />
        </label>
        {judgeError && <p className="text-sm text-primary">{judgeError}</p>}
        {aiJudgment?.isMixedOrUncertain && (
          <p className="text-xs text-muted">
            複数の料理が写っている、または判定に自信が低いため、誤差が大きい場合があります。下の内容を確認・修正してください。
          </p>
        )}
      </section>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card bg-white p-4 shadow-soft">
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
        {error && <p className="text-sm text-primary">{error}</p>}
        <button type="submit" className="rounded-card bg-primary px-4 py-3 font-medium text-white">
          保存する
        </button>
      </form>
    </div>
  );
}
