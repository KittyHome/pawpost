import { engine } from "@/server/engine";

export const dynamic = "force-dynamic";

/** Liveness + worker status, for load balancers and uptime monitors. */
export async function GET() {
  try {
    const worker = await engine().system.workerStatus();
    return Response.json({ status: "ok", worker: { online: worker.online, lastSeenAt: worker.lastSeenAt } });
  } catch {
    return Response.json({ status: "error" }, { status: 503 });
  }
}
