import { describe, expect, it } from "vitest";
import { isAuthorized, unauthorizedResponse } from "../auth";

describe("isAuthorized", () => {
  it("期待トークンが未設定なら常に許可する(ローカル開発・移行期間)", () => {
    expect(isAuthorized(null, undefined)).toBe(true);
    expect(isAuthorized(null, "")).toBe(true);
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

describe("unauthorizedResponse", () => {
  it("401とエラーメッセージを返す", async () => {
    const res = unauthorizedResponse();
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("APIトークン");
  });
});
