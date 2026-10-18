import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/server/session-token";

/**
 * Optimistic auth gate: bounces signed-out visitors to /login before rendering.
 * Pages and Server Actions still verify the session themselves.
 */
export function proxy(request: NextRequest) {
  const secret = process.env.APP_SECRET ?? "";
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret);
  if (session) return NextResponse.next();

  const login = new URL("/login", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  // Public: login, recipient-facing unsubscribe pages, health check, static assets.
  matcher: ["/((?!login|u/|api/unsubscribe|api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico)$).*)"],
};
