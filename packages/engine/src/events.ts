import { events, type Executor } from "@pawpost/db";

export type NewEvent = typeof events.$inferInsert;

export async function recordEvent(db: Executor, event: NewEvent): Promise<void> {
  await db.insert(events).values(event);
}
