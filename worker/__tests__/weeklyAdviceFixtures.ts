/**
 * WeeklyDigestの代表フィクスチャ(AIコンサルティング設計書6章)。
 * プロンプト・モデルを変更したときは、この全パターンを実際にAPIへ流して出力を目視確認する。
 * 自動テスト(weeklyAdvice.test.ts)では、スキーマ検証とハンドラの挙動確認の入力に使う。
 * 形はsrc/types.tsのWeeklyDigestと同じ(Workerはクライアントのコードをimportしない方針のためobjectとして持つ)。
 */

const base = {
  period: { start: "2026-07-06", end: "2026-07-12" },
  goal: { targetWeightKg: 64, targetDate: "2026-10-31", remainingDays: 110 },
  weight: {
    weekAvgKg: 71.4,
    prevWeekAvgKg: 71.9,
    weeklyChangeKg: -0.5,
    projectedKg: 63.5,
    requiredWeeklyPaceKg: -0.47,
    paceBaseKg: 71.4,
  },
  calories: {
    avgIntakeKcal: 1850,
    targetKcal: 1900,
    daysOnTarget: 5,
    recordedDays: 7,
    estimatedTdeeKcal: 2400,
    bmrKcal: 1639,
  },
  pfc: {
    avgProteinG: 121.1,
    avgFatG: 54,
    avgCarbsG: 194.3,
    targetProteinG: 130,
    targetFatG: 53,
    targetCarbsG: 230,
  },
  recording: { recordedDays: 7, currentStreakDays: 12 },
  flags: [] as string[],
  mood: { good: 3, normal: 2, bad: 1 },
};

/** 順調な週: 全記録・ペースどおり・フラグ無し → on_track想定 */
export const digestOnTrack = structuredClone(base);

/** 停滞週: 体重が減らずペース不足 → behind想定 */
export const digestStalled = {
  ...structuredClone(base),
  weight: { ...base.weight, weekAvgKg: 71.9, weeklyChangeKg: 0.0, projectedKg: 66.2 },
  flags: ["BEHIND_PACE"],
};

/** 記録サボり週: 記録3日 → slightly_behind想定 */
export const digestLowRecording = {
  ...structuredClone(base),
  calories: { ...base.calories, avgIntakeKcal: 1900, recordedDays: 2, daysOnTarget: 1 },
  recording: { recordedDays: 3, currentStreakDays: 0 },
  flags: ["LOW_RECORDING_RATE"],
  mood: { good: 0, normal: 1, bad: 2 },
};

/** ペース超過(危険)週: 減りすぎ+摂取が基礎代謝未満 → needs_attention想定 */
export const digestTooAggressive = {
  ...structuredClone(base),
  weight: { ...base.weight, weekAvgKg: 70.8, weeklyChangeKg: -1.1 },
  calories: { ...base.calories, avgIntakeKcal: 1450, daysOnTarget: 7 },
  flags: ["PACE_TOO_AGGRESSIVE", "INTAKE_BELOW_BMR"],
};

/** データ不足週(利用開始直後): 体重・食事ともほぼ無し → slightly_behind想定 */
export const digestInsufficientData = {
  ...structuredClone(base),
  weight: {
    weekAvgKg: null,
    prevWeekAvgKg: null,
    weeklyChangeKg: null,
    projectedKg: null,
    requiredWeeklyPaceKg: 0,
    paceBaseKg: null,
  },
  calories: {
    avgIntakeKcal: null,
    targetKcal: 1900,
    daysOnTarget: 0,
    recordedDays: 0,
    estimatedTdeeKcal: null,
    bmrKcal: null,
  },
  pfc: {
    avgProteinG: null,
    avgFatG: null,
    avgCarbsG: null,
    targetProteinG: null,
    targetFatG: null,
    targetCarbsG: null,
  },
  recording: { recordedDays: 1, currentStreakDays: 1 },
  flags: ["LOW_RECORDING_RATE", "NO_WEIGHT_DATA", "INSUFFICIENT_DATA"],
  mood: undefined,
};

export const allDigestFixtures = {
  digestOnTrack,
  digestStalled,
  digestLowRecording,
  digestTooAggressive,
  digestInsufficientData,
};
