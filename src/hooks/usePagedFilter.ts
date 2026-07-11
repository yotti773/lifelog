import { useState } from "react";

/**
 * 名前検索+ページ分割の共通ロジック(食事マスタ・種目マスタ・マスタピッカーで共用。Issue #59)。
 * - 検索文字列を変えると先頭ページに戻る
 * - フィルタ結果が減ってページが範囲外になった場合は最終ページに丸める
 */
export function usePagedFilter<T>(items: T[], getSearchText: (item: T) => string, pageSize: number) {
  const [query, setQueryState] = useState("");
  const [page, setPage] = useState(0);

  const trimmedQuery = query.trim();
  const filtered = trimmedQuery ? items.filter((item) => getSearchText(item).includes(trimmedQuery)) : items;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = filtered.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  const setQuery = (value: string) => {
    setQueryState(value);
    setPage(0);
  };

  /** 絞り込みを解除して先頭ページへ戻す(手動追加直後に一覧で見つけやすくするための導線) */
  const reset = () => {
    setQueryState("");
    setPage(0);
  };

  return { query, setQuery, page: currentPage, setPage, pageCount, filtered, pageItems, reset };
}
