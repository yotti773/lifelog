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

// Service Worker更新前の旧バンドルクライアント向けの後方互換フィールド(旧レスポンス形状の合算値)。
// PWAはJSを事前キャッシュするため、デプロイ直後は旧クライアントがこのAPIを叩く。
// 全クライアントのSW更新が行き渡った後のリリースで削除してよい。
export interface LegacyMealJudgmentFields {
  dishName: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  isMixedOrUncertain: boolean;
}

/**
 * GeminiのJSONテキストを検証し、旧クライアント向けの合算フィールドを付与して返す。
 * responseSchemaによる制約付きデコードはベストエフォートのため、items欠落・空配列・
 * 数値欠落はここで弾く(不正なまま200で返すとクライアント側でTypeError/NaNになる)。
 */
export function parseMealJudgment(text: string): MealJudgmentResult & LegacyMealJudgmentFields {
  let parsed: Partial<MealJudgmentResult>;
  try {
    parsed = JSON.parse(text) as Partial<MealJudgmentResult>;
  } catch {
    throw new Error("AIの判定結果の形式が不正でした。もう一度お試しください");
  }

  const items = parsed.items;
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.some(
      (item) =>
        typeof item?.dishName !== "string" ||
        !Number.isFinite(item.kcal) ||
        !Number.isFinite(item.proteinG) ||
        !Number.isFinite(item.fatG) ||
        !Number.isFinite(item.carbsG),
    )
  ) {
    throw new Error("AIの判定結果の形式が不正でした。もう一度お試しください");
  }
  const isUncertain = parsed.isUncertain === true;

  const sum = (pick: (item: MealJudgmentItem) => number) =>
    items.reduce((total, item) => total + pick(item), 0);
  return {
    items,
    isUncertain,
    dishName: items.map((item) => item.dishName).join("・"),
    kcal: sum((item) => item.kcal),
    proteinG: sum((item) => item.proteinG),
    fatG: sum((item) => item.fatG),
    carbsG: sum((item) => item.carbsG),
    isMixedOrUncertain: items.length > 1 || isUncertain,
  };
}
