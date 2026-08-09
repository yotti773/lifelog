import { AI_REQUEST_TIMEOUT_MS, requestApi } from "@/api/request";
import { isWeeklyAdvice } from "@/lib/weeklyAdviceValidation";
import type { WeeklyAdvice, WeeklyDigest } from "@/types";

/**
 * Cloudflare Worker経由でAIコーチのコメント生成を依頼する(Issue #12)。
 * digestはコード側で計算済みのWeeklyDigestをそのまま送る(生レコードは送らない)。
 */
export async function requestWeeklyAdvice(digest: WeeklyDigest): Promise<WeeklyAdvice> {
  const advice = await requestApi<unknown>("/api/weekly-advice", {
    method: "POST",
    body: { digest },
    timeoutMs: AI_REQUEST_TIMEOUT_MS,
    fallbackErrorMessage: () => "コメントの生成に失敗しました",
  });

  if (!isWeeklyAdvice(advice)) {
    throw new Error("コメントの形式が不正でした。もう一度お試しください");
  }
  return advice;
}
