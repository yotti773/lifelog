import type { WeeklyAdvice } from "@/types";

const VERDICTS: WeeklyAdvice["verdict"][] = ["on_track", "slightly_behind", "behind", "needs_attention"];

/**
 * WorkerからのWeeklyAdviceレスポンスのスキーマ検証(Issue #12。AIコンサルティング設計書8章)。
 * Worker側でも検証済みだが、検証を通った値だけをIndexedDBへキャッシュするためクライアントでも行う。
 */
export function isWeeklyAdvice(value: unknown): value is WeeklyAdvice {
  if (typeof value !== "object" || value === null) return false;
  const advice = value as Partial<WeeklyAdvice>;
  const isNonEmptyStringArray = (v: unknown): v is string[] =>
    Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === "string" && s.trim() !== "");
  return (
    VERDICTS.includes(advice.verdict as WeeklyAdvice["verdict"]) &&
    typeof advice.summary === "string" &&
    advice.summary.trim() !== "" &&
    isNonEmptyStringArray(advice.wins) &&
    isNonEmptyStringArray(advice.actions)
  );
}
