import { appSettings } from "@pawpost/db";
import { eq } from "drizzle-orm";

import type { EngineContext } from "./context";

const HEARTBEAT_KEY = "worker_heartbeat";
/** The dashboard shows the worker as offline after this long without a heartbeat. */
export const WORKER_OFFLINE_AFTER_MS = 2 * 60 * 1000;

export interface WorkerStatus {
  online: boolean;
  lastSeenAt: Date | null;
  version: string | null;
}

export function createSystemService(ctx: EngineContext) {
  const { db } = ctx;

  return {
    async heartbeat(info: { version: string; startedAt: Date }): Promise<void> {
      const value = { lastSeenAt: ctx.now().toISOString(), version: info.version, startedAt: info.startedAt.toISOString() };
      await db
        .insert(appSettings)
        .values({ key: HEARTBEAT_KEY, value })
        .onConflictDoUpdate({ target: appSettings.key, set: { value } });
    },

    async workerStatus(): Promise<WorkerStatus> {
      const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, HEARTBEAT_KEY) });
      const lastSeen = typeof row?.value.lastSeenAt === "string" ? new Date(row.value.lastSeenAt) : null;
      return {
        online: lastSeen !== null && ctx.now().getTime() - lastSeen.getTime() < WORKER_OFFLINE_AFTER_MS,
        lastSeenAt: lastSeen,
        version: typeof row?.value.version === "string" ? row.value.version : null,
      };
    },
  };
}
