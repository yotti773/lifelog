import { useState } from "react";
import type { FoodMasterItem } from "../types";

interface FoodMasterPickerProps {
  items: FoodMasterItem[];
  onSelect: (item: FoodMasterItem) => void;
}

export default function FoodMasterPicker({ items, onSelect }: FoodMasterPickerProps) {
  const [query, setQuery] = useState("");

  if (items.length === 0) {
    return (
      <p className="text-xs text-muted">
        まだ登録済みの品目がありません。写真判定や手入力で記録するときに「マスタに登録する」を選ぶと、次回からここで選べるようになります。
      </p>
    );
  }

  const filtered = query.trim() ? items.filter((item) => item.name.includes(query.trim())) : items;

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="品目名で検索"
        className="rounded-card border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
      <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
        {filtered.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="flex w-full items-center justify-between rounded-card bg-background px-3 py-2 text-left text-sm text-ink transition active:scale-[0.98]"
            >
              <span>{item.name}</span>
              <span className="text-xs text-muted">{item.kcal}kcal</span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className="px-1 text-xs text-muted">該当する品目がありません</li>}
      </ul>
    </div>
  );
}
