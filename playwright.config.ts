import { defineConfig } from "@playwright/test";

/**
 * E2Eスモークテスト(Issue #198)。ユニットテストでは見えない結線
 * (ルーティング・useLiveQuery・フォーム→IndexedDB)を、クリティカルフローに絞って確認する。
 *
 * 実行: `npm run e2e`(初回はブラウザ取得のため `npx playwright install chromium` が必要)。
 * devサーバーはwebServer設定で自動起動される(起動済みならそれを再利用)。
 * `npm run test`(vitest)には含めない。CIゲートは設けない方針(Issue #18)のまま、
 * リリース前にローカルで実行する運用とする。
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:5173",
    // 主対象がスマホPWAのため、モバイル相当の幅で実行する
    viewport: { width: 400, height: 800 },
    // 標準のブラウザディレクトリにChromiumが無い環境(サンドボックス等)向けの上書き
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
});
