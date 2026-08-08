import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./src/db/__tests__/setup.ts"],
    // e2e/ はPlaywrightが実行するため、vitestからは除外する(Issue #198)。
    // includeで絞り込むと将来の*.test.tsx・*.spec.tsを黙って拾わなくなるため、除外側で指定する
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
