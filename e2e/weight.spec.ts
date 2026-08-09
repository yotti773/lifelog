import { expect, skipInitialSetup, test } from "./fixtures";

// Playwrightはテストごとに新しいブラウザコンテキストを使うため、IndexedDBは常に空から始まる

test("体重を記録するとホームに反映され、カードから編集モードで開き直せる", async ({ page }) => {
  await skipInitialSetup(page);
  await page.goto("/record/weight");
  await expect(page.getByText("体重を記録")).toBeVisible();

  await page.getByPlaceholder("72.0").fill("72.4");
  await page.getByRole("button", { name: "保存する" }).click();

  // 当日の新規記録なのでホームへ戻り、体重カードに反映される
  await page.waitForURL("/");
  await expect(page.getByText("72.4")).toBeVisible();

  // カードタップで当日分の編集モードが開く(?date=today → 既存記録あり → 編集)
  await page.getByText("72.4").click();
  await expect(page.getByText("体重を編集")).toBeVisible();
  await expect(page.getByText("日時は編集できません")).toBeVisible();

  await page.getByPlaceholder("72.0").fill("71.9");
  await page.getByRole("button", { name: "保存する" }).click();
  await page.waitForURL("/");
  await expect(page.getByText("71.9")).toBeVisible();
});
