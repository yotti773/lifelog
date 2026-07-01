interface GoalBarProps {
  startWeightKg: number;
  currentWeightKg: number;
  goalWeightKg: number;
  goalDate: string; // YYYY-MM-DD
}

function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86_400_000));
}

export default function GoalBar({ startWeightKg, currentWeightKg, goalWeightKg, goalDate }: GoalBarProps) {
  const total = startWeightKg - goalWeightKg;
  const progressed = startWeightKg - currentWeightKg;
  const ratio = total > 0 ? Math.min(1, Math.max(0, progressed / total)) : 0;
  const achieved = currentWeightKg <= goalWeightKg;
  const remainingDays = daysUntil(goalDate);
  const [month, day] = goalDate.split("-").slice(1);

  return (
    <div className="rounded-card bg-white p-4 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="font-rounded text-lg font-bold text-ink">{startWeightKg}kg</span>
        <div className="relative h-3 flex-1 rounded-full bg-background">
          <div
            className={`h-3 rounded-full transition-all ${achieved ? "bg-accent" : "bg-secondary"}`}
            style={{ width: `${ratio * 100}%` }}
          />
          <div
            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white bg-ink shadow"
            style={{ left: `calc(${ratio * 100}% - 8px)` }}
          />
        </div>
        <span className="font-rounded text-lg font-bold text-ink">{goalWeightKg}kg</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-muted">
        <span>現在値 {currentWeightKg}kg</span>
        <span>
          {Number(month)}/{Number(day)}まであと{remainingDays}日
        </span>
      </div>
    </div>
  );
}
