import { useState } from "react";
import type { FoodMasterItem } from "../types";

interface FoodMasterPickerProps {
  items: FoodMasterItem[];
  onSelect: (item: FoodMasterItem) => void;
}

const PAGE_SIZE = 6;

export default function FoodMasterPicker({ items, onSelect }: FoodMasterPickerProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  if (items.length === 0) {
    return (
      <p className="text-xs text-muted">
        まだ登録済みの品目がありません。写真判定や手入力で記録するときに「マスタに登録する」を選ぶと、次回からここで選べるようになります。
      </p>
    );
  }

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(0);
  };

  const filtered = query.trim() ? items.filter((item) => item.name.includes(query.trim())) : items;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        placeholder="品目名で検索"
        className="rounded-card border border-black/10 px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
      <ul className="flex flex-col gap-1">
        {pageItems.map((item) => (
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
      {pageCount > 1 && (
        <div className="flex items-center justify-between text-xs text-muted">
          <button
            type="button"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 0}
            className="rounded-full px-2 py-1 font-medium disabled:opacity-30"
          >
            ‹ 前へ
          </button>
          <span>
            {currentPage + 1} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === pageCount - 1}
            className="rounded-full px-2 py-1 font-medium disabled:opacity-30"
          >
            次へ ›
          </button>
        </div>
      )}
    </div>
  );
}
