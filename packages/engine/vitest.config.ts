import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests start a real Postgres cluster; give them room.
    testTimeout: 60_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
