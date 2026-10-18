import { engine } from "@/server/engine";
import { csvDownload } from "@/server/export";

export async function GET(_request: Request, { params }: RouteContext<"/api/export/campaigns/[id]">) {
  const { id } = await params;
  return csvDownload((actor) => engine().campaigns.exportResults(actor, id));
}
