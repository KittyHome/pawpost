import "server-only";

import type { Actor, PublicUser, RequestMeta } from "@pawpost/engine";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { engine, ensureBootstrap } from "./engine";
import { env } from "./env";

export const SESSION_COOKIE = "pawpost_session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface CurrentSession {
  user: PublicUser;
  sessionId: string;
  /** The user as the engine's acting identity, with the request IP for the audit log. */
  actor: Actor;
}

/** Client IP and user agent, for sessions and the audit log. */
export async function requestMeta(): Promise<RequestMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ip: forwarded || h.get("x-real-ip") || null, userAgent: h.get("user-agent") };
}

/** The signed-in user for this request, or null. Memoised per request. */
export const getSession = cache(async (): Promise<CurrentSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const info = await engine().accounts.authenticate(token);
  if (!info) return null;
  const { ip } = await requestMeta();
  const { id, email, name, role } = info.user;
  return { ...info, actor: { id, email, name, role, ip } };
});

/** Authoritative check for pages and actions: redirects to sign-in when signed out. */
export async function requireSession(): Promise<CurrentSession> {
  const session = await getSession();
  if (session) return session;
  await ensureBootstrap();
  redirect((await engine().accounts.hasUsers()) ? "/login" : "/setup");
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().APP_URL.startsWith("https://"),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}
