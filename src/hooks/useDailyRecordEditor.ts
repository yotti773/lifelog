import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { resolveCameFromHistory, type RecordScreenOrigin } from "@/lib/historyNavigation";
import { toDatetimeLocalValue, todayDateString } from "@/lib/date";

export type LoadStatus = "idle" | "loading" | "loaded" | "not-found";

/**
 * 日付キーの記録画面(体重・血圧・周囲径)で共通の編集モード制御。
 *
 * 履歴確認画面(Trends)の行タップ、またはホーム画面のカードタップから ?date=YYYY-MM-DD 付きで
 * 遷移してきた場合、その日付の既存記録があれば編集モードになる。ホームからは当日の日付が渡ってくるが、
 * 当日分がまだ未記録のこともあるため、その場合は「見つかりません」ではなく新規入力として扱う。
 * 履歴確認画面の「記録を追加」から過去日を明示的に新規追加する場合は ?create=1 が付く(Issue #141)。
 * これが無いのに未記録日を開いた場合は、タップ後に別端末で削除された可能性があるとみなし
 * not-found にする。過去日への新規追加は時刻が分からないため正午固定にする(当日は現在時刻のまま)。
 */
export function useDailyRecordEditor<T extends { timestamp: string }>(
  getRecord: (date: string) => Promise<T | undefined>,
  onLoaded: (record: T) => void,
) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const editDate = searchParams.get("date");
  const isTodayParam = editDate === todayDateString();
  const createParam = searchParams.get("create") === "1";
  const [loadStatus, setLoadStatus] = useState<LoadStatus>(editDate ? "loading" : "idle");
  const [dateTime, setDateTime] = useState(() => toDatetimeLocalValue(new Date().toISOString()));

  useEffect(() => {
    if (!editDate) {
      setLoadStatus("idle");
      return;
    }
    let cancelled = false;
    setLoadStatus("loading");
    void getRecord(editDate).then((record) => {
      if (cancelled) return;
      if (!record) {
        if (!isTodayParam && !createParam) {
          setLoadStatus("not-found");
          return;
        }
        if (!isTodayParam) {
          setDateTime(toDatetimeLocalValue(new Date(`${editDate}T12:00:00`).toISOString()));
        }
        setLoadStatus("idle");
        return;
      }
      setDateTime(toDatetimeLocalValue(record.timestamp));
      onLoaded(record);
      setLoadStatus("loaded");
    });
    return () => {
      cancelled = true;
    };
    // getRecord/onLoadedは毎レンダー新しい参照になるため、共通化前の各画面と同じくeditDateだけを依存にする
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editDate]);

  const isEditing = loadStatus === "loaded";
  const selectedDate = dateTime.slice(0, 10);
  // 判定ロジック本体は純関数の `resolveCameFromHistory`(`src/lib/historyNavigation.ts`)を参照。
  // editDateが無い(?date=無しでこの画面を開いた)場合は今日扱いとし、フォールバック判定でホームへ倒す
  const stateFrom = (location.state as { from?: RecordScreenOrigin } | null)?.from;
  const cameFromHistory = resolveCameFromHistory(stateFrom, editDate === null || isTodayParam);

  const navigateToHistory = (historyKind?: string) =>
    navigate("/trends", { state: { viewMode: "history", ...(historyKind !== undefined && { historyKind }) } });

  const navigateAfterSave = (historyKind?: string) => {
    if (cameFromHistory) {
      navigateToHistory(historyKind);
    } else {
      navigate("/");
    }
  };

  return {
    editDate,
    isTodayParam,
    loadStatus,
    dateTime,
    setDateTime,
    isEditing,
    selectedDate,
    navigateAfterSave,
    navigateToHistory,
  };
}
