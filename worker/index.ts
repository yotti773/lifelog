import {
  buildMealJudgmentPrompt,
  MEAL_JUDGMENT_RESPONSE_SCHEMA,
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

async function judgeMeal(
  env: Env,
  imageBase64: string,
  mimeType: string,
  mealType: string,
  note: string | undefined,
): Promise<MealJudgmentResult & LegacyMealJudgmentFields> {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const mealLabel = MEAL_TYPE_LABELS[mealType] ?? mealType;
  const prompt = buildMealJudgmentPrompt(mealLabel, note);

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
          responseSchema: MEAL_JUDGMENT_RESPONSE_SCHEMA,
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
