import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": process.cwd(),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
});
