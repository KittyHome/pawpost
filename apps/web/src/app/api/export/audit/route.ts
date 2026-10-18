import type { NextRequest } from "next/server";

import { engine } from "@/server/engine";
import { csvDownload } from "@/server/export";

/** Exports the audit log, honouring the same ?action= and ?user= filters as the page. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return csvDownload((actor) =>
    engine().audit.exportFor(actor, {
      action: params.get("action") || undefined,
      actorId: params.get("user") || undefined,
    }),
  );
}
