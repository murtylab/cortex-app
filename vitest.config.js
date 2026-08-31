import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["assets/**/*.test.{js,jsx,ts,tsx}"],
    exclude: ["cortex-web-app/**", "node_modules/**", "dist/**"],
  },
});
