import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
/** A database handle or an open transaction; services accept either. */
export type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface DatabaseHandle {
  db: Database;
  close(): Promise<void>;
}

/**
 * One postgres.js pool per process and URL. Next.js splits the server into
 * chunks that each evaluate this module, and without a process-wide cache every
 * chunk opened its own pool until Postgres returned "too many clients already".
 */
const globalForPools = globalThis as unknown as { __pawpostPools?: Map<string, DatabaseHandle> };
const pools = (globalForPools.__pawpostPools ??= new Map());

export function createDatabase(url: string, options: { max?: number } = {}): DatabaseHandle {
  const max = options.max ?? 10;
  const key = `${url}#${max}`;
  const existing = pools.get(key);
  if (existing) return existing;

  const client = postgres(url, {
    max,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    connect_timeout: 10,
    // Keep timestamps as JS Dates and quiet NOTICE spam from migrations.
    onnotice: () => {},
  });
  const handle: DatabaseHandle = {
    db: drizzle(client, { schema }),
    close: async () => {
      pools.delete(key);
      await client.end({ timeout: 5 });
    },
  };
  pools.set(key, handle);
  return handle;
}
