import { useNavigate } from "react-router-dom";

interface ActionSheetProps {
  onClose: () => void;
}

const ACTIONS = [
  { to: "/record/weight", label: "体重を記録", icon: "⚖️" },
  { to: "/record/meal", label: "食事を記録", icon: "🍽️" },
];

export default function ActionSheet({ onClose }: ActionSheetProps) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/30" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-card bg-background p-4 pb-8 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-black/10" />
        <ul className="flex flex-col gap-2">
          {ACTIONS.map((action) => (
            <li key={action.to}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-card bg-white px-4 py-3.5 text-left shadow-soft transition active:scale-[0.98]"
                onClick={() => {
                  onClose();
                  navigate(action.to);
                }}
              >
                <span className="text-xl">{action.icon}</span>
                <span className="font-medium text-ink">{action.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
