import "server-only";

import { isDomainError, type Actor } from "@pawpost/engine";

import { getSession } from "./session";

/**
 * Runs an export for the signed-in user and returns it as a CSV download.
 * The engine checks the "data.export" permission and writes the audit entry.
 */
export async function csvDownload(build: (actor: Actor) => Promise<{ filename: string; csv: string }>): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Sign in to download exports.", { status: 401 });
  try {
    const { filename, csv } = await build(session.actor);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]/g, "_")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (isDomainError(error)) {
      return new Response(error.message, { status: error.code === "forbidden" ? 403 : error.code === "not_found" ? 404 : 400 });
    }
    throw error;
  }
}
