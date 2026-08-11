import { useLocation, useNavigate } from "react-router-dom";

type HistoryKind = "meal" | "water" | "strength" | "diary";

/**
 * 記録画面(食事・水分・筋トレ・日記)の保存・削除後の戻り先を決める。
 * 履歴確認画面の行タップからは `?date=` に加えて state `{ from: "history" }` が付く(TrendsPage参照)。
 * ホーム画面からの遷移や、stateが失われるページ再読み込み・直接URLアクセスでは state が無いため、
 * その場合は今までどおり当日か否か(ホームは常に当日、履歴の過去日タップは当日以外)でフォールバック判定する。
 */
export function useHistoryBackNavigation(historyKind: HistoryKind, isToday: boolean) {
  const navigate = useNavigate();
  const location = useLocation();
  const stateFrom = (location.state as { from?: "history" | "home" } | null)?.from;
  const cameFromHistory = stateFrom ? stateFrom === "history" : !isToday;

  return () =>
    cameFromHistory
      ? navigate("/trends", { state: { viewMode: "history", historyKind } })
      : navigate("/");
}
