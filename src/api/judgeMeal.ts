import { AI_REQUEST_TIMEOUT_MS, requestApi } from "@/api/request";
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

/** 1回の判定に添付できる写真の上限(Issue #110)。Worker側のworker/index.tsと合わせる */
export const MAX_MEAL_PHOTOS = 4;

/**
 * 写真(複数可・0枚可)とテキスト(note)をCloudflare Worker経由でGemini判定に投げる(Issue #159)。
 * filesが空配列でもnoteがあればテキストのみの判定として成立する(Worker側でその両方が空のときのみ弾く)。
 */
export async function judgeMealPhoto(
  files: File[],
  mealType: MealType,
  note?: string,
): Promise<MealJudgmentResult> {
  const images = await Promise.all(
    files.map(async (file) => {
      const { base64, mimeType } = await resizeImageToBase64(file);
      return { imageBase64: base64, mimeType };
    }),
  );

  const result = await requestApi<MealJudgmentResult>("/api/judge-meal", {
    method: "POST",
    body: { images, mealType, note },
    timeoutMs: AI_REQUEST_TIMEOUT_MS,
    fallbackErrorMessage: () => "食事の判定に失敗しました",
  });

  if (!Array.isArray(result.items) || result.items.length === 0) {
    throw new Error(files.length > 0 ? "写真から料理を判定できませんでした" : "テキストから料理を判定できませんでした");
  }
  return result;
}
