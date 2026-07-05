import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import CalorieProgressBar from "../components/CalorieProgressBar";
import PfcSummary from "../components/PfcSummary";
import { db } from "../db/db";
import { getSettings } from "../db/settings";
import { formatTime, todayDateString } from "../lib/date";
import type { MealRecord, MealType } from "../types";

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
};
const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export default function Home() {
  const navigate = useNavigate();
  const today = todayDateString();

  const weight = useLiveQuery(() => db.weightRecords.get(today), [today]);
  const meals = useLiveQuery(
    () =>
      db.mealRecords
        .where("timestamp")
        .between(`${today}T00:00:00.000Z`, `${today}T23:59:59.999Z`, true, true)
        .sortBy("timestamp"),
    [today],
  );
  const settings = useLiveQuery(() => getSettings(), []);

  if (meals === undefined || settings === undefined) {
    return <div className="p-6 text-center text-sm text-muted">読み込み中...</div>;
  }

  const mealsByType = new Map<MealType, MealRecord[]>();
  for (const meal of meals) {
    const list = mealsByType.get(meal.mealType) ?? [];
    list.push(meal);
    mealsByType.set(meal.mealType, list);
  }

  const totalKcal = meals.reduce((sum, meal) => sum + meal.confirmedKcal, 0);
  const totalProteinG = meals.reduce((sum, meal) => sum + meal.confirmedProteinG, 0);
  const totalFatG = meals.reduce((sum, meal) => sum + meal.confirmedFatG, 0);
  const totalCarbsG = meals.reduce((sum, meal) => sum + meal.confirmedCarbsG, 0);

  const now = new Date();
  const weekday = WEEKDAY_LABELS[now.getDay()];

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-28 pt-6">
      <h1 className="font-rounded text-xl font-bold text-ink">
        {now.getMonth() + 1}/{now.getDate()}({weekday})
      </h1>

      <section className="rounded-card bg-white p-4 shadow-soft">
        <h2 className="mb-2 text-sm font-medium text-muted">体重</h2>
        {weight ? (
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-muted">{formatTime(weight.timestamp)}</span>
            <span className="font-rounded text-3xl font-bold text-ink">{weight.weightKg}kg</span>
            {weight.bodyFatPercent !== undefined && (
              <span className="font-rounded text-lg font-bold text-ink">
                体脂肪 {weight.bodyFatPercent}%
              </span>
            )}
          </div>
        ) : (
          <p className="text-muted">未記録</p>
        )}
      </section>

      <section className="rounded-card bg-white p-4 shadow-soft">
        <h2 className="mb-2 text-sm font-medium text-muted">食事</h2>
        <ul className="flex flex-col divide-y divide-black/5">
          {MEAL_ORDER.map((mealType) => {
            const items = mealsByType.get(mealType);
            const rowContent = (
              <>
                <span className="w-12 shrink-0 font-medium text-ink">{MEAL_LABELS[mealType]}</span>
                {!items ? (
                  <span className="flex-1 text-right text-muted">未記録</span>
                ) : items.length === 1 ? (
                  <>
                    <span className="text-xs text-muted">{formatTime(items[0].timestamp)}</span>
                    <span className="flex-1 truncate px-2 text-ink">{items[0].confirmedName}</span>
                    <span className="font-rounded font-bold text-ink">{items[0].confirmedKcal}kcal</span>
                  </>
                ) : (
                  <span className="font-rounded font-bold text-ink">
                    {items.reduce((sum, item) => sum + item.confirmedKcal, 0)}kcal
                  </span>
                )}
              </>
            );
            return (
              <li key={mealType} className="py-2 text-sm">
                {items && items.length === 1 ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/record/meal?id=${items[0].id}`)}
                    className="-mx-2 flex w-full items-center justify-between gap-2 rounded-lg px-2 py-0.5 text-left transition-colors hover:bg-primary/5"
                  >
                    {rowContent}
                  </button>
                ) : (
                  <div className="flex items-center justify-between gap-2">{rowContent}</div>
                )}
                {items && items.length > 1 && (
                  <ul className="mt-1 flex flex-col gap-0.5 pl-14 text-xs text-muted">
                    {items.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/record/meal?id=${item.id}`)}
                          className="-mx-1 flex w-full justify-between gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-primary/5"
                        >
                          <span className="truncate">
                            {formatTime(item.timestamp)} {item.confirmedName}
                          </span>
                          <span className="shrink-0">{item.confirmedKcal}kcal</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-center text-xs text-muted">品目をタップすると編集・削除できます</p>
      </section>

      <CalorieProgressBar consumedKcal={totalKcal} targetKcal={settings.dailyCalorieTarget} />
      <PfcSummary proteinG={totalProteinG} fatG={totalFatG} carbsG={totalCarbsG} />
    </div>
  );
}
