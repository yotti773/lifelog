import { describe, expect, it } from "vitest";
import { isAuthorized, parseAuthTokens, unauthorizedResponse } from "../auth";

describe("isAuthorized", () => {
  it("シークレット自体が無ければ常に許可する(ローカル開発・移行期間)", () => {
    expect(isAuthorized(null, undefined)).toBe(true);
    expect(isAuthorized("Bearer anything", undefined)).toBe(true);
  });

  it("Bearerトークンが一致すれば許可する", () => {
    expect(isAuthorized("Bearer secret-token", "secret-token")).toBe(true);
  });

  it("ヘッダ欠落・トークン不一致・形式不正は拒否する", () => {
    expect(isAuthorized(null, "secret-token")).toBe(false);
    expect(isAuthorized("", "secret-token")).toBe(false);
    expect(isAuthorized("Bearer wrong-token", "secret-token")).toBe(false);
    expect(isAuthorized("secret-token", "secret-token")).toBe(false); // Bearerプレフィックス無し
    expect(isAuthorized("Basic secret-token", "secret-token")).toBe(false);
  });

  it("トークンの前後の余分な空白は許可しない(完全一致)", () => {
    expect(isAuthorized("Bearer secret-token ", "secret-token")).toBe(false);
  });
});

describe("isAuthorized: 複数トークン(Issue #218)", () => {
  const TOKENS = "alice-token,bob-token,carol-token";

  it("カンマ区切りのいずれに一致しても許可する", () => {
    expect(isAuthorized("Bearer alice-token", TOKENS)).toBe(true);
    expect(isAuthorized("Bearer bob-token", TOKENS)).toBe(true);
    expect(isAuthorized("Bearer carol-token", TOKENS)).toBe(true);
  });

  it("どれにも一致しなければ拒否する", () => {
    expect(isAuthorized("Bearer dave-token", TOKENS)).toBe(false);
  });

  it("シークレットから外したトークンだけが拒否される(1人分の失効)", () => {
    // bob を外した状態。他の2人は通り続ける
    const afterRevoke = "alice-token,carol-token";
    expect(isAuthorized("Bearer bob-token", afterRevoke)).toBe(false);
    expect(isAuthorized("Bearer alice-token", afterRevoke)).toBe(true);
    expect(isAuthorized("Bearer carol-token", afterRevoke)).toBe(true);
  });

  it("区切りの前後の空白は無視する(シークレットの手編集で混ざりやすい)", () => {
    expect(isAuthorized("Bearer alice-token", " alice-token , bob-token ")).toBe(true);
    expect(isAuthorized("Bearer bob-token", " alice-token , bob-token ")).toBe(true);
  });

  it("カンマを含まない従来の1本の値もそのまま動く(既存デプロイを壊さない)", () => {
    expect(isAuthorized("Bearer secret-token", "secret-token")).toBe(true);
    expect(isAuthorized("Bearer wrong", "secret-token")).toBe(false);
  });

  it("部分一致では通さない(カンマ区切りの一部を送っても拒否)", () => {
    expect(isAuthorized("Bearer alice", TOKENS)).toBe(false);
    expect(isAuthorized(`Bearer ${TOKENS}`, TOKENS)).toBe(false);
  });
});

describe("parseAuthTokens", () => {
  it("カンマ区切りを分解し、前後の空白を落とす", () => {
    expect(parseAuthTokens("a,b,c")).toEqual(["a", "b", "c"]);
    expect(parseAuthTokens(" a , b ")).toEqual(["a", "b"]);
  });

  it("空の要素は捨てる", () => {
    expect(parseAuthTokens("a,,b")).toEqual(["a", "b"]);
    expect(parseAuthTokens("a,")).toEqual(["a"]);
  });

  it("未設定・空・区切りだけの値は「トークン無し」になる", () => {
    expect(parseAuthTokens(undefined)).toEqual([]);
    expect(parseAuthTokens("")).toEqual([]);
    expect(parseAuthTokens("   ")).toEqual([]);
    expect(parseAuthTokens(",,")).toEqual([]);
  });
});

describe("シークレットは在るのにトークンが0本の状態(Issue #218のレビュー指摘)", () => {
  // 「シークレットを手編集してトークンを1本ずつ抜く」運用の事故で起きうる状態。
  // ここを未設定と同じ全許可にすると、失効させたつもりの操作でAPIが黙って全開放される
  it.each([
    ["空文字", ""],
    ["空白のみ", "   "],
    ["区切りだけ", ",,"],
    ["区切りと空白", " , , "],
  ])("%s は全拒否する(全許可にしない)", (_label, secret) => {
    expect(isAuthorized(null, secret)).toBe(false);
    expect(isAuthorized("Bearer anything", secret)).toBe(false);
  });

  it("シークレット自体が無い場合とは区別する", () => {
    expect(isAuthorized("Bearer anything", undefined)).toBe(true);
    expect(isAuthorized("Bearer anything", "")).toBe(false);
  });
});

describe("unauthorizedResponse", () => {
  it("401とエラーメッセージを返す", async () => {
    const res = unauthorizedResponse();
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("APIトークン");
  });
});
