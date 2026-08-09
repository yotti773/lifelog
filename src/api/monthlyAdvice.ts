import { AI_REQUEST_TIMEOUT_MS, requestApi } from "@/api/request";
import { isWeeklyAdvice } from "@/lib/weeklyAdviceValidation";
import type { MonthlyDigest, WeeklyAdvice } from "@/types";

/**
 * Cloudflare Worker経由で月次AIコーチコメントの生成を依頼する(Issue #114)。
 * digestはコード側で計算済みのMonthlyDigestをそのまま送る(生レコードは送らない)。
 * 出力契約は週次と共通のため、検証もisWeeklyAdviceを流用する。
 */
export async function requestMonthlyAdvice(digest: MonthlyDigest): Promise<WeeklyAdvice> {
  const advice = await requestApi<unknown>("/api/monthly-advice", {
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
