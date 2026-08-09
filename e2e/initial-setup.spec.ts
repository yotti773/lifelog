import { test, expect } from "@playwright/test";

test.describe("初回セットアップ", () => {
  test.beforeEach(async ({ context }) => {
    // IndexedDBをクリアして、新規ユーザー状態をシミュレート
    await context.addInitScript(() => {
      const dbReq = indexedDB.deleteDatabase("lifelog");
      return new Promise((resolve) => {
        dbReq.onsuccess = () => resolve(null);
        dbReq.onerror = () => resolve(null);
      });
    });
  });

  test("初回起動時にセットアップ画面が表示される", async ({ page }) => {
    await page.goto("http://localhost:5173");
    await expect(page).toHaveURL("http://localhost:5173/setup");
    await expect(page.locator("text=プロフィールと目標を設定しましょう")).toBeVisible();
  });

  test("セットアップ画面でスキップできる", async ({ page }) => {
    await page.goto("http://localhost:5173/setup");
    await expect(page.locator("button:has-text('スキップして始める')")).toBeVisible();
    await page.click("button:has-text('スキップして始める')");
    await expect(page).toHaveURL("http://localhost:5173/");
  });

  test("すべての項目を入力すると『はじめる』ボタンが有効になる", async ({ page }) => {
    await page.goto("http://localhost:5173/setup");

    // 身長を入力
    await page.click('text="身長"');
    await page.fill('input[type="number"]', "170");
    await page.click("button:has-text('保存')");
    await page.waitForTimeout(300);

    // 生年を入力
    await page.click('text="生年"');
    await page.fill('input[type="number"]', "1990");
    await page.click("button:has-text('保存')");
    await page.waitForTimeout(300);

    // 性別を選択
    await page.click('text="性別"');
    await page.click('text="男性"');
    await page.click("button:has-text('保存')");
    await page.waitForTimeout(300);

    // 活動レベルを選択
    await page.click('text="活動レベル"');
    await page.click('text="低い"');
    await page.click("button:has-text('保存')");
    await page.waitForTimeout(300);

    // 目標体重を入力
    await page.click('text="目標体重"');
    await page.fill('input[type="number"]', "65");
    await page.click("button:has-text('保存')");
    await page.waitForTimeout(300);

    // 目標日を入力
    await page.click('text="目標日"');
    await page.fill('input[type="date"]', "2026-12-31");
    await page.click("button:has-text('保存')");
    await page.waitForTimeout(300);

    // 目標カロリーを入力
    await page.click('text="1日の目標カロリー"');
    await page.fill('input[type="number"]', "1900");
    await page.click("button:has-text('保存')");
    await page.waitForTimeout(300);

    // はじめるボタンが有効になったか確認
    const beginButton = page.locator('button:has-text("はじめる")').first();
    await expect(beginButton).not.toBeDisabled();
  });

  test("すべてのセットアップ項目を入力してホームへ遷移できる", async ({ page }) => {
    await page.goto("http://localhost:5173/setup");

    // 最小限の必須項目を入力
    const fillProfile = async () => {
      await page.click('text="身長"');
      await page.fill('input[type="number"]', "170");
      await page.click("button:has-text('保存')");
      await page.waitForTimeout(300);

      await page.click('text="生年"');
      await page.fill('input[type="number"]', "1990");
      await page.click("button:has-text('保存')");
      await page.waitForTimeout(300);

      await page.click('text="性別"');
      await page.click('text="男性"');
      await page.click("button:has-text('保存')");
      await page.waitForTimeout(300);

      await page.click('text="活動レベル"');
      await page.click('text="低い"');
      await page.click("button:has-text('保存')");
      await page.waitForTimeout(300);

      await page.click('text="目標体重"');
      await page.fill('input[type="number"]', "65");
      await page.click("button:has-text('保存')");
      await page.waitForTimeout(300);

      await page.click('text="目標日"');
      await page.fill('input[type="date"]', "2026-12-31");
      await page.click("button:has-text('保存')");
      await page.waitForTimeout(300);

      await page.click('text="1日の目標カロリー"');
      await page.fill('input[type="number"]', "1900");
      await page.click("button:has-text('保存')");
      await page.waitForTimeout(300);
    };

    await fillProfile();

    // はじめるボタンをクリック
    await page.click('button:has-text("はじめる"):not(:has-text("スキップ"))');
    await expect(page).toHaveURL("http://localhost:5173/");
    await expect(page.locator("text=おはよう|こんにちは|こんばんは")).toBeVisible();
  });
});
