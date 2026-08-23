import { expect, test } from "./fixtures";

/**
 * AIへの送信の同意(Issue #219)。**同意していない状態でAI機能が呼ばれない**ことと、
 * **同意しなくても記録が使える**ことが完了条件なので、その2点をここで固定する。
 */
test("同意していないと、AIコメントの生成は同意ダイアログで止まる", async ({ page }) => {
  // AIへのリクエストが起きたら分かるようにしておく(起きないことがこのテストの主眼)
  const aiRequests: string[] = [];
  await page.route("**/api/weekly-advice", (route) => {
    aiRequests.push(route.request().url());
    return route.abort();
  });

  await page.goto("/trends");
  await page.getByText("レビュー", { exact: true }).click();
  await page.getByRole("button", { name: "コメントを生成する" }).first().click();

  // 送信ではなく同意ダイアログが出る
  await expect(page.getByText("AIに送る内容")).toBeVisible();
  await expect(page.getByText("送らないもの")).toBeVisible();
  await page.getByRole("button", { name: "今は使わない" }).click();

  expect(aiRequests).toHaveLength(0);
});

test("同意しなくても記録・設定は使える", async ({ page }) => {
  await page.goto("/record/water");
  await page.getByRole("button", { name: "500mlを記録する" }).click();
  const totalCard = page.locator(".MuiCard-root").filter({ hasText: "今日の合計" });
  await expect(totalCard.getByText("500", { exact: true })).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByText("未同意")).toBeVisible();
});

test("設定画面から同意すると「同意済み」になり、取り消せる", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "同意する" }).click();
  await expect(page.getByText("同意済み")).toBeVisible();

  await page.getByRole("button", { name: "同意を取り消す" }).click();
  await expect(page.getByText("未同意")).toBeVisible();
});
