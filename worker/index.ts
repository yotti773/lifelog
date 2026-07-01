export interface Env {
  ASSETS: Fetcher;
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
}

interface MealJudgment {
  dishName: string;
  kcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  isMixedOrUncertain: boolean;
}

interface JudgeMealRequestBody {
  imageBase64: string;
  mimeType: string;
  mealType: string;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    dishName: { type: "STRING" },
    kcal: { type: "NUMBER" },
    proteinG: { type: "NUMBER" },
    fatG: { type: "NUMBER" },
    carbsG: { type: "NUMBER" },
    isMixedOrUncertain: { type: "BOOLEAN" },
  },
  required: ["dishName", "kcal", "proteinG", "fatG", "carbsG", "isMixedOrUncertain"],
};

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
};

async function judgeMeal(
  env: Env,
  imageBase64: string,
  mimeType: string,
  mealType: string,
): Promise<MealJudgment> {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const mealLabel = MEAL_TYPE_LABELS[mealType] ?? mealType;

  const prompt = `この写真は${mealLabel}の食事です。写っている料理を判定し、以下の項目をJSONで返してください。
- dishName: 料理名(日本語、簡潔に)
- kcal: 推定カロリー(kcal、数値のみ)
- proteinG: 推定たんぱく質(g、数値のみ)
- fatG: 推定脂質(g、数値のみ)
- carbsG: 推定炭水化物(g、数値のみ)
- isMixedOrUncertain: 複数の料理が写っている、または量や内容の判定に自信が低い場合はtrue

一般的な日本の家庭料理・外食の分量を前提に、常識的な範囲で推定してください。`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini APIエラー (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini APIから判定結果が得られませんでした");
  }
  return JSON.parse(text) as MealJudgment;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/judge-meal" && request.method === "POST") {
      try {
        const body = (await request.json()) as Partial<JudgeMealRequestBody>;
        if (!body.imageBase64 || !body.mimeType) {
          return Response.json({ error: "imageBase64とmimeTypeは必須です" }, { status: 400 });
        }
        const judgment = await judgeMeal(env, body.imageBase64, body.mimeType, body.mealType ?? "");
        return Response.json(judgment);
      } catch (error) {
        const message = error instanceof Error ? error.message : "判定に失敗しました";
        return Response.json({ error: message }, { status: 502 });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
