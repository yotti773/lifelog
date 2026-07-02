import { useEffect, useState, type SubmitEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { getWeightRecord, saveWeightRecord } from "../db/weightRecords";
import { toDatetimeLocalValue } from "../lib/date";

type LoadStatus = "idle" | "loading" | "loaded" | "not-found";

export default function WeightRecordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 履歴確認画面(Trends)の行タップから ?date=YYYY-MM-DD 付きで遷移してきた場合は編集モードになる
  const editDate = searchParams.get("date");
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(editDate ? "loading" : "idle");
  const [dateTime, setDateTime] = useState(() => toDatetimeLocalValue(new Date().toISOString()));
  const [weightKg, setWeightKg] = useState("");
  const [bodyFatPercent, setBodyFatPercent] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editDate) {
      setLoadStatus("idle");
      return;
    }
    let cancelled = false;
    setLoadStatus("loading");
    void getWeightRecord(editDate).then((record) => {
      if (cancelled) return;
      if (!record) {
        setLoadStatus("not-found");
        return;
      }
      setDateTime(toDatetimeLocalValue(record.timestamp));
      setWeightKg(String(record.weightKg));
      setBodyFatPercent(record.bodyFatPercent !== undefined ? String(record.bodyFatPercent) : "");
      setNote(record.note ?? "");
      setLoadStatus("loaded");
    });
    return () => {
      cancelled = true;
    };
  }, [editDate]);

  const isEditing = loadStatus === "loaded";
  const selectedDate = dateTime.slice(0, 10);
  const previous = useLiveQuery(
    () => db.weightRecords.where("date").below(selectedDate).last(),
    [selectedDate],
  );

  const parsedWeight = Number(weightKg);
  const diff =
    previous && weightKg !== "" && !Number.isNaN(parsedWeight) ? parsedWeight - previous.weightKg : null;

  const parsedBodyFatPercent = Number(bodyFatPercent);

  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (weightKg === "" || Number.isNaN(parsedWeight)) {
      setError("体重を入力してください");
      return;
    }
    if (bodyFatPercent !== "" && Number.isNaN(parsedBodyFatPercent)) {
      setError("体脂肪率は数値で入力してください");
      return;
    }
    await saveWeightRecord({
      date: selectedDate,
      weightKg: parsedWeight,
      bodyFatPercent: bodyFatPercent !== "" ? parsedBodyFatPercent : undefined,
      note: note.trim() || undefined,
      timestamp: new Date(dateTime).toISOString(),
    });
    navigate(editDate ? "/trends" : "/", editDate ? { state: { viewMode: "history" } } : undefined);
  };

  if (loadStatus === "loading") {
    return <div className="p-6 text-center text-sm text-muted">読み込み中...</div>;
  }

  if (loadStatus === "not-found") {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-10 pt-6">
        <h1 className="font-rounded text-xl font-bold text-ink">記録が見つかりません</h1>
        <p className="rounded-card bg-white p-4 text-sm text-muted shadow-soft">
          指定された日付の体重記録は見つかりませんでした。別の端末で削除された可能性があります。
        </p>
        <button
          type="button"
          onClick={() => navigate("/trends", { state: { viewMode: "history" } })}
          className="rounded-card bg-primary px-4 py-3 font-medium text-white"
        >
          履歴に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pb-10 pt-6">
      <h1 className="font-rounded text-xl font-bold text-ink">{isEditing ? "体重を編集" : "体重を記録"}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card bg-white p-4 shadow-soft">
        <label className="flex flex-col gap-1 text-sm text-ink">
          日時
          <input
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            disabled={isEditing}
            className="rounded-card border border-black/10 px-3 py-2 focus:border-primary focus:outline-none disabled:bg-background disabled:text-muted"
          />
          {isEditing && <span className="text-xs text-muted">日時は編集できません</span>}
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
          体脂肪率(%・任意)
          <input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={bodyFatPercent}
            onChange={(e) => setBodyFatPercent(e.target.value)}
            placeholder="24.5"
            className="rounded-card border border-black/10 px-3 py-2 font-rounded text-2xl focus:border-primary focus:outline-none"
          />
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
