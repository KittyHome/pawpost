import { fileURLToPath } from "node:url";

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase, type Database } from "./client";

/** Folder of generated SQL migrations. Override when the package is bundled (e.g. the worker's Docker image). */
export const defaultMigrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

export async function runMigrations(url: string, migrationsFolder = defaultMigrationsFolder): Promise<void> {
  const { db, close } = createDatabase(url, { max: 1 });
  try {
    await assertUtf8(db);
    await migrate(db, { migrationsFolder });
  } finally {
    await close();
  }
}

/**
 * Contact names come from all over the world. A database created with a legacy
 * encoding (e.g. WIN1252, the default on Windows) rejects them mid-import, so
 * refuse to start on one instead.
 */
async function assertUtf8(db: Database): Promise<void> {
  const [row] = await db.execute<{ server_encoding: string }>(sql`show server_encoding`);
  const encoding = row?.server_encoding ?? "unknown";
  if (encoding.toUpperCase() !== "UTF8") {
    throw new Error(
      `The database uses the ${encoding} character encoding; Pawpost needs UTF8. ` +
        `Create the database with: CREATE DATABASE pawpost ENCODING 'UTF8' TEMPLATE template0;`,
    );
  }
}
