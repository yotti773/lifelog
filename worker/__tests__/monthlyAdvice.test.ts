import { describe, expect, it } from "vitest";
import {
  MONTHLY_ADVICE_SYSTEM_PROMPT,
  generateMonthlyAdvice,
  handleMonthlyAdvice,
} from "../monthlyAdvice";

/**
 * 月次AIコメント生成(Issue #114)のテスト。生成の中身(parse・リトライ)は週次と共通実装のため、
 * ここでは月次固有の点(月次プロンプトを使う・digestをそのまま送る・handlerの入出力)を検証する。
 */

const VALID_ADVICE = {
  verdict: "on_track",
  summary: "今月は週平均体重が5週連続で下がり、ほぼ必要ペース通りに進みました。記録も安定しています。",
  wins: ["目標カロリー以内の日が先月より増えました"],
  actions: ["睡眠時間の確保を来月の最優先にする"],
};

const ENV = { GEMINI_API_KEY: "test-key" };

const digestOnTrack = {
  month: "2026-07",
  period: { start: "2026-06-29", end: "2026-08-02" },
  goal: { targetWeightKg: 73, targetDate: "2026-10-31", remainingDays: 89 },
  weeks: [
    { weekStart: "2026-06-29", weekAvgKg: 78.0, avgIntakeKcal: 1850 },
    { weekStart: "2026-07-27", weekAvgKg: 76.9, avgIntakeKcal: 1800 },
  ],
  weight: {
    startWeekAvgKg: 78.0,
    endWeekAvgKg: 76.9,
    monthlyChangeKg: -1.1,
    avgWeeklyPaceKg: -0.28,
    requiredWeeklyPaceKg: -0.31,
    projectedAtGoalDateKg: 73.3,
    weeksWithData: 5,
  },
  calories: {
    avgIntakeKcal: 1820,
    targetKcal: 1900,
    daysOnTarget: 24,
    recordedDays: 30,
    monthlyTdeeKcal: 2170,
    tdeeValidWeeks: 5,
    tdeeMinKcal: 2020,
    tdeeMaxKcal: 2400,
    bmrKcal: 1600,
  },
  recording: { recordedDays: 33, totalDays: 35 },
  flags: [],
};

function geminiResponse(text: string): Response {
  return Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
}

function stubFetch(responses: Response[]): { fetchImpl: typeof fetch; calls: { body: string }[] } {
  const calls: { body: string }[] = [];
  const fetchImpl = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ body: String(init?.body) });
    const res = responses.shift();
    if (!res) throw new Error("stubFetch: レスポンスが不足しています");
    return res;
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe("generateMonthlyAdvice", () => {
  it("月次システムプロンプトを使い、MonthlyDigestのJSONをそのまま送る", async () => {
    const { fetchImpl, calls } = stubFetch([geminiResponse(JSON.stringify(VALID_ADVICE))]);
    await generateMonthlyAdvice(ENV, digestOnTrack, fetchImpl);
    const body = JSON.parse(calls[0].body) as {
      system_instruction: { parts: { text: string }[] };
      contents: { parts: { text: string }[] }[];
    };
    expect(body.system_instruction.parts[0].text).toBe(MONTHLY_ADVICE_SYSTEM_PROMPT);
    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual(digestOnTrack);
  });

  it("スキーマ検証に落ちたら1回だけリトライする(週次と同じ)", async () => {
    const { fetchImpl, calls } = stubFetch([
      geminiResponse("{ broken"),
      geminiResponse(JSON.stringify(VALID_ADVICE)),
    ]);
    const advice = await generateMonthlyAdvice(ENV, digestOnTrack, fetchImpl);
    expect(advice).toEqual(VALID_ADVICE);
    expect(calls).toHaveLength(2);
  });
});

describe("handleMonthlyAdvice", () => {
  const request = (body: unknown) =>
    new Request("http://localhost/api/monthly-advice", { method: "POST", body: JSON.stringify(body) });

  it("digestを受けてWeeklyAdvice形を返す", async () => {
    const { fetchImpl } = stubFetch([geminiResponse(JSON.stringify(VALID_ADVICE))]);
    const res = await handleMonthlyAdvice(request({ digest: digestOnTrack }), ENV, fetchImpl);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(VALID_ADVICE);
  });

  it("digestが無いリクエストは400", async () => {
    const { fetchImpl } = stubFetch([]);
    const res = await handleMonthlyAdvice(request({}), ENV, fetchImpl);
    expect(res.status).toBe(400);
  });
});

describe("月次システムプロンプトの契約", () => {
  it("verdictの4値と判定規則のフラグ名を列挙している", () => {
    for (const verdict of ["on_track", "slightly_behind", "behind", "needs_attention"]) {
      expect(MONTHLY_ADVICE_SYSTEM_PROMPT).toContain(verdict);
    }
    for (const flag of ["PACE_TOO_AGGRESSIVE", "INTAKE_BELOW_BMR", "BEHIND_PACE", "LOW_RECORDING_RATE", "NO_WEIGHT_DATA", "INSUFFICIENT_DATA"]) {
      expect(MONTHLY_ADVICE_SYSTEM_PROMPT).toContain(flag);
    }
  });

  it("月次固有の観点(今月の変化・来月の重点・週平均体重の系列)に触れている", () => {
    expect(MONTHLY_ADVICE_SYSTEM_PROMPT).toContain("来月");
    expect(MONTHLY_ADVICE_SYSTEM_PROMPT).toContain("weeks");
    expect(MONTHLY_ADVICE_SYSTEM_PROMPT).toContain("入力JSONに無い数値を出さない");
  });
});
