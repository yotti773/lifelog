import { apiAuthHeaders } from "@/api/apiAuth";
import { isWeeklyAdvice } from "@/lib/weeklyAdviceValidation";
import type { WeeklyAdvice, WeeklyDigest } from "@/types";

/**
 * Cloudflare Worker経由でAIコーチのコメント生成を依頼する(Issue #12)。
 * digestはコード側で計算済みのWeeklyDigestをそのまま送る(生レコードは送らない)。
 */
export async function requestWeeklyAdvice(digest: WeeklyDigest): Promise<WeeklyAdvice> {
  const res = await fetch("/api/weekly-advice", {
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
