import { useLocation, useNavigate } from "react-router-dom";
import { resolveCameFromHistory, type RecordScreenOrigin } from "@/lib/historyNavigation";

type HistoryKind = "meal" | "water" | "strength" | "diary";

/**
 * 記録画面(食事・水分・筋トレ・日記)の保存・削除後の戻り先を決める。
 * 判定ロジック本体は純関数の `resolveCameFromHistory`(`src/lib/historyNavigation.ts`)を参照。
 */
export function useHistoryBackNavigation(historyKind: HistoryKind, isToday: boolean) {
  const navigate = useNavigate();
  const location = useLocation();
  const stateFrom = (location.state as { from?: RecordScreenOrigin } | null)?.from;
  const cameFromHistory = resolveCameFromHistory(stateFrom, isToday);

  return () =>
    cameFromHistory
      ? navigate("/trends", { state: { viewMode: "history", historyKind } })
      : navigate("/");
}
