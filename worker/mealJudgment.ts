// Gemini responseSchemaのベストエフォート制約。propertyOrderingで生成順を固定し、
// dishName(何か)→ estimatedWeightG(どれくらいか)→ 栄養値、の順に推論させる。
// estimatedWeightGは分量の見積もりを飛ばして栄養値を出させないための中間推論用フィールドで、
// parseMealJudgmentが除去するためクライアントへのレスポンス形状には含まれない。
export const MEAL_JUDGMENT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          dishName: { type: "STRING" },
          estimatedWeightG: { type: "NUMBER" },
          kcal: { type: "NUMBER" },
          proteinG: { type: "NUMBER" },
          fatG: { type: "NUMBER" },
          carbsG: { type: "NUMBER" },
        },
        required: ["dishName", "estimatedWeightG", "kcal", "proteinG", "fatG", "carbsG"],
        propertyOrdering: ["dishName", "estimatedWeightG", "kcal", "proteinG", "fatG", "carbsG"],
      },
    },
    isUncertain: { type: "BOOLEAN" },
  },
  required: ["items", "isUncertain"],
  propertyOrdering: ["items", "isUncertain"],
};

/**
 * 食事写真判定用のプロンプトを組み立てる。
 *
 * 軽量モデル(Flash-Lite級)でも読み取り精度が出るよう、以下の構成にしている(Issue #62):
 * - 品目の特定 → 分量(g)の見積もり → 栄養値の推定、という思考順序を番号付き手順で固定する
 * - 日本の標準的な1人前の分量アンカーを提示し、写真の量に応じてスケールさせる
 * - kcal ≈ P×4 + F×9 + C×4 の整合性チェックを自己検証として指示する
 * - 揚げ物・外食の見えない油分など、系統的に過小評価しがちな点を明示する
 * - 出力例(few-shot)を1件示す
 */
export function buildMealJudgmentPrompt(mealLabel: string, note?: string): string {
  const trimmedNote = note?.trim() ?? "";
  const noteSection =
    trimmedNote === ""
      ? ""
      : `
## ユーザーからの補足情報(最優先)
「${trimmedNote}」
写真だけでは判別しにくい料理名・分量・品目の内訳は、写真からの推測よりこの補足情報を優先して反映すること。
`;

  return `あなたは日本の食事に詳しい管理栄養士です。写真は${mealLabel}の食事です。写っている料理・食品を判定し、品目ごとの分量とカロリー・PFC(たんぱく質・脂質・炭水化物)を推定してJSONで返してください。
${noteSection}
## 手順(必ずこの順番で考える)
1. 写真に写っている料理・食品をすべて挙げる。見分けられる料理が複数あれば(例: 唐揚げ・ご飯・味噌汁)、まとめずに1品ずつitemsの別の要素に分ける。単一の料理なら1件だけにする
2. 品目ごとに重さ(g)を見積もり、estimatedWeightGに入れる。食器・箸・手など写っているものとの大きさの比較で判断し、判断できなければ日本の家庭料理・外食の標準的な1人前とする
3. 品目と重さから、その品目単体のkcalとたんぱく質・脂質・炭水化物(g)を推定する。日本食品標準成分表の一般的な値を基準にする

## 分量の目安(標準的な1人前。写真の量に応じて増減させる)
- ご飯 茶碗1杯150g = 約234kcal(たんぱく質3.8g・脂質0.5g・炭水化物55.7g)
- 食パン 6枚切り1枚60g = 約149kcal
- 味噌汁 1杯180ml = 約40kcal
- 鶏の唐揚げ 1個30g = 約90kcal
- 卵 1個(可食部50g)= 約71kcal
- ラーメン 1杯(麺・スープ込み)= 約500kcal

## ルール
- kcal・proteinG・fatG・carbsGはその品目単体の値にする(他の品目と合算しない)。概算でよいが必ず数値を入れる
- 整合性チェック: たんぱく質(g)×4 + 脂質(g)×9 + 炭水化物(g)×4 がkcalとおおむね一致すること。大きくズレていたら数値を見直す
- 揚げ物・炒め物・外食メニューは、衣・調理油・ドレッシングなど写真では見えない油分も脂質とkcalに含める(過小評価しやすいので注意)
- 水・お茶・ブラックコーヒーなどカロリーがほぼゼロの飲み物はitemsに含めない。ジュース・牛乳・砂糖入り飲料は含める
- 判定に迷っても、必ず最も可能性の高い内容でitemsを1件以上返す
- isUncertain: 写真が不鮮明、量や内容の判定に自信が低い、または複数の料理をやむを得ず1つの品目にまとめた場合はtrue。それ以外はfalse

## 出力形式
dishNameは簡潔な日本語の料理名。次の例のようなJSONだけを返す。
{"items":[{"dishName":"鶏の唐揚げ","estimatedWeightG":120,"kcal":370,"proteinG":29,"fatG":22,"carbsG":16},{"dishName":"ご飯","estimatedWeightG":200,"kcal":312,"proteinG":5,"fatG":0.7,"carbsG":74}],"isUncertain":false}`;
}

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

  // estimatedWeightG(プロンプトの中間推論用)などスキーマ外の余分なフィールドを
  // クライアントへ流さないよう、既知のフィールドだけに正規化する
  const normalizedItems: MealJudgmentItem[] = items.map((item) => ({
    dishName: item.dishName,
    kcal: item.kcal,
    proteinG: item.proteinG,
    fatG: item.fatG,
    carbsG: item.carbsG,
  }));

  const sum = (pick: (item: MealJudgmentItem) => number) =>
    normalizedItems.reduce((total, item) => total + pick(item), 0);
  return {
    items: normalizedItems,
    isUncertain,
    dishName: normalizedItems.map((item) => item.dishName).join("・"),
    kcal: sum((item) => item.kcal),
    proteinG: sum((item) => item.proteinG),
    fatG: sum((item) => item.fatG),
    carbsG: sum((item) => item.carbsG),
    isMixedOrUncertain: items.length > 1 || isUncertain,
  };
}
