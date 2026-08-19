import { formatMonthDay } from "./date";
import type { WeeklyDigest } from "@/types";

/**
 * SNS共有カード(Issue #235)の内容を組み立てる純関数。
 *
 * 「何を載せるか・どう丸めるか」の判断はすべてここで決定論的に行い、
 * 描画(src/lib/shareCardCanvas.ts)は出来上がったモデルを描くだけにする —
 * 週次レビュー(src/lib/weeklyDigest.ts)と同じく、数字を決める場所を1か所に閉じるため。
 */

/** カードに並べる数値の上限。横一列に収まる数(これ以上並べると縮小表示で読めない) */
export const MAX_SHARE_CARD_STATS = 4;

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export interface ShareCardStat {
  label: string;
  value: string;
  unit?: string;
  /** 目標値など、値の下に小さく添える補足 */
  sub?: string;
}

/** 主数値の右に置くバッジ(前週比・前回比)。toneは配色の指定で、減=teal / 増=coral */
export interface ShareCardBadge {
  text: string;
  tone: "down" | "up" | "flat";
}

export interface ShareCardModel {
  kind: "weekly" | "daily";
  title: string;
  period: string;
  /** 主数値。載せられる数字が1つも無ければnull(この場合は共有導線自体を出さない) */
  headline: { caption: string; value: string; unit: string } | null;
  badge: ShareCardBadge | null;
  stats: ShareCardStat[];
  /**
   * 伏せる前のカードが体重の実数を含むかどうか。
   * 「体重の数値を隠す」トグルを出すかの判定に使う(hideWeightValueの値に関わらず同じ結果になる)
   */
  hasWeightValue: boolean;
  /** 保存時のファイル名に使う日付(YYYY-MM-DD) */
  fileDate: string;
}

export interface ShareCardOptions {
  /**
   * 体重の実数を伏せる(前週比・前回比の変化量は残す)。
   * 公開の場に出す画像のため、体重そのものは出したくない場合に使う
   */
  hideWeightValue?: boolean;
}

