/**
 * Local Postgres for development without Docker.
 *
 *   pnpm db:dev
 *
 * Starts a persistent cluster in ./.data/postgres, creates the "pawpost" database,
 * applies migrations and keeps running until Ctrl+C. Use the printed DATABASE_URL
 * in your .env.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import EmbeddedPostgres from "embedded-postgres";

import { runMigrations } from "../packages/db/src/migrate";

const PORT = Number(process.env.DEV_DB_PORT ?? 54329);
const DATA_DIR = path.resolve(import.meta.dirname, "../.data/postgres");
const USER = "pawpost";
const PASSWORD = "pawpost";
const DATABASE = "pawpost";

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  port: PORT,
  user: USER,
  password: PASSWORD,
  persistent: true,
  onLog: () => {},
  onError: (message) => console.error(String(message).trim()),
});

const fresh = !existsSync(path.join(DATA_DIR, "PG_VERSION"));
if (fresh) await pg.initialise();
await pg.start();

const client = pg.getPgClient();
await client.connect();
const exists = await client.query("select 1 from pg_database where datname = $1", [DATABASE]);
await client.end();
if (exists.rowCount === 0) await pg.createDatabase(DATABASE);

const url = `postgres://${USER}:${PASSWORD}@localhost:${PORT}/${DATABASE}`;
await runMigrations(url);

console.log(`\nPostgres is running${fresh ? " (new cluster)" : ""}.`);
console.log(`DATABASE_URL=${url}\n`);
console.log("Press Ctrl+C to stop.");

const shutdown = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
