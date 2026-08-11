/**
 * 記録画面の保存・削除後の戻り先判定(Issue #120)。
 *
 * 履歴確認画面からの遷移には navigate の state に `{ from: "history" }` が付く
 * (TrendsPage参照)。これがあれば、開いている日付が今日かどうかに関わらずその値を信頼する
 * — 履歴確認画面には今日の記録も表示されるため、日付だけでは「履歴から来たか」を判定できない。
 * ページ再読み込み・直接URLアクセスなど state が失われる場合だけ、今日より前の日付かどうかで
 * フォールバック判定する(ホーム画面は常に今日の日付で開くため、この場合は概ね正しく判定できる)。
 */
export type RecordScreenOrigin = "history" | "home" | undefined;

export function resolveCameFromHistory(stateFrom: RecordScreenOrigin, isToday: boolean): boolean {
  return stateFrom !== undefined ? stateFrom === "history" : !isToday;
}
