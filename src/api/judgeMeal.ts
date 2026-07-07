import { resizeImageToBase64 } from "@/lib/image";
import type { MealType } from "@/types";

export interface MealJudgmentItem {
  dishName: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface MealJudgmentResult {
  items: MealJudgmentItem[];
  isUncertain: boolean;
}

/** 写真をリサイズしてCloudflare Worker経由でGemini Vision判定を依頼する */
export async function judgeMealPhoto(
  file: File,
  mealType: MealType,
  note?: string,
): Promise<MealJudgmentResult> {
  const { base64, mimeType } = await resizeImageToBase64(file);

  const res = await fetch("/api/judge-meal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageBase64: base64, mimeType, mealType, note }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "食事の判定に失敗しました");
  }

  const result = (await res.json()) as MealJudgmentResult;
  if (!Array.isArray(result.items) || result.items.length === 0) {
    throw new Error("写真から料理を判定できませんでした");
  }
  return result;
}
