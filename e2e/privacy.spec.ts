import { expect, test } from "./fixtures";

/**
 * プライバシーポリシー(Issue #238)。**URLとして到達できること自体が要件**のため、
 * 設定画面からの導線と、直リンク(Google Cloud Consoleに登録するURL)の両方を確認する。
 */
test("設定画面からプライバシーポリシーを開ける", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "プライバシーポリシー" }).click();
  await page.waitForURL("/privacy");

  await expect(page.getByText("最終更新:")).toBeVisible();
  // 誤解の起きやすい2点(日記本文・スコープ)が本文に出ていること
  await expect(page.getByText("日記の本文をAIに送る")).toBeVisible();
  await expect(page.getByText("drive.file", { exact: false })).toBeVisible();

  // 読み物のため下部ナビは出さない(App.tsxのisFullScreenFlow)
  await expect(page.getByRole("navigation")).toHaveCount(0);

  await page.getByRole("button", { name: "戻る" }).click();
  await page.waitForURL("/settings");
});

test("直リンクでプライバシーポリシーを開ける", async ({ page }) => {
  // Google Cloud Consoleに登録するURL。SPAフォールバック(wrangler.toml)で直接開ける必要がある
  await page.goto("/privacy");
  await expect(page.getByText("プライバシーポリシー")).toBeVisible();
  await expect(page.getByText("まとめ")).toBeVisible();
});
