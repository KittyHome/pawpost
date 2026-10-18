import "server-only";

import { isDomainError } from "@pawpost/engine";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";

import { requireSession, type CurrentSession } from "./session";

type ActionResult<T> = { message?: string; data?: T } | void;

/**
 * Wraps every signed-in Server Action: authenticates, hands the task the
 * current session (whose `actor` the engine uses for permissions and the audit
 * log), and turns expected failures into a message for the form.
 */
export async function runAction<T = undefined>(
  task: (session: CurrentSession) => Promise<ActionResult<T>>,
): Promise<ActionState<T>> {
  const session = await requireSession();
  return settle(() => task(session));
}

/** Same error handling for public actions (sign-in, setup, invitations, password reset). */
export async function runPublicAction<T = undefined>(task: () => Promise<ActionResult<T>>): Promise<ActionState<T>> {
  return settle(task);
}

async function settle<T>(task: () => Promise<ActionResult<T>>): Promise<ActionState<T>> {
  try {
    const result = await task();
    return { status: "success", ...(result ?? {}) };
  } catch (error) {
    // Let Next.js redirect()/notFound() through.
    unstable_rethrow(error);
    if (isZodError(error)) {
      const flat = z.flattenError(error);
      const first = error.issues[0]?.message ?? "Please check the form.";
      return { status: "error", message: first, fieldErrors: flat.fieldErrors as Record<string, string[]> };
    }
    if (isDomainError(error)) return { status: "error", message: error.message };
    console.error("[action] unexpected error", error);
    return { status: "error", message: "Something went wrong. Check the server logs for details." };
  }
}

/** Structural check: the engine's copy of zod may differ from this bundle's (see core/errors.ts). */
function isZodError(error: unknown): error is z.ZodError {
  return (
    error instanceof z.ZodError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { name?: unknown }).name === "ZodError" &&
      Array.isArray((error as { issues?: unknown }).issues))
  );
}

/** FormData → plain object. Repeated keys listed in `arrays` become arrays. */
export function formToObject(form: FormData, arrays: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(form.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = form.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = arrays.includes(key) ? values : values[0];
  }
  for (const key of arrays) out[key] ??= [];
  return out;
}