/** 1,850 のように3桁区切りにする(toLocaleStringはロケール依存のため使わない) */
function formatInt(n: number): string {
  const rounded = Math.round(n);
  const sign = rounded < 0 ? "-" : "";
  return sign + Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 符号を必ず付けた小数(例: -0.42 / +0.15)。増減を1文字で判別できるようにするため */
function formatSigned(n: number, digits: number): string {
  const fixed = n.toFixed(digits);
  return n > 0 ? `+${fixed}` : fixed;
}

/** 体重の増減の配色。減量アプリのため「減った=teal(順調)」に寄せる(週次レビューの前週比チップと同じ) */
function weightTone(changeKg: number): ShareCardBadge["tone"] {
  if (changeKg < 0) return "down";
  if (changeKg > 0) return "up";
  return "flat";
}

/** YYYY-MM-DD → 「8月19日(火)」 */
function formatDayWithWeekday(date: string): string {
  const [, month, day] = date.split("-");
  const weekday = WEEKDAY_LABELS[new Date(`${date}T00:00:00`).getDay()];
  return `${Number(month)}月${Number(day)}日(${weekday})`;
}

/**
 * 週次レビューのWeeklyDigestから共有カードを組み立てる。
 * 主数値は「週平均体重 → 前週比 → 平均摂取 → 記録した日数」の順に、値のあるものを1つ選ぶ
 */
export function buildWeeklyShareCard(digest: WeeklyDigest, options: ShareCardOptions = {}): ShareCardModel {
  const hide = options.hideWeightValue === true;
  const { weight, calories, recording, activity, goal } = digest;

  let headline: ShareCardModel["headline"] = null;
  let badge: ShareCardBadge | null = null;
  const changeKg = weight.weeklyChangeKg;

  if (weight.weekAvgKg !== null && !hide) {
    headline = { caption: "週平均体重", value: weight.weekAvgKg.toFixed(1), unit: "kg" };
    badge = changeKg !== null ? { text: `前週比 ${formatSigned(changeKg, 2)}kg`, tone: weightTone(changeKg) } : null;
  } else if (changeKg !== null) {
    // 体重を伏せる場合、変化量だけは主数値として残す(「どれだけ動いたか」は伏せる必要が無いため)
    headline = { caption: "週平均体重の前週比", value: formatSigned(changeKg, 2), unit: "kg" };
  } else if (calories.avgIntakeKcal !== null) {
    headline = { caption: "1日の平均摂取", value: formatInt(calories.avgIntakeKcal), unit: "kcal" };
  } else if (recording.recordedDays > 0) {
    headline = { caption: "記録した日", value: `${recording.recordedDays}/7`, unit: "日" };
  }

  const stats: ShareCardStat[] = [];
  if (calories.avgIntakeKcal !== null && headline?.caption !== "1日の平均摂取") {
    stats.push({
      label: "平均摂取",
      value: formatInt(calories.avgIntakeKcal),
      unit: "kcal",
      sub: calories.targetKcal !== null ? `目標 ${formatInt(calories.targetKcal)}` : undefined,
    });
  }
  if (headline?.caption !== "記録した日") {
    stats.push({ label: "記録した日", value: `${recording.recordedDays}/7`, unit: "日" });
  }
  if (recording.currentStreakDays > 0) {
    stats.push({ label: "連続記録", value: String(recording.currentStreakDays), unit: "日" });
  }
  if (activity?.avgSteps != null) {
    stats.push({ label: "平均歩数", value: formatInt(activity.avgSteps), unit: "歩" });
  }
  // 目標までの残りは体重の差分そのもの。**体重を伏せる指定のときは出さない** —
  // 目標体重は公言していることが多く、差分から現在の体重が復元できてしまうため
  if (!hide && goal.targetWeightKg !== null && weight.paceBaseKg !== null) {
    const remainingKg = weight.paceBaseKg - goal.targetWeightKg;
    if (remainingKg > 0) stats.push({ label: "目標まで", value: remainingKg.toFixed(1), unit: "kg" });
  }
  if (calories.estimatedTdeeKcal !== null) {
    stats.push({ label: "実測TDEE", value: formatInt(calories.estimatedTdeeKcal), unit: "kcal" });
  }

  return {
    kind: "weekly",
    title: "この1週間の記録",
    period: `${formatMonthDay(digest.period.start)}(月) 〜 ${formatMonthDay(digest.period.end)}(日)`,
    headline,
    badge,
    stats: stats.slice(0, MAX_SHARE_CARD_STATS),
    hasWeightValue: weight.weekAvgKg !== null,
    fileDate: digest.period.start,
  };
}

/**
 * 日次カードの材料。ホーム画面が既に読み込んでいる当日分の値をそのまま渡す
 * (画面が持っているデータで作れる範囲に留め、カードのために追加のクエリを増やさない)
 */
export interface DailyShareSource {
  date: string;
  weightKg: number | null;
  /** その日より前の直近の体重記録(前回比の基準。無ければnull) */
  previousWeightKg: number | null;
  /** 食事記録が1件も無い日はnull(0kcalの日と区別する) */
  intakeKcal: number | null;
  targetKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  /** 水分の合計(記録が無ければnull) */
  waterMl: number | null;
  /** Garmin計測の歩数(当日分はまだ取り込まれていないことが多い) */
  steps: number | null;
  /** その日に記録した筋トレの種目数 */
  workoutExercises: number;
  streakDays: number;
}

/**
 * ホーム(当日)の記録から共有カードを組み立てる。
 * 主数値は「体重 → 前回比 → 摂取カロリー」の順に、値のあるものを1つ選ぶ
 */
export function buildDailyShareCard(src: DailyShareSource, options: ShareCardOptions = {}): ShareCardModel {
  const hide = options.hideWeightValue === true;
  const changeKg =
    src.weightKg !== null && src.previousWeightKg !== null
      ? Math.round((src.weightKg - src.previousWeightKg) * 100) / 100
      : null;

  let headline: ShareCardModel["headline"] = null;
  let badge: ShareCardBadge | null = null;
  if (src.weightKg !== null && !hide) {
    headline = { caption: "今日の体重", value: src.weightKg.toFixed(1), unit: "kg" };
    badge = changeKg !== null ? { text: `前回比 ${formatSigned(changeKg, 2)}kg`, tone: weightTone(changeKg) } : null;
  } else if (changeKg !== null) {
    headline = { caption: "体重の前回比", value: formatSigned(changeKg, 2), unit: "kg" };
  } else if (src.intakeKcal !== null) {
    headline = { caption: "今日の摂取", value: formatInt(src.intakeKcal), unit: "kcal" };
  }

  const stats: ShareCardStat[] = [];
  if (src.intakeKcal !== null && headline?.caption !== "今日の摂取") {
    stats.push({
      label: "摂取カロリー",
      value: formatInt(src.intakeKcal),
      unit: "kcal",
      sub: src.targetKcal !== null ? `目標 ${formatInt(src.targetKcal)}` : undefined,
    });
  }
  if (src.proteinG !== null && src.fatG !== null && src.carbsG !== null) {
    stats.push({
      label: "PFC",
      value: `${Math.round(src.proteinG)}/${Math.round(src.fatG)}/${Math.round(src.carbsG)}`,
      unit: "g",
    });
  }
  if (src.waterMl !== null && src.waterMl > 0) {
    stats.push({ label: "水分", value: formatInt(src.waterMl), unit: "ml" });
  }
  if (src.steps !== null) {
    stats.push({ label: "歩数", value: formatInt(src.steps), unit: "歩" });
  }
  if (src.workoutExercises > 0) {
    stats.push({ label: "筋トレ", value: String(src.workoutExercises), unit: "種目" });
  }
  if (src.streakDays > 0) {
    stats.push({ label: "連続記録", value: String(src.streakDays), unit: "日" });
  }

  return {
    kind: "daily",
    title: "今日の記録",
    period: formatDayWithWeekday(src.date),
    headline,
    badge,
    stats: stats.slice(0, MAX_SHARE_CARD_STATS),
    hasWeightValue: src.weightKg !== null,
    fileDate: src.date,
  };
}
