export interface WeightPoint {
  date: string; // YYYY-MM-DD
  weightKg: number;
}

/**
 * 予測を表示するために必要な、起点→最新記録の最小日数スパン。
 * これ未満(記録が1〜2件しかない・期間が短すぎる)は傾きがノイズだらけで意味を持たないため予測しない。
 */
export const MIN_PROJECTION_SPAN_DAYS = 3;

/**
 * 目標日までの外挿日数が、観測スパンの何倍までなら予測を信頼するかの上限。
 * 例えば3日分の記録(短期的な水分変動レベルのノイズを含みうる)を4か月先まで外挿すると、
 * マイナス体重のような非現実的な値になりうる。観測スパンに対して外挿が長すぎる場合は
 * 表示しない(短いスパンで信頼できるのは、そのスパンの数倍先までの近い将来のみとする)。
 */
export const MAX_EXTRAPOLATION_RATIO = 5;

/** 2つのYYYY-MM-DDの日数差(end - start)。ローカル日付の0時基準で計算する。 */
function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();
  return Math.round((end - start) / 86_400_000);
}

/**
 * 起点→最新記録の2点の傾き(kg/日)から、targetDate時点の体重を線形予測する(簡易線形予測、Issue #25)。
 * 予測が意味を持たない場合はnullを返す:
 *  - 起点と最新のスパンが {@link MIN_PROJECTION_SPAN_DAYS} 日未満(記録が少ない/期間が短すぎる)
 *  - targetDateが最新記録より前(目標日を既に過ぎている等、外挿する意味がない)
 *  - targetDateまでの外挿日数が観測スパンの {@link MAX_EXTRAPOLATION_RATIO} 倍を超える
 *    (短いスパンのノイズを長期間に増幅させないため。詳細は定数のコメント参照)
 */
export function projectWeightAtDate(
  start: WeightPoint,
  latest: WeightPoint,
  targetDate: string,
): number | null {
  const spanDays = daysBetween(start.date, latest.date);
  if (spanDays < MIN_PROJECTION_SPAN_DAYS) return null;

  const daysToTarget = daysBetween(latest.date, targetDate);
  if (daysToTarget < 0) return null;
  if (daysToTarget > spanDays * MAX_EXTRAPOLATION_RATIO) return null;

  const slopePerDay = (latest.weightKg - start.weightKg) / spanDays;
  return latest.weightKg + slopePerDay * daysToTarget;
}
