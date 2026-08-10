import { test as base, type Page } from "@playwright/test";

/**
 * E2E共通のテストフィクスチャ(Issue #198)。
 *
 * **すべての `/api/**` 呼び出しをブラウザ内でブロックする。** アプリは起動時に自動同期
 * (`runSync` + 活動記録の取り込み)を行い、Viteのdevサーバーは `/api` を `localhost:8787`
 * (`npm run worker:dev`)へプロキシする。ブロックしないと、worker:devを起動したまま
 * E2Eを流したときにテスト用のダミー記録が**実際のスプレッドシートへ書き込まれ**、
 * バックアップテストの全削除が削除トゥームストーンまで送ってしまう。
 *
 * 同期エラーは通常フロー(オフライン・Worker未設定)として握り潰される設計のため、
 * 遮断してもテスト対象の画面挙動には影響しない。Worker必須の機能はE2Eの対象外(CLAUDE.md参照)。
 */
export const test = base.extend<{ blockApi: void }>({
  blockApi: [
    async ({ page }, use) => {
      // グロブ(`**/api/**`)は使わない — devサーバーはアプリのソースを実パスで配信するため、
      // `/src/api/apiAuth.ts` などにもマッチしてアプリ自体が起動しなくなる。
      // 遮断したいのはWorkerのエンドポイントだけなので、パス先頭で厳密に判定する
      await page.route(
        (url) => url.pathname.startsWith("/api/"),
        (route) => route.abort(),
      );
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
export type { Page } from "@playwright/test";

/**
 * 初回セットアップ(Issue #217)を「あとで設定する」で抜けた状態にする。
 *
 * 目標が未設定のままホームを開くと `/setup` へ送られる仕様のため、**ホームを経由する
 * テストはこれを先に呼ぶ**(呼ばないと記録の保存後にホームではなくセットアップ画面へ着く)。
 * オンボーディング自体の検証は initial-setup.spec.ts が担当する。
 */
export async function skipInitialSetup(page: Page) {
  await page.goto("/setup");
  await page.getByRole("button", { name: "あとで設定する" }).click();
  await page.waitForURL("/");
}
