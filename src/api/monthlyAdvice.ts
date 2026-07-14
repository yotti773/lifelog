import { apiAuthHeaders } from "@/api/apiAuth";
import { isWeeklyAdvice } from "@/lib/weeklyAdviceValidation";
import type { MonthlyDigest, WeeklyAdvice } from "@/types";

/**
 * Cloudflare Worker経由で月次AIコーチコメントの生成を依頼する(Issue #114)。
 * digestはコード側で計算済みのMonthlyDigestをそのまま送る(生レコードは送らない)。
 * 出力契約は週次と共通のため、検証もisWeeklyAdviceを流用する。
 */
export async function requestMonthlyAdvice(digest: MonthlyDigest): Promise<WeeklyAdvice> {
  const res = await fetch("/api/monthly-advice", {
    method: "POST",
    headers: { "content-type": "application/json", ...(await apiAuthHeaders()) },
    body: JSON.stringify({ digest }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "コメントの生成に失敗しました");
  }

  const advice = (await res.json()) as unknown;
  if (!isWeeklyAdvice(advice)) {
    throw new Error("コメントの形式が不正でした。もう一度お試しください");
  }
  return advice;
}
