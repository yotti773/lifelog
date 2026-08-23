/**
 * スプレッドシートに書き出すときの表示ラベル(Issue #215で `worker/` から移設)。
 *
 * **UIのラベル(`src/components/mealTypeMeta.tsx`・`MoodIcon.tsx`)とは意図的に分けている。**
 * シートの列はいったん書いたら過去の行が残り続けるため、画面上の文言を変えたからといって
 * 追随させると、同じ列に新旧の表記が混在する。シートの表記はここを唯一の正とする。
 * 取り込み(`sheetsImport.ts`)はこのラベルからレコードの値へ戻すため、両方向でこの表が正になる。
 */

export const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
};

export const DIARY_MOOD_LABELS: Record<string, string> = {
  great: "絶好調",
  good: "良い",
  ok: "普通",
  tired: "眠い",
  bad: "不調",
};
