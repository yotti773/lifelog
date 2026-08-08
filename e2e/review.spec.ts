import { expect, test } from "./fixtures";

test("レビュータブで週次・月次のレビューとAIコメントカードが表示される", async ({ page }) => {
  await page.goto("/trends");
  await page.getByText("レビュー", { exact: true }).click();

  // 週次レビュー(データ無しでも骨格とAIカードは出る)
  await expect(page.getByText("AIコーチのコメント", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "コメントを生成する" })).toBeVisible();
  await expect(page.getByText("AIによる参考情報であり、医学的助言ではありません")).toBeVisible();

  // 週/月の切り替えで月次レビューへ
  await page.getByRole("button", { name: "月", exact: true }).click();
  await expect(page.getByText("AIコーチのコメント(月次)")).toBeVisible();
  await expect(page.getByRole("button", { name: "コメントを生成する" })).toBeVisible();
});
