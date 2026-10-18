import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "pawpost_session";

/**
 * Optimistic gate: visitors without a session cookie go to sign-in before any
 * page renders. Whether the session is valid is checked against the database
 * by every page and Server Action (server/session.ts).
 */
export function proxy(request: NextRequest) {
  if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

  const login = new URL("/login", request.url);
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  // Public: sign-in and account flows, recipient-facing unsubscribe pages, health check, static assets.
  matcher: [
    "/((?!login|setup|invite/|forgot-password|reset-password/|u/|api/unsubscribe|api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico)$).*)",
  ],
};
