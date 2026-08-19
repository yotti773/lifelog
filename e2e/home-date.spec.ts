import { expect, skipInitialSetup, test } from "./fixtures";

/**
 * ホームの日付ナビ(Issue #226)のスモーク。
 * 日付の解決・連続記録の数え方はユニットテスト側で見ているため、ここでは
 * 「◀▶でURLの日付が変わり、画面が表示日に追従する」という結線だけを確認する。
 */
test("ホームで前の日へ移動でき、1タップで今日へ戻れる", async ({ page }) => {
  await skipInitialSetup(page);

  await page.goto("/record/weight");
  await page.getByPlaceholder("72.0").fill("72.4");
  await page.getByRole("button", { name: "保存する" }).click();
  await page.waitForURL("/");
  await expect(page.getByText("72.4")).toBeVisible();

  // 今日は「次の日」へ進めない(未来の記録は存在しないため)
  await expect(page.getByRole("button", { name: "次の日" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "今日へ" })).toHaveCount(0);

  await page.getByRole("button", { name: "前の日" }).click();
  await expect(page).toHaveURL(/\?date=\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByText("昨日の記録")).toBeVisible();
  // 表示日の記録に切り替わる(今日の体重は出ない)
  await expect(page.getByText("72.4")).toHaveCount(0);
  await expect(page.getByText("この日の摂取カロリー")).toBeVisible();

  await page.getByRole("button", { name: "今日へ" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("72.4")).toBeVisible();
});

test("日付を指定して開くと、その日の記録画面へ日付が引き継がれる", async ({ page }) => {
  await skipInitialSetup(page);
  await page.goto("/?date=2026-01-15");

  await expect(page.getByText("1月15日")).toBeVisible();

  // 未記録の過去日でも、カードからその日の記録に入れる(日付が引き継がれる)
  await page.getByRole("button", { name: /昼食/ }).first().click();
  await expect(page).toHaveURL(/\/record\/meal\?type=lunch&date=2026-01-15/);
  await expect(page.getByText("1/15の昼食を記録")).toBeVisible();
});
