import { engine } from "@/server/engine";

/**
 * RFC 8058 one-click unsubscribe. Gmail, Yahoo and others POST
 * "List-Unsubscribe=One-Click" here when the recipient clicks their built-in button.
 * Always answers 200 so providers don't retry or flag the sender.
 */
export async function POST(_request: Request, { params }: RouteContext<"/api/unsubscribe/[token]">) {
  const { token } = await params;
  await engine().suppressions.unsubscribeByToken(token, "one_click");
  return new Response(null, { status: 200 });
}

/** Someone opened the header URL in a browser: send them to the confirm page. */
export async function GET(request: Request, { params }: RouteContext<"/api/unsubscribe/[token]">) {
  const { token } = await params;
  return Response.redirect(new URL(`/u/${token}`, request.url), 303);
}
