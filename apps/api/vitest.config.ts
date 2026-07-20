import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@babyloop/database/schema": fileURLToPath(new URL("../../packages/database/src/schema/index.ts", import.meta.url)),
      "@babyloop/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 60_000
  }
});
