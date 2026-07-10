import {
  parseMealJudgment,
  type LegacyMealJudgmentFields,
  type MealJudgmentResult,
} from "./mealJudgment";
import { MEAL_TYPE_LABELS } from "./mealTypeLabels";
import { handleImportSheets } from "./sheetsImport";
import { handleSyncSheets } from "./sheetsSync";
import { handleWeeklyAdvice } from "./weeklyAdvice";

export interface Env {
  ASSETS: Fetcher;
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
  /** 週次レビューのAIコメント用の軽量モデル(Issue #12)。未設定時はworker/weeklyAdvice.tsのデフォルトを使う */
  GEMINI_ADVICE_MODEL?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: string;
  GOOGLE_SHEETS_SPREADSHEET_ID: string;
}

interface JudgeMealRequestBody {
  imageBase64: string;
  mimeType: string;
  mealType: string;
  note?: string;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          dishName: { type: "STRING" },
          kcal: { type: "NUMBER" },
          proteinG: { type: "NUMBER" },
          fatG: { type: "NUMBER" },
          carbsG: { type: "NUMBER" },
        },
        required: ["dishName", "kcal", "proteinG", "fatG", "carbsG"],
      },
    },
    isUncertain: { type: "BOOLEAN" },
  },
  required: ["items", "isUncertain"],
};

async function judgeMeal(
  env: Env,
  imageBase64: string,
  mimeType: string,
  mealType: string,
  note: string | undefined,
): Promise<MealJudgmentResult & LegacyMealJudgmentFields> {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const mealLabel = MEAL_TYPE_LABELS[mealType] ?? mealType;

  const noteSection =
    note && note.trim() !== ""
      ? `\nユーザーからの補足情報: 「${note.trim()}」。写真だけでは判別しにくい料理名・分量・品目の内訳などは、この補足情報を優先して判定に反映してください。`
      : "";

  const prompt = `この写真は${mealLabel}の食事です。写っている料理・食品を判定し、以下の項目をJSONで返してください。
- items: 写っている料理・食品ごとに1件の配列。例えば「唐揚げ・ご飯・味噌汁」のように見分けられる料理が複数写っている場合は、まとめずにそれぞれを別の要素として分けること。単一の料理しか写っていない場合は1件のみの配列にする
  - dishName: その品目の料理名(日本語、簡潔に)
  - kcal: その品目単体の推定カロリー(kcal、数値のみ。他の品目と合算しない)
  - proteinG: その品目単体の推定たんぱく質(g、数値のみ)
  - fatG: その品目単体の推定脂質(g、数値のみ)
  - carbsG: その品目単体の推定炭水化物(g、数値のみ)
- isUncertain: 量や内容の判定に自信が低い場合、または複数の料理をやむを得ず1つの品目にまとめて返す場合はtrue

一般的な日本の家庭料理・外食の分量を前提に、常識的な範囲で推定してください。${noteSection}`;

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

  return parseMealJudgment(text);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/sync-sheets" && request.method === "POST") {
      return handleSyncSheets(request, env);
    }

    if (url.pathname === "/api/import-sheets" && request.method === "GET") {
      return handleImportSheets(env);
    }

    if (url.pathname === "/api/weekly-advice" && request.method === "POST") {
      return handleWeeklyAdvice(request, env);
    }

    if (url.pathname === "/api/judge-meal" && request.method === "POST") {
      try {
        const body = (await request.json()) as Partial<JudgeMealRequestBody>;
        if (!body.imageBase64 || !body.mimeType) {
          return Response.json({ error: "imageBase64とmimeTypeは必須です" }, { status: 400 });
        }
        const judgment = await judgeMeal(env, body.imageBase64, body.mimeType, body.mealType ?? "", body.note);
        return Response.json(judgment);
      } catch (error) {
        const message = error instanceof Error ? error.message : "判定に失敗しました";
        return Response.json({ error: message }, { status: 502 });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
