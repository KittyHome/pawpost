/**
 * Stateless signed session tokens: "<payload>.<signature>", both base64url.
 * Used by proxy.ts (optimistic check) and by server code (authoritative check).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "pawpost_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

interface SessionPayload {
  sub: string;
  exp: number;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", `pawpost:session:${secret}`).update(data).digest("base64url");
}

export function createSessionToken(email: string, secret: string, now = Date.now()): string {
  const payload: SessionPayload = { sub: email, exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): SessionPayload | null {
  if (!token) return null;
  const [data, signature] = token.split(".");
  if (!data || !signature) return null;

  const expected = Buffer.from(sign(data, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    return payload.exp * 1000 > now ? payload : null;
  } catch {
    return null;
  }
}
