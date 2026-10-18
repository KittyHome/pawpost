import { engine } from "@/server/engine";
import { csvDownload } from "@/server/export";

export async function GET(_request: Request, { params }: RouteContext<"/api/export/lists/[id]">) {
  const { id } = await params;
  return csvDownload((actor) => engine().lists.exportCsv(actor, id));
}
