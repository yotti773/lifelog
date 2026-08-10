import { expect, skipInitialSetup, test } from "./fixtures";

test("食事を手入力で記録するとホームの摂取カロリー・食事リストに反映される", async ({ page }) => {
  await skipInitialSetup(page);
  await page.goto("/record/meal?type=lunch");
  await expect(page.getByText("昼食を記録")).toBeVisible();

  await page.getByPlaceholder("料理名を入力").fill("焼き魚定食");
  await page.getByLabel("品目1のカロリー(kcal)").fill("650");
  await page.getByLabel("品目1のP(g)").fill("35");

  // 入力済み品目があるとラベルが「保存する(n品)」になる
  await page.getByRole("button", { name: /保存する/ }).click();

  await page.waitForURL("/");
  // カロリーカードの合計と、今日の食事リストの両方に反映される。
  // 同じ「650」が食事リスト側にも出るため、それぞれのカードに絞って確認する
  const calorieCard = page.locator(".MuiCard-root").filter({ hasText: "今日の摂取カロリー" });
  await expect(calorieCard.getByText("650", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /昼食を編集する/ })).toContainText("650");
  await expect(page.getByText("焼き魚定食")).toBeVisible();
});
