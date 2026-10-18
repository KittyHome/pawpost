import { createHash, randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt (memory-hard, built into Node; no native addon).
 * Stored as "scrypt$<N>$<r>$<p>$<salt>$<hash>" so parameters can be raised later
 * without breaking existing hashes.
 */

const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { ...options, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, PARAMS);
  return ["scrypt", PARAMS.N, PARAMS.r, PARAMS.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), { N: Number(n), r: Number(r), p: Number(p) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Returns a user-facing problem with the password, or null when acceptable. */
export function passwordProblem(password: string, context: { email?: string; name?: string } = {}): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  if (/^(.)\1+$/.test(password)) return "Don't use a single repeated character.";
  const lower = password.toLowerCase();
  const local = context.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "Don't include your email address in the password.";
  if (["password", "1234567890", "qwertyuiop"].some((weak) => lower.includes(weak))) return "That password is too easy to guess.";
  return null;
}

/** Tokens (sessions, invites, resets) are stored only as a SHA-256 hash, so a database leak can't be replayed. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
