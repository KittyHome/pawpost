import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Mailbox passwords are stored encrypted with AES-256-GCM.
 * Format: "v1.<iv>.<authTag>.<ciphertext>", each part base64url.
 */

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";

export type SecretKey = Buffer & { readonly __brand: "SecretKey" };

/** Derives the encryption key from APP_SECRET. Changing APP_SECRET makes stored passwords unreadable. */
export function deriveSecretKey(appSecret: string): SecretKey {
  if (appSecret.length < 32) {
    throw new Error("APP_SECRET must be at least 32 characters.");
  }
  return createHash("sha256").update(`pawpost:secrets:${appSecret}`).digest() as SecretKey;
}

export function encryptSecret(plaintext: string, key: SecretKey): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ciphertext].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptSecret(payload: string, key: SecretKey): string {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) {
    throw new Error("Unrecognised encrypted secret format.");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

/** URL-safe random token, e.g. for unsubscribe links. */
export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
