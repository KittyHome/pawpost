import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "./env";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS, verifySessionToken } from "./session-token";

export interface Session {
  email: string;
}

/** Authoritative check. Call at the top of every Server Action and protected page. */
export async function requireSession(): Promise<Session> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token, env().APP_SECRET);
  if (!payload || payload.sub !== env().ADMIN_EMAIL) redirect("/login");
  return { email: payload.sub };
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = verifySessionToken(token, env().APP_SECRET);
  return payload && payload.sub === env().ADMIN_EMAIL ? { email: payload.sub } : null;
}

export function checkCredentials(email: string, password: string): boolean {
  const config = env();
  // Compare digests so timing doesn't reveal length or matching prefixes.
  const digest = (v: string) => createHash("sha256").update(v).digest();
  const emailOk = timingSafeEqual(digest(email.trim().toLowerCase()), digest(config.ADMIN_EMAIL));
  const passwordOk = timingSafeEqual(digest(password), digest(config.ADMIN_PASSWORD));
  return emailOk && passwordOk;
}

export async function startSession(email: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, createSessionToken(email, env().APP_SECRET), {
    httpOnly: true,
    sameSite: "lax",
    secure: env().APP_URL.startsWith("https://"),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
