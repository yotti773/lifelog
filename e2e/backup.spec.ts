import { expect, test } from "./fixtures";

// 書き出し→編集→復元と画面遷移が多く、既定の30秒では足りない
test.setTimeout(90_000);

test("完全バックアップを書き出し、編集後に復元すると書き出し時点の断面へ戻る", async ({ page }) => {
  // 退避対象のデータを作る
  await page.goto("/record/weight");
  await page.getByPlaceholder("72.0").fill("72.4");
  await page.getByRole("button", { name: "保存する" }).click();
  await page.waitForURL("/");

  // 書き出し(JSONダウンロード)
  await page.goto("/settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONファイルに書き出す" }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  await expect(page.getByText(/書き出しました/)).toBeVisible();

  // 書き出し後にデータを変える(復元で巻き戻ることを確認するため)
  await page.goto("/record/weight");
  await page.getByPlaceholder("72.0").fill("70.1");
  await page.getByRole("button", { name: "保存する" }).click();
  await page.waitForURL("/");
  await expect(page.getByText("70.1")).toBeVisible();

  // 復元はファイル選択→内容確認→「置き換える」の2段階(取り消せないため)
  await page.goto("/settings");
  await page.locator('input[type="file"]').setInputFiles(backupPath);
  await expect(page.getByText("いまの端末のデータを全て消して、この内容に置き換えます。取り消せません")).toBeVisible();
  await page.getByRole("button", { name: "置き換える" }).click();
  await expect(page.getByText(/復元しました/)).toBeVisible();

  // 書き出し時点の断面(72.4)に巻き戻っている
  await page.goto("/");
  await expect(page.getByText("72.4")).toBeVisible();
});
