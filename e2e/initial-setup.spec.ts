import { expect, test, type Page } from "./fixtures";

// Playwrightはテストごとに新しいブラウザコンテキストを使うため、IndexedDBは常に空から始まる
// = 目標未設定の新規ユーザーの状態(Issue #217)がそのまま初期条件になる

/** 設定行をタップ → 数値/日付を入れて保存する(設定画面と同じValueEditorDrawer) */
async function editValue(page: Page, label: string, value: string) {
  await page.getByText(label, { exact: true }).click();
  // 入力欄はtype="text"+inputMode(ステッパー併設のため)。日付だけtype="date"
  const dateInput = page.locator('input[type="date"]');
  if (await dateInput.count()) {
    await dateInput.fill(value);
  } else {
    await page.getByRole("textbox").fill(value);
  }
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByRole("button", { name: "保存する" })).toBeHidden();
}

/** 選択式(性別・活動レベル)の設定行 */
async function pickValue(page: Page, label: string, option: string) {
  await page.getByText(label, { exact: true }).click();
  await page.getByText(option, { exact: true }).click();
  await page.getByRole("button", { name: "保存する" }).click();
  await expect(page.getByRole("button", { name: "保存する" })).toBeHidden();
}

/** 必須の目標3項目だけを入れる */
async function fillRequiredGoals(page: Page) {
  await editValue(page, "目標体重", "65");
  await editValue(page, "目標日", "2026-12-31");
  await editValue(page, "1日の目標カロリー", "1900");
}

test("目標が未設定なら初回セットアップへ誘導され、下部ナビは出ない", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("/setup");
  await expect(page.getByText("まず、目標を決めましょう")).toBeVisible();

  // 全画面フローなので下部ナビを出さない(出すと目標未設定のまま他タブへ素通りできてしまう)
  await expect(page.getByRole("navigation")).toBeHidden();

  // 必須が未入力のうちは「はじめる」を押せない
  await expect(page.getByRole("button", { name: "はじめる" })).toBeDisabled();
});

test("目標3項目を入れると「はじめる」でホームへ進める(任意項目は未設定のままでよい)", async ({ page }) => {
  await page.goto("/setup");
  await fillRequiredGoals(page);

  // 必須が揃っても自動遷移しない — 任意項目に触れる余地を残す(Issue #217)
  await expect(page).toHaveURL("/setup");
  await expect(page.getByText("PFC目標")).toBeVisible();

  const begin = page.getByRole("button", { name: "はじめる" });
  await expect(begin).toBeEnabled();
  await begin.click();
  await page.waitForURL("/");

  // ホームへ戻ったあと差し戻されない
  await expect(page.getByText("今日の摂取カロリー")).toBeVisible();
  await expect(page.getByText("目標 1,900 kcal")).toBeVisible();
});

test("身体プロフィールは任意で、未入力でも先へ進める", async ({ page }) => {
  await page.goto("/setup");
  await fillRequiredGoals(page);
  // プロフィールを1つも入れていない状態で活性になっている
  await expect(page.getByText("身長")).toBeVisible();
  await expect(page.getByRole("button", { name: "はじめる" })).toBeEnabled();
});

test("プロフィールも設定画面と同じ操作で1項目ずつ入力できる", async ({ page }) => {
  await page.goto("/setup");
  await editValue(page, "身長", "170");
  await pickValue(page, "性別", "男性");
  await expect(page.getByText("170 cm")).toBeVisible();
  await expect(page.getByText("男性")).toBeVisible();
});

test("「あとで設定する」で目標未設定のままホームへ抜けられ、以後は差し戻されない", async ({ page }) => {
  await page.goto("/setup");
  await page.getByRole("button", { name: "あとで設定する" }).click();
  await page.waitForURL("/");

  // 目標が無くても記録機能は使える。カロリーカードは実績だけを出す
  await expect(page.getByText("今日の摂取カロリー")).toBeVisible();
  await expect(page.getByText(/目標 .* kcal/)).toBeHidden();

  // 再訪しても初回セットアップへ戻されない(移行ユーザーが記録を始められること)
  await page.goto("/");
  await expect(page).toHaveURL("/");
});

test("目標未設定でも記録でき、推移画面にダミーの目標が出ない", async ({ page }) => {
  // セットアップ→記録→グラフと3画面を渡り歩くうえ、グラフはdevサーバーの初回コンパイルが重い
  test.slow();
  await page.goto("/setup");
  await page.getByRole("button", { name: "あとで設定する" }).click();
  await page.waitForURL("/");

  await page.goto("/record/weight");
  await page.getByPlaceholder("72.0").fill("72.4");
  await page.getByRole("button", { name: "保存する" }).click();
  await page.waitForURL("/");
  await expect(page.getByText("72.4")).toBeVisible();

  // 回帰: 目標に0kg/1kcalのダミーを充てていた頃は「目標 0kg」「目標 1」が描画されていた。
  // グラフ画面はdevサーバーの初回コンパイルが重いため、load完了ではなく表示アサーションで待つ
  await page.goto("/trends", { waitUntil: "commit" });
  // 初回コンパイル待ちのため、この1つだけ既定(5秒)より長く待つ
  await expect(page.getByText("摂取カロリー", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("目標 0kg")).toBeHidden();
  await expect(page.getByText("目標 1", { exact: true })).toBeHidden();
});
