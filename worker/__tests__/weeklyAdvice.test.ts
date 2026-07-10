import { describe, expect, it } from "vitest";
import {
  MAX_ACTIONS,
  MAX_WINS,
  WEEKLY_ADVICE_SYSTEM_PROMPT,
  generateWeeklyAdvice,
  handleWeeklyAdvice,
  parseWeeklyAdvice,
} from "../weeklyAdvice";
import { allDigestFixtures, digestOnTrack } from "./weeklyAdviceFixtures";

const VALID_ADVICE = {
  verdict: "on_track",
  summary: "今週は記録が毎日続き、体重も計画どおりのペースで落ちています。この調子です。",
  wins: ["7日間すべて記録できました"],
  actions: ["たんぱく質を毎日130g以上とる"],
};

const ENV = { GEMINI_API_KEY: "test-key" };

/** Gemini APIのレスポンス形(candidates[0].content.parts[0].text)でラップする */
function geminiResponse(text: string): Response {
  return Response.json({ candidates: [{ content: { parts: [{ text }] } }] });
}

/** 呼ばれるたびにresponses先頭から順に返すfetchスタブ。呼び出し回数も記録する */
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

describe("parseWeeklyAdvice", () => {
  it("スキーマを満たすJSONをそのまま返す", () => {
    expect(parseWeeklyAdvice(JSON.stringify(VALID_ADVICE))).toEqual(VALID_ADVICE);
  });

  it("winsは最大2個・actionsは最大3個に切り詰める", () => {
    const advice = parseWeeklyAdvice(
      JSON.stringify({ ...VALID_ADVICE, wins: ["a", "b", "c"], actions: ["1", "2", "3", "4"] }),
    );
    expect(advice.wins).toHaveLength(MAX_WINS);
    expect(advice.actions).toHaveLength(MAX_ACTIONS);
  });

  it.each([
    ["JSONとして不正", "{ broken"],
    ["verdictが規定外", JSON.stringify({ ...VALID_ADVICE, verdict: "great" })],
    ["summaryが空", JSON.stringify({ ...VALID_ADVICE, summary: " " })],
    ["winsが空配列", JSON.stringify({ ...VALID_ADVICE, wins: [] })],
    ["winsに文字列以外", JSON.stringify({ ...VALID_ADVICE, wins: [1] })],
    ["actionsが欠落", JSON.stringify({ verdict: "on_track", summary: "s", wins: ["w"] })],
  ])("不正な出力はエラーにする: %s", (_name, text) => {
    expect(() => parseWeeklyAdvice(text)).toThrow();
  });
});

describe("generateWeeklyAdvice", () => {
  it("digestのJSONをそのままユーザー入力として送る(整形しない)", async () => {
    const { fetchImpl, calls } = stubFetch([geminiResponse(JSON.stringify(VALID_ADVICE))]);
    await generateWeeklyAdvice(ENV, digestOnTrack, fetchImpl);
    const body = JSON.parse(calls[0].body) as {
      system_instruction: { parts: { text: string }[] };
      contents: { parts: { text: string }[] }[];
      generationConfig: { responseMimeType: string };
    };
    expect(body.system_instruction.parts[0].text).toBe(WEEKLY_ADVICE_SYSTEM_PROMPT);
    expect(JSON.parse(body.contents[0].parts[0].text)).toEqual(digestOnTrack);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("スキーマ検証に落ちたら1回だけリトライする(設計書4章)", async () => {
    const { fetchImpl, calls } = stubFetch([
      geminiResponse("{ broken"),
      geminiResponse(JSON.stringify(VALID_ADVICE)),
    ]);
    const advice = await generateWeeklyAdvice(ENV, digestOnTrack, fetchImpl);
    expect(advice).toEqual(VALID_ADVICE);
    expect(calls).toHaveLength(2);
  });

  it("リトライも失敗したらエラーを伝播する", async () => {
    const { fetchImpl, calls } = stubFetch([geminiResponse("{ broken"), geminiResponse("{ broken")]);
    await expect(generateWeeklyAdvice(ENV, digestOnTrack, fetchImpl)).rejects.toThrow();
    expect(calls).toHaveLength(2);
  });
});

describe("handleWeeklyAdvice", () => {
  const request = (body: unknown) =>
    new Request("http://localhost/api/weekly-advice", { method: "POST", body: JSON.stringify(body) });

  it("digestを受けてWeeklyAdviceを返す", async () => {
    const { fetchImpl } = stubFetch([geminiResponse(JSON.stringify(VALID_ADVICE))]);
    const res = await handleWeeklyAdvice(request({ digest: digestOnTrack }), ENV, fetchImpl);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(VALID_ADVICE);
  });

  it("digestが無いリクエストは400", async () => {
    const { fetchImpl } = stubFetch([]);
    const res = await handleWeeklyAdvice(request({}), ENV, fetchImpl);
    expect(res.status).toBe(400);
  });

  it("生成が失敗し続けたら502でエラーメッセージを返す", async () => {
    const { fetchImpl } = stubFetch([
      Response.json({ error: "quota" }, { status: 429 }),
      Response.json({ error: "quota" }, { status: 429 }),
    ]);
    const res = await handleWeeklyAdvice(request({ digest: digestOnTrack }), ENV, fetchImpl);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("429");
  });
});

describe("システムプロンプトの契約(設計書5章)", () => {
  it("verdictの4値と判定規則のフラグ名を列挙している", () => {
    for (const verdict of ["on_track", "slightly_behind", "behind", "needs_attention"]) {
      expect(WEEKLY_ADVICE_SYSTEM_PROMPT).toContain(verdict);
    }
    for (const flag of ["PACE_TOO_AGGRESSIVE", "INTAKE_BELOW_BMR", "BEHIND_PACE", "LOW_RECORDING_RATE", "NO_WEIGHT_DATA", "INSUFFICIENT_DATA"]) {
      expect(WEEKLY_ADVICE_SYSTEM_PROMPT).toContain(flag);
    }
  });

  it("「flagsに無い問題を指摘しない」「数値を出さない」制約を含む", () => {
    expect(WEEKLY_ADVICE_SYSTEM_PROMPT).toContain("flagsに無い問題を新たに指摘しない");
    expect(WEEKLY_ADVICE_SYSTEM_PROMPT).toContain("入力JSONに無い数値を出さない");
  });

  it("全フィクスチャがJSONとして送信可能な形をしている", () => {
    for (const [name, digest] of Object.entries(allDigestFixtures)) {
      const json = JSON.stringify(digest);
      expect(JSON.parse(json), name).toBeTruthy();
      expect(Array.isArray((digest as { flags: string[] }).flags), name).toBe(true);
    }
  });
});
