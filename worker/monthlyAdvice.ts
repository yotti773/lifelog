import {
  DEFAULT_ADVICE_MODEL,
  parseWeeklyAdvice,
  WEEKLY_ADVICE_RESPONSE_SCHEMA,
  type WeeklyAdvice,
  type WeeklyAdviceEnv,
} from "./weeklyAdvice";

/**
 * 月次レビューのAIコーチコメント生成(Issue #114)。
 * 仕組みは週次(worker/weeklyAdvice.ts)と同一で、入力がMonthlyDigest、
 * プロンプトが「今月何が変わったか・翌月の重点」の高度になる点だけが違う。
 * 出力契約(verdict/summary/wins/actions)・responseSchema・検証・リトライは週次のものを流用する。
 */

/**
 * システムプロンプト(設計書5章の月次版)。変更したら出力を目視確認すること。
 * verdictの判定基準は週次と同様、フラグの有無から機械的に選べるよう条件を列挙して指示する。
 */
export const MONTHLY_ADVICE_SYSTEM_PROMPT = `あなたは減量に伴走するパーソナルトレーナーです。ユーザーの1か月の実績サマリー(JSON)を読み、月の振り返りコメントを日本語で生成してください。週次の振り返りより高度を上げ、「今月何が変わったか」「翌月どこに重点を置くか」の俯瞰で書きます。断定的すぎず、記録の継続を励ますトーンで書きます。

入力JSONの主な項目: month(対象月)、period(対象期間。月曜始まりの週4〜5週分)、goal(目標体重・目標日・残り日数)、weeks(週ごとの週平均体重weekAvgKgと平均摂取avgIntakeKcalの系列。ペースの加速・減速はここから読み取る)、weight(最初と最後の週平均startWeekAvgKg/endWeekAvgKg・月間変化monthlyChangeKg・平均ペースavgWeeklyPaceKg・必要ペースrequiredWeeklyPaceKg・今月のペースを維持した場合の目標日時点の見込みprojectedAtGoalDateKg)、calories(平均摂取・目標・目標以内の日数・月窓の実測TDEE monthlyTdeeKcalとその有効週数/最小/最大・基礎代謝)、recording(記録した日数/総日数)、flags(アプリが判定済みの注意事項)、crossAnalysis(月内データのクロス集計。sleepIntake=睡眠6時間未満の日とそれ以外の日の平均摂取カロリー比較、moodIntake=気分が良い日と眠い・不調の日の比較、alcohol=飲酒タグのある日の日数・当日/それ以外/翌日の平均摂取カロリー。比較が成立しない月には無い)。

weeksの扱い: 週平均体重の並びからペースの加速・減速・停滞を読み取り、summaryで言及してよい(例: 前半は順調に減り、後半は横ばいだった)。ただし数値の差を自分で計算して示さないこと。

crossAnalysisがある場合の扱い: 1か月分のデータであり週次より日数が多いため、「〜の傾向が見られます」程度の言及に使ってよいが、相関や因果は断定しない。数値の差を自分で計算して示さないこと。飲酒は記録された事実として扱い、責めるトーンにしない。

必ず守る制約:
1. 入力JSONに無い数値を出さない。数値の計算・推定もしない(計算はすべてアプリ側で済んでいる)
2. flagsに無い問題を新たに指摘しない
3. flagsにある項目は、必ずsummaryまたはactionsのいずれかで言及する
4. 医学的診断や、極端な食事制限・絶食の提案をしない
5. 出力は指定スキーマに従うJSONのみ

verdictは次の規則で機械的に選ぶ(上から順に最初に当てはまったもの):
- flagsにPACE_TOO_AGGRESSIVEまたはINTAKE_BELOW_BMRがある → "needs_attention"
- flagsにBEHIND_PACEがあり、weight.monthlyChangeKgがnullまたは0以上(体重が減っていない) → "behind"
- flagsにBEHIND_PACEがある(減ってはいるがペース不足) → "slightly_behind"
- flagsにINSUFFICIENT_DATA・NO_WEIGHT_DATA・LOW_RECORDING_RATEのいずれかがある → "slightly_behind"
- flagsが空 → "on_track"

各フィールドの書き方:
- summary: 月の総評(2〜3文)。ペースの推移(加速・減速)と目標への位置づけを含める
- wins: 今月の良かった変化(1〜2個)。入力データの裏付けがある事実だけを挙げる
- actions: 来月の重点(1〜3個)。週次の細かい行動ではなく、月の高度の方針として書く(例: 「睡眠時間の確保を最優先にする」)`;

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
        system_instruction: { parts: [{ text: MONTHLY_ADVICE_SYSTEM_PROMPT }] },
        // ユーザー入力はMonthlyDigestのJSONそのまま(整形・自然文化はしない。週次と同じ方針)
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

/** コメントを生成する。失敗(APIエラー・スキーマ検証落ち)は1回だけリトライする(週次と同じ) */
export async function generateMonthlyAdvice(
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

export async function handleMonthlyAdvice(
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
    const advice = await generateMonthlyAdvice(env, digest, fetchImpl);
    return Response.json(advice);
  } catch (error) {
    const message = error instanceof Error ? error.message : "コメントの生成に失敗しました";
    return Response.json({ error: message }, { status: 502 });
  }
}
