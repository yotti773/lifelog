import { useState, type SubmitEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { saveWeightRecord } from "../db/weightRecords";
import { toDatetimeLocalValue } from "../lib/date";

export default function WeightRecordPage() {
  const navigate = useNavigate();
  const [dateTime, setDateTime] = useState(() => toDatetimeLocalValue(new Date().toISOString()));
  const [weightKg, setWeightKg] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedDate = dateTime.slice(0, 10);
  const previous = useLiveQuery(
    () => db.weightRecords.where("date").below(selectedDate).last(),
    [selectedDate],
  );

  const parsedWeight = Number(weightKg);
  const diff =
    previous && weightKg !== "" && !Number.isNaN(parsedWeight) ? parsedWeight - previous.weightKg : null;

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (weightKg === "" || Number.isNaN(parsedWeight)) {
      setError("体重を入力してください");
      return;
    }
    await saveWeightRecord({
      date: selectedDate,
      weightKg: parsedWeight,
      note: note.trim() || undefined,
      timestamp: new Date(dateTime).toISOString(),
    });
    navigate("/");
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-10 pt-6">
      <h1 className="font-rounded text-xl font-bold text-ink">体重を記録</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card bg-white p-4 shadow-soft">
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
          体重(kg)
          <input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="72.0"
            className="rounded-card border border-black/10 px-3 py-2 font-rounded text-2xl focus:border-primary focus:outline-none"
          />
          {diff !== null && (
            <span className={`text-xs ${diff <= 0 ? "text-secondary" : "text-primary"}`}>
              前回比 {diff > 0 ? "+" : ""}
              {diff.toFixed(1)}kg
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          メモ(任意)
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="筋トレ後、飲み会翌日など"
            className="rounded-card border border-black/10 px-3 py-2 focus:border-primary focus:outline-none"
          />
        </label>
        {error && <p className="text-sm text-primary">{error}</p>}
        <button type="submit" className="rounded-card bg-primary px-4 py-3 font-medium text-white">
          保存する
        </button>
      </form>
    </div>
  );
}
