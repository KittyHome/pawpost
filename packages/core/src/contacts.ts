/** Email and name hygiene for imported contacts. */

// Pragmatic, not RFC 5322: rejects what real mailbox providers reject anyway.
const EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

const ROLE_LOCAL_PARTS = new Set([
  "abuse",
  "admin",
  "administrator",
  "billing",
  "careers",
  "contact",
  "help",
  "hello",
  "hr",
  "info",
  "jobs",
  "mail",
  "marketing",
  "noreply",
  "no-reply",
  "office",
  "postmaster",
  "press",
  "privacy",
  "sales",
  "security",
  "support",
  "team",
  "webmaster",
]);

export function normalizeEmail(raw: string): string {
  return raw
    .trim()
    .replace(/^mailto:/i, "")
    .toLowerCase();
}

export function isValidEmail(email: string): boolean {
  if (email.length > 254) return false;
  const local = email.slice(0, email.indexOf("@"));
  if (local.length === 0 || local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  return EMAIL_PATTERN.test(email);
}

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf("@") + 1);
}

/** Shared inboxes like info@ or support@ complain more and reply less. */
export function isRoleAddress(email: string): boolean {
  return ROLE_LOCAL_PARTS.has(email.slice(0, email.indexOf("@")));
}

export interface ContactName {
  firstName: string | null;
  lastName: string | null;
}

/**
 * Turns whatever is in the name column into a usable first/last name.
 * Username-like values ("aa5536", "adamw17") become null so templates fall back
 * to a neutral greeting instead of "Hi aa5536".
 */
export function cleanName(rawName: string, email: string): ContactName {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name || looksLikeUsername(name, email)) return { firstName: null, lastName: null };

  const [first, ...rest] = name.split(" ");
  return {
    firstName: titleCaseIfFlat(first!) || null,
    lastName: rest.length ? rest.map(titleCaseIfFlat).join(" ") : null,
  };
}

export function cleanNamePart(raw: string | undefined): string | null {
  const value = raw?.trim().replace(/\s+/g, " ");
  if (!value || /\d|@/.test(value)) return null;
  return titleCaseIfFlat(value);
}

function looksLikeUsername(name: string, email: string): boolean {
  const local = email.slice(0, email.indexOf("@"));
  if (name.toLowerCase() === local) return true;
  if (/[\d@_]/.test(name)) return true;
  // A single all-lowercase token like "alexramsdell" is almost always a handle.
  if (!name.includes(" ") && name === name.toLowerCase() && name.length > 3) return true;
  // Single letters or initials aren't worth greeting by.
  return name.replace(/\./g, "").length < 2;
}

/** "ALICE" / "alice" → "Alice"; leaves deliberate casing like "McKenzie" alone. */
function titleCaseIfFlat(part: string): string {
  if (part === part.toLowerCase() || part === part.toUpperCase()) {
    return part.toLowerCase().replace(/(^|[-'])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
  }
  return part;
}
