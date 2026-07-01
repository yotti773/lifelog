interface CalorieProgressBarProps {
  consumedKcal: number;
  targetKcal: number;
}

export default function CalorieProgressBar({ consumedKcal, targetKcal }: CalorieProgressBarProps) {
  const ratio = targetKcal > 0 ? Math.min(1, consumedKcal / targetKcal) : 0;
  const remaining = targetKcal - consumedKcal;

  return (
    <div className="rounded-card bg-white p-4 shadow-soft">
      <div className="flex items-baseline justify-between">
        <span className="font-body text-sm text-muted">今日の摂取カロリー</span>
        <span className="font-rounded text-2xl font-bold text-ink">
          {consumedKcal.toLocaleString()}
          <span className="ml-1 text-sm font-normal text-muted">/ {targetKcal.toLocaleString()}kcal</span>
        </span>
      </div>
      <div className="mt-3 h-5 w-full rounded-full bg-background">
        <div
          className="h-5 rounded-full bg-secondary transition-all"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <p className="mt-2 text-right text-xs text-muted">
        {remaining >= 0 ? `あと${remaining.toLocaleString()}kcal食べられます` : `${Math.abs(remaining).toLocaleString()}kcalオーバーしています`}
      </p>
    </div>
  );
}
