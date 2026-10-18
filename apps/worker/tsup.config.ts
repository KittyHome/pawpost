import { cpSync } from "node:fs";

import { defineConfig } from "tsup";

// Bundle everything (workspace TypeScript source and third-party packages) into one
// self-contained dist/index.js, so the production image needs no node_modules.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  noExternal: [/.*/],
  // Ship the SQL migrations next to the bundle (dist/migrations).
  onSuccess: async () => {
    cpSync("../../packages/db/migrations", "dist/migrations", { recursive: true });
  },
  // Bundled CommonJS dependencies call require(); give the ESM bundle one.
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
});
