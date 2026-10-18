/**
 * Account recovery from the command line, for when nobody who could issue a
 * reset link can sign in (typically a locked-out owner).
 *
 *   pnpm user:reset-link owner@example.com
 *
 * Prints a one-time password reset link, valid for 24 hours. Requires access to
 * the server's configuration (.env) and database, so it is as safe as the server.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import { createDatabase } from "../packages/db/src/index";
import { createEngine } from "../packages/engine/src/index";

const envFile = path.resolve(import.meta.dirname, "../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

const email = process.argv[2];
const { DATABASE_URL, APP_SECRET, APP_URL } = process.env;
if (!email) {
  console.error("Usage: pnpm user:reset-link <email>");
  process.exit(1);
}
if (!DATABASE_URL || !APP_SECRET || !APP_URL) {
  console.error("DATABASE_URL, APP_SECRET and APP_URL must be set (see .env.example).");
  process.exit(1);
}

const { db, close } = createDatabase(DATABASE_URL, { max: 1 });
const engine = createEngine({ db, appSecret: APP_SECRET, appUrl: APP_URL });
try {
  const url = await engine.accounts.createRecoveryLink(email);
  console.log(`\nPassword reset link for ${email} (valid 24 hours, one use):\n\n  ${url}\n`);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  engine.close();
  await close();
}
