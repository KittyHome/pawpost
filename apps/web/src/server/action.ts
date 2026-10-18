import "server-only";

import { isDomainError } from "@pawpost/engine";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import type { ActionState } from "@/lib/action-state";

import { requireSession } from "./session";

/**
 * Wraps every Server Action: authenticates, runs the use case, and turns
 * expected failures (validation, domain rules) into a message for the form.
 * Unexpected errors are logged and shown generically.
 */
export async function runAction<T = undefined>(
  task: () => Promise<{ message?: string; data?: T } | void>,
): Promise<ActionState<T>> {
  await requireSession();
  try {
    const result = await task();
    return { status: "success", ...(result ?? {}) };
  } catch (error) {
    // Let Next.js redirect()/notFound() through.
    unstable_rethrow(error);
    if (error instanceof z.ZodError) {
      const flat = z.flattenError(error);
      const first = error.issues[0]?.message ?? "Please check the form.";
      return { status: "error", message: first, fieldErrors: flat.fieldErrors as Record<string, string[]> };
    }
    if (isDomainError(error)) return { status: "error", message: error.message };
    console.error("[action] unexpected error", error);
    return { status: "error", message: "Something went wrong. Check the server logs for details." };
  }
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
