import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `wrangler.toml` の `run_worker_first` の番人。
 *
 * 2026-08-27、流入元ログ(Issue #251)のために `run_worker_first = ["/"]` を入れたところ、
 * **本番の `/api/*` が全滅した**。この値を配列にすると、Cloudflareは既定の暗黙ルーティング
 * (アセットに無いパスをWorkerへ回す)をやめ、書いたパスだけをWorkerへ通すようになる。
 * その結果 `/api/*` はアセット層で完結してWorkerのハンドラまで届かなくなり、
 * POST(`/api/google-oauth/token`・`/api/judge-meal`)が失敗してシート同期もAI判定も止まった。
 *
 * 画面に出たのはWorkerが返すJSONの文言ではなく呼び出し元のフォールバック文言
 * (「Googleとの連携に失敗しました」「食事の判定に失敗しました」)だけで、
 * **Workerまで届いていないことが症状から読み取れなかった**。同じ壊し方を二度やらないための番人(Issue #252)。
 */

const WRANGLER_TOML = readFileSync(fileURLToPath(new URL("../../wrangler.toml", import.meta.url)), "utf-8");

/** `run_worker_first = [...]` の中身を取り出す。設定が無い/真偽値の場合は null を返す */
function parseRunWorkerFirst(toml: string): string[] | null {
  const match = /^\s*run_worker_first\s*=\s*\[([^\]]*)\]/m.exec(toml);
  if (match === null) return null;
  return [...match[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]);
}

describe("wrangler.toml の run_worker_first", () => {
  it("配列で指定する場合は /api/* をWorkerへ通す", () => {
    const patterns = parseRunWorkerFirst(WRANGLER_TOML);
    if (patterns === null) {
      // 配列を使っていない(未設定 or true)なら暗黙ルーティングが効くので、この制約は要らない。
      // ただし「書き方が変わって正規表現が空振りしただけ」を素通りさせないよう、
      // 配列形式が本当に無いことを確かめてから抜ける(黙って通るテストにしない)
      expect(WRANGLER_TOML).not.toMatch(/^\s*run_worker_first\s*=\s*\[/m);
      return;
    }

    // 除外パターン(`!` 始まり)で /api/* を打ち消していないことも併せて見る
    expect(patterns).toContain("/api/*");
    expect(patterns.filter((p) => p.startsWith("!"))).not.toContain("!/api/*");
  });

  it("SPAフォールバックが有効な前提を固定する(この組み合わせでのみ上の制約が要る)", () => {
    expect(WRANGLER_TOML).toMatch(/not_found_handling\s*=\s*"single-page-application"/);
  });
});
