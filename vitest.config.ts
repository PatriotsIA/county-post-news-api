import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // SAM copies compiled tests into .aws-sam; only run source tests once.
    include: ["tests/**/*.test.ts"],
  },
});
