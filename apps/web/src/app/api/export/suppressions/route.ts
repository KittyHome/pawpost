import { engine } from "@/server/engine";
import { csvDownload } from "@/server/export";

export async function GET() {
  return csvDownload((actor) => engine().suppressions.exportCsv(actor));
}
