import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@ops/db": path.resolve(__dirname, "../../packages/db/src/index.ts"),
    },
  },
  test: {
    environment: "node",
  },
});
