/**
 * 週次レビューのAIコーチコメント生成(Issue #12。AIコンサルティング設計書4〜6章)。
 * 入力はコード側で計算済みのWeeklyDigest(JSON)のみで、AIには解釈と言語化だけをさせる。
 * 出力はresponseSchemaで構造化JSONを強制し、検証を通らなければ1回だけリトライする。
 */

export interface WeeklyAdvice {
  verdict: "on_track" | "slightly_behind" | "behind" | "needs_attention";
  summary: string;
  wins: string[];
  actions: string[];
}

export interface WeeklyAdviceEnv {
  GEMINI_API_KEY: string;
  /** コメント生成用の軽量モデル(設計書6章: Flash-Lite系から始める)。写真判定用のGEMINI_MODELとは独立に上書きできる */
  GEMINI_ADVICE_MODEL?: string;
}

export const DEFAULT_ADVICE_MODEL = "gemini-2.5-flash-lite";

const VERDICTS = ["on_track", "slightly_behind", "behind", "needs_attention"] as const;

/** wins/actionsの上限(設計書4章: winsは1〜2個、actionsは最大3個)。超過分は先頭から切り詰める */
export const MAX_WINS = 2;
export const MAX_ACTIONS = 3;

export const WEEKLY_ADVICE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: [...VERDICTS] },
    summary: { type: "STRING" },
    wins: { type: "ARRAY", items: { type: "STRING" } },
    actions: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["verdict", "summary", "wins", "actions"],
};

/**
 * システムプロンプト(設計書5章)。変更したらフィクスチャ全パターンの出力を目視確認すること(設計書6章)。
 * verdictの判定基準は、フラグの有無から機械的に選べるよう条件を列挙して指示する。
 */
export const WEEKLY_ADVICE_SYSTEM_PROMPT = `あなたは減量に伴走するパーソナルトレーナーです。ユーザーの1週間の実績サマリー(JSON)を読み、週の振り返りコメントを日本語で生成してください。断定的すぎず、記録の継続を励ますトーンで書きます。

入力JSONの主な項目: period(対象週)、goal(目標体重・目標日・残り日数)、weight(週平均体重・前週比weeklyChangeKg・着地予測projectedKg・必要ペースrequiredWeeklyPaceKg)、calories(平均摂取・目標・目標以内の日数・実測TDEE・基礎代謝)、pfc(平均と目標)、recording(記録した日数・連続日数)、flags(アプリが判定済みの注意事項)、mood(気分タグの件数)。

必ず守る制約:
1. 入力JSONに無い数値を出さない。数値の計算・推定もしない(計算はすべてアプリ側で済んでいる)
2. flagsに無い問題を新たに指摘しない
3. flagsにある項目は、必ずsummaryまたはactionsのいずれかで言及する
4. 医学的診断や、極端な食事制限・絶食の提案をしない
5. 出力は指定スキーマに従うJSONのみ

verdictは次の規則で機械的に選ぶ(上から順に最初に当てはまったもの):
- flagsにPACE_TOO_AGGRESSIVEまたはINTAKE_BELOW_BMRがある → "needs_attention"
- flagsにBEHIND_PACEがあり、weight.weeklyChangeKgがnullまたは0以上(体重が減っていない) → "behind"
- flagsにBEHIND_PACEがある(減ってはいるがペース不足) → "slightly_behind"
- flagsにINSUFFICIENT_DATA・NO_WEIGHT_DATA・LOW_RECORDING_RATEのいずれかがある → "slightly_behind"
- flagsが空 → "on_track"

各フィールドの書き方:
- summary: 週の総評(2〜3文)
- wins: 続けるべき良かった点(1〜2個)。入力データの裏付けがある事実だけを挙げる
- actions: 来週の具体的行動(1〜3個)。できるだけ測定可能な形で書く(例: 「たんぱく質を毎日130g以上とる」)`;

/** GeminiのJSONテキストを検証してWeeklyAdviceに変換する。検証を通らなければthrow(呼び出し側で1回リトライ) */
export function parseWeeklyAdvice(text: string): WeeklyAdvice {
  const invalid = () => new Error("AIコメントの形式が不正でした。もう一度お試しください");
  let parsed: Partial<WeeklyAdvice>;
  try {
    parsed = JSON.parse(text) as Partial<WeeklyAdvice>;
  } catch {
    throw invalid();
  }

  const isNonEmptyStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.length > 0 && value.every((s) => typeof s === "string" && s.trim() !== "");

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !VERDICTS.includes(parsed.verdict as (typeof VERDICTS)[number]) ||
    typeof parsed.summary !== "string" ||
    parsed.summary.trim() === "" ||
    !isNonEmptyStringArray(parsed.wins) ||
    !isNonEmptyStringArray(parsed.actions)
  ) {
    throw invalid();
  }

  return {
    verdict: parsed.verdict as WeeklyAdvice["verdict"],
    summary: parsed.summary,
    wins: parsed.wins.slice(0, MAX_WINS),
    actions: parsed.actions.slice(0, MAX_ACTIONS),
  };
}

async function callGeminiOnce(
  env: WeeklyAdviceEnv,
  digestJson: string,
  fetchImpl: typeof fetch,
): Promise<WeeklyAdvice> {
  const model = env.GEMINI_ADVICE_MODEL || DEFAULT_ADVICE_MODEL;
  const res = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: WEEKLY_ADVICE_SYSTEM_PROMPT }] },
        // ユーザー入力はWeeklyDigestのJSONそのまま(整形・自然文化はしない。設計書5章)
        contents: [{ parts: [{ text: digestJson }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: WEEKLY_ADVICE_RESPONSE_SCHEMA,
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
    throw new Error("Gemini APIからコメントが得られませんでした");
  }
  return parseWeeklyAdvice(text);
}

/** コメントを生成する。失敗(APIエラー・スキーマ検証落ち)は1回だけリトライする(設計書4章) */
export async function generateWeeklyAdvice(
  env: WeeklyAdviceEnv,
  digest: object,
  fetchImpl: typeof fetch = fetch,
): Promise<WeeklyAdvice> {
  const digestJson = JSON.stringify(digest);
  try {
    return await callGeminiOnce(env, digestJson, fetchImpl);
  } catch {
    return callGeminiOnce(env, digestJson, fetchImpl);
  }
}

export async function handleWeeklyAdvice(
  request: Request,
  env: WeeklyAdviceEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  let digest: unknown;
  try {
    const body = (await request.json()) as { digest?: unknown };
    digest = body.digest;
  } catch {
    return Response.json({ error: "リクエストボディが不正です" }, { status: 400 });
  }
  if (typeof digest !== "object" || digest === null) {
    return Response.json({ error: "digestは必須です" }, { status: 400 });
  }

  try {
    const advice = await generateWeeklyAdvice(env, digest, fetchImpl);
    return Response.json(advice);
  } catch (error) {
    const message = error instanceof Error ? error.message : "コメントの生成に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }
}
