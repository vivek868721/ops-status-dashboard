import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@ops/db": path.resolve(__dirname, "../../packages/db/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    hookTimeout: 60000,
    testTimeout: 60000,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
