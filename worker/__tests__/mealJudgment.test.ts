import { describe, expect, it } from "vitest";
import {
  buildMealJudgmentPrompt,
  MEAL_JUDGMENT_RESPONSE_SCHEMA,
  parseMealJudgment,
} from "../mealJudgment";

const ITEM = { dishName: "唐揚げ", kcal: 320, proteinG: 18, fatG: 22, carbsG: 12 };
const ITEM2 = { dishName: "ご飯", kcal: 250, proteinG: 4, fatG: 0.5, carbsG: 55 };

describe("parseMealJudgment", () => {
  it("複数品目をそのまま返し、後方互換フィールドに合算値を付与する", () => {
    const result = parseMealJudgment(JSON.stringify({ items: [ITEM, ITEM2], isUncertain: false }));
    expect(result.items).toEqual([ITEM, ITEM2]);
    expect(result.isUncertain).toBe(false);
    // 旧クライアント向けの合算フィールド
    expect(result.dishName).toBe("唐揚げ・ご飯");
    expect(result.kcal).toBe(570);
    expect(result.proteinG).toBe(22);
    expect(result.fatG).toBe(22.5);
    expect(result.carbsG).toBe(67);
    // 複数品目なら旧isMixedOrUncertainはtrue(旧プロンプトの定義に合わせる)
    expect(result.isMixedOrUncertain).toBe(true);
  });

  it("単一品目・自信ありならisMixedOrUncertainはfalse", () => {
    const result = parseMealJudgment(JSON.stringify({ items: [ITEM], isUncertain: false }));
    expect(result.items).toEqual([ITEM]);
    expect(result.isMixedOrUncertain).toBe(false);
  });

  it("単一品目でもisUncertainがtrueならisMixedOrUncertainもtrue", () => {
    const result = parseMealJudgment(JSON.stringify({ items: [ITEM], isUncertain: true }));
    expect(result.isUncertain).toBe(true);
    expect(result.isMixedOrUncertain).toBe(true);
  });

  it.each([
    ["JSONとして不正", "{ broken"],
    ["itemsが欠落", JSON.stringify({ isUncertain: false })],
    ["itemsが配列でない", JSON.stringify({ items: ITEM, isUncertain: false })],
    ["itemsが空配列", JSON.stringify({ items: [], isUncertain: false })],
    ["dishNameが文字列でない", JSON.stringify({ items: [{ ...ITEM, dishName: 1 }], isUncertain: false })],
    ["kcalが数値でない", JSON.stringify({ items: [{ ...ITEM, kcal: "320" }], isUncertain: false })],
    ["PFCが欠落", JSON.stringify({ items: [{ dishName: "唐揚げ", kcal: 320 }], isUncertain: false })],
  ])("%s の場合はエラーを投げる", (_label, text) => {
    expect(() => parseMealJudgment(text)).toThrow("AIの判定結果の形式が不正でした");
  });

  it("isUncertainが欠落していてもitemsが正当ならfalse扱いで通す", () => {
    const result = parseMealJudgment(JSON.stringify({ items: [ITEM] }));
    expect(result.isUncertain).toBe(false);
  });

  it("estimatedWeightGなどスキーマ外の余分なフィールドはitemsから除去する", () => {
    const result = parseMealJudgment(
      JSON.stringify({
        items: [{ ...ITEM, estimatedWeightG: 120, memo: "余分" }],
        isUncertain: false,
      }),
    );
    expect(result.items).toEqual([ITEM]);
  });
});

describe("buildMealJudgmentPrompt", () => {
  it("食事区分ラベルと手順・分量アンカー・整合性チェックを含む", () => {
    const prompt = buildMealJudgmentPrompt("朝食");
    expect(prompt).toContain("朝食の食事です");
    expect(prompt).toContain("## 手順");
    expect(prompt).toContain("## 分量の目安");
    expect(prompt).toContain("estimatedWeightG");
    // PFC→kcalの整合性セルフチェック
    expect(prompt).toContain("たんぱく質(g)×4 + 脂質(g)×9 + 炭水化物(g)×4");
  });

  it("補足情報があれば最優先セクションとして埋め込む(前後の空白はトリム)", () => {
    const prompt = buildMealJudgmentPrompt("昼食", "  唐揚げ弁当、ご飯少なめ ");
    expect(prompt).toContain("## ユーザーからの補足情報(最優先)");
    expect(prompt).toContain("「唐揚げ弁当、ご飯少なめ」");
  });

  it.each([
    ["未指定", undefined],
    ["空文字", ""],
    ["空白のみ", "   "],
  ])("補足情報が%sなら補足セクションを含めない", (_label, note) => {
    expect(buildMealJudgmentPrompt("夕食", note)).not.toContain("補足情報");
  });

  it("プロンプトの出力例はレスポンススキーマの必須フィールドと整合している", () => {
    const prompt = buildMealJudgmentPrompt("間食");
    const exampleLine = prompt.split("\n").find((line) => line.startsWith('{"items"'));
    expect(exampleLine).toBeDefined();
    const example = JSON.parse(exampleLine!) as {
      items: Record<string, unknown>[];
      isUncertain: boolean;
    };
    const requiredKeys = (
      MEAL_JUDGMENT_RESPONSE_SCHEMA.properties.items.items as { required: string[] }
    ).required;
    for (const item of example.items) {
      for (const key of requiredKeys) {
        expect(item).toHaveProperty(key);
      }
    }
    expect(typeof example.isUncertain).toBe("boolean");
  });
});
