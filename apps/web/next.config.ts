import { existsSync } from "node:fs";
import path from "node:path";

import type { NextConfig } from "next";

// One .env at the repo root serves both apps in development.
const rootEnv = path.resolve(import.meta.dirname, "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // Self-contained server for Docker (apps/web/.next/standalone).
  output: "standalone",
  outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
  // Help articles are read from disk at request time; ship them with the server.
  outputFileTracingIncludes: {
    "/help": ["./content/help/**/*"],
    "/help/[slug]": ["./content/help/**/*"],
  },
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@pawpost/ai", "@pawpost/core", "@pawpost/db", "@pawpost/engine", "@pawpost/mail"],
  // An operations dashboard: every page shows live data, rendered per request.
  cacheComponents: false,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // CSV contact lists are uploaded through a Server Action.
      bodySizeLimit: "10mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
