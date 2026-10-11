import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["assets/**/*.test.{js,jsx,ts,tsx}"],
    // The upstream brain suites use node:test and run via test:brain instead.
    exclude: [
      "cortex-web-app/**", "node_modules/**", "dist/**",
      "assets/js/services/uploadBrainData.test.js",
      "assets/js/services/preloadedBrainData.test.js",
      "assets/js/services/uploadBrainProjection.test.js",
    ],
  },
});
