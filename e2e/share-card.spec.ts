import { expect, skipInitialSetup, test } from "./fixtures";

/**
 * SNS共有カード(Issue #235)のスモーク。
 * カードの内容(何を載せるか)はユニットテスト(src/lib/__tests__/shareCard.test.ts)で見ているため、
 * ここでは「記録 → 導線が出る → canvasに描かれる → ファイルとして保存できる」という結線だけを確認する。
 */
test("ホームの記録からSNS共有カードの画像を作って保存できる", async ({ page }) => {
  await skipInitialSetup(page);

  // 記録が1件も無いうちは共有導線を出さない
  await page.goto("/");
  await expect(page.getByRole("button", { name: "画像をつくる" })).toHaveCount(0);

  await page.goto("/record/weight");
  await page.getByPlaceholder("72.0").fill("72.4");
  await page.getByRole("button", { name: "保存する" }).click();
  await page.waitForURL("/");

  await page.getByRole("button", { name: "画像をつくる" }).click();

  const preview = page.getByLabel("SNS共有用の画像プレビュー");
  await expect(preview).toBeVisible();
  // 実際に描かれたか(空のcanvasでないか)を、書き出したPNGの大きさで確認する
  await expect
    .poll(async () => preview.evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL().length))
    .toBeGreaterThan(5000);

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "画像を保存" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^karadalog-day-\d{4}-\d{2}-\d{2}\.png$/);
  await expect(page.getByText("画像を保存しました")).toBeVisible();
});

test("週次レビューからもSNS共有カードを開ける", async ({ page }) => {
  await skipInitialSetup(page);
  await page.goto("/record/weight");
  await page.getByPlaceholder("72.0").fill("72.4");
  await page.getByRole("button", { name: "保存する" }).click();
  await page.waitForURL("/");

  await page.goto("/trends");
  await page.getByText("レビュー", { exact: true }).click();
  await page.getByRole("button", { name: "画像をつくる" }).click();

  await expect(page.getByLabel("SNS共有用の画像プレビュー")).toBeVisible();
  // 体重の記録がある週なので「体重の数値を隠す」トグルが出る
  await expect(page.getByLabel("体重の数値を隠す")).toBeVisible();
});
