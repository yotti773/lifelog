import { isAuthorized, unauthorizedResponse } from "./auth";
import {
  buildMealJudgmentPrompt,
  MEAL_JUDGMENT_RESPONSE_SCHEMA,
  parseMealJudgment,
  type LegacyMealJudgmentFields,
  type MealJudgmentResult,
} from "./mealJudgment";
import { MEAL_TYPE_LABELS } from "./mealTypeLabels";
import { handleMonthlyAdvice } from "./monthlyAdvice";
import { handleImportSheets } from "./sheetsImport";
import { handleSyncSheets } from "./sheetsSync";
import { handleWeeklyAdvice } from "./weeklyAdvice";

export interface Env {
  ASSETS: Fetcher;
  /** APIの共有トークン(Issue #87)。未設定なら認証を要求しない(ローカル開発・移行期間用) */
  API_AUTH_TOKEN?: string;
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
  /** 週次レビューのAIコメント用の軽量モデル(Issue #12)。未設定時はworker/weeklyAdvice.tsのデフォルトを使う */
  GEMINI_ADVICE_MODEL?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: string;
  GOOGLE_SHEETS_SPREADSHEET_ID: string;
}

/** 1回の判定に添付できる写真の上限(Issue #110)。クライアント側のsrc/api/judgeMeal.tsと合わせる */
const MAX_MEAL_PHOTOS = 4;

interface JudgeMealImage {
  imageBase64: string;
  mimeType: string;
}

interface JudgeMealRequestBody {
  /** 複数写真対応(Issue #110)。1〜4枚 */
  images?: JudgeMealImage[];
  /** 旧クライアント(SW更新前の事前キャッシュされたバンドル)向けの単発形式。imagesがあればそちらを優先 */
  imageBase64?: string;
  mimeType?: string;
  mealType: string;
  note?: string;
}

async function judgeMeal(
  env: Env,
  images: JudgeMealImage[],
  mealType: string,
  note: string | undefined,
): Promise<MealJudgmentResult & LegacyMealJudgmentFields> {
  const model = env.GEMINI_MODEL || "gemini-2.5-flash";
  const mealLabel = MEAL_TYPE_LABELS[mealType] ?? mealType;
  const prompt = buildMealJudgmentPrompt(mealLabel, note, images.length);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              ...images.map((image) => ({
                inline_data: { mime_type: image.mimeType, data: image.imageBase64 },
              })),
            ],
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

    // 全APIエンドポイントを共有トークンで保護する(Issue #87)。静的アセット配信は対象外
    if (url.pathname.startsWith("/api/") && !isAuthorized(request.headers.get("authorization"), env.API_AUTH_TOKEN)) {
      return unauthorizedResponse();
    }

    if (url.pathname === "/api/sync-sheets" && request.method === "POST") {
      return handleSyncSheets(request, env);
    }

    if (url.pathname === "/api/import-sheets" && request.method === "GET") {
      return handleImportSheets(env);
    }

    if (url.pathname === "/api/weekly-advice" && request.method === "POST") {
      return handleWeeklyAdvice(request, env);
    }

    if (url.pathname === "/api/monthly-advice" && request.method === "POST") {
      return handleMonthlyAdvice(request, env);
    }

    if (url.pathname === "/api/judge-meal" && request.method === "POST") {
      try {
        const body = (await request.json()) as Partial<JudgeMealRequestBody>;
        // 新形式(images配列)を優先し、無ければ旧形式(単発のimageBase64/mimeType)を1枚として扱う
        const images: JudgeMealImage[] = Array.isArray(body.images)
          ? body.images
          : body.imageBase64 && body.mimeType
            ? [{ imageBase64: body.imageBase64, mimeType: body.mimeType }]
            : [];
        if (images.length === 0 || images.some((image) => !image?.imageBase64 || !image?.mimeType)) {
          return Response.json({ error: "imageBase64とmimeTypeを含む写真が1枚以上必要です" }, { status: 400 });
        }
        if (images.length > MAX_MEAL_PHOTOS) {
          return Response.json({ error: `写真は最大${MAX_MEAL_PHOTOS}枚までです` }, { status: 400 });
        }
        const judgment = await judgeMeal(env, images, body.mealType ?? "", body.note);
        return Response.json(judgment);
      } catch (error) {
        const message = error instanceof Error ? error.message : "判定に失敗しました";
        return Response.json({ error: message }, { status: 502 });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
