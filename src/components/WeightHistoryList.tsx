import { formatMonthDay } from "../lib/date";
import type { WeightRecord } from "../types";

interface WeightHistoryListProps {
  records: WeightRecord[];
  onSelect: (date: string) => void;
}

export default function WeightHistoryList({ records, onSelect }: WeightHistoryListProps) {
  return (
    <section className="rounded-card bg-white p-2 shadow-soft">
      {records.length === 0 ? (
        <p className="p-4 text-center text-sm text-muted">記録がありません</p>
      ) : (
        <ul className="divide-y divide-black/5">
          {records.map((record) => (
            <li key={record.id}>
              <button
                type="button"
                onClick={() => onSelect(record.date)}
                className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
              >
                <div className="flex flex-col">
                  <span className="text-xs text-muted">{formatMonthDay(record.date)}</span>
                  {record.note && <span className="text-xs text-muted">{record.note}</span>}
                </div>
                <div className="flex items-baseline gap-3 font-rounded">
                  <span className="text-lg font-bold text-ink">{record.weightKg}kg</span>
                  <span className="w-12 text-right text-sm text-muted">
                    {record.bodyFatPercent !== undefined ? `${record.bodyFatPercent}%` : "-"}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
