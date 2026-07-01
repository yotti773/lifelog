interface PfcSummaryProps {
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export default function PfcSummary({ proteinG, fatG, carbsG }: PfcSummaryProps) {
  return (
    <div className="flex items-center justify-center gap-4 rounded-card bg-white p-3 text-sm shadow-soft">
      <span className="text-ink">
        <span className="text-muted">P</span> <span className="font-rounded font-bold">{proteinG}g</span>
      </span>
      <span className="text-ink">
        <span className="text-muted">F</span> <span className="font-rounded font-bold">{fatG}g</span>
      </span>
      <span className="text-ink">
        <span className="text-muted">C</span> <span className="font-rounded font-bold">{carbsG}g</span>
      </span>
    </div>
  );
}
