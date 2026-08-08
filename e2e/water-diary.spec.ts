import { expect, test } from "./fixtures";

test("水分をクイック追加すると合計に反映され、記録行から削除できる", async ({ page }) => {
  await page.goto("/record/water");
  await expect(page.getByText("水分を記録")).toBeVisible();
  await expect(page.getByText("まだ記録がありません")).toBeVisible();

  await page.getByRole("button", { name: "500mlを記録する" }).click();
  // useLiveQueryで合計カードと記録リストが自動更新される。
  // クイック追加ボタンにも同じ「500」があるため、合計カードに絞って確認する
  const totalCard = page.locator(".MuiCard-root").filter({ hasText: "今日の合計" });
  await expect(totalCard.getByText("500", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /500mlを削除/ }).click();
  await expect(page.getByText("まだ記録がありません")).toBeVisible();
});

test("日記を保存すると、開き直したときドラフトとして読み込まれる", async ({ page }) => {
  await page.goto("/record/diary");
  await expect(page.getByText("今日の気分")).toBeVisible();

  await page.getByPlaceholder("今日はどんな一日でしたか？").fill("E2Eテストの日記");
  await page.getByRole("button", { name: "気分: 良い" }).click();
  await page.getByRole("button", { name: "保存する" }).click();
  await page.waitForURL("/");

  // 日記は日付キーの1日1件(後勝ち)。同じ日を開き直すと保存済みの内容がドラフトになる
  await page.goto("/record/diary");
  await expect(page.getByPlaceholder("今日はどんな一日でしたか？")).toHaveValue("E2Eテストの日記");
  await expect(page.getByRole("button", { name: "気分: 良い" })).toHaveAttribute("aria-pressed", "true");
});
