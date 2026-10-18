import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "./client";

/** Folder of generated SQL migrations. Override when the package is bundled (e.g. the worker's Docker image). */
export const defaultMigrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

export async function runMigrations(url: string, migrationsFolder = defaultMigrationsFolder): Promise<void> {
  const { db, close } = createDatabase(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await close();
  }
}
