import { Resolver } from "node:dns/promises";

/**
 * ok        the domain can receive mail (MX, or an A/AAAA fallback per RFC 5321)
 * no_mail   the domain doesn't exist or publishes no mail route → the address will bounce
 * unknown   lookup timed out or failed → keep the contact, don't guess
 */
export type DomainMailStatus = "ok" | "no_mail" | "unknown";

/** Big providers always accept mail; skip the lookup. */
const KNOWN_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
]);

export async function checkMailDomains(
  domains: Iterable<string>,
  options: { concurrency?: number; timeoutMs?: number } = {},
): Promise<Map<string, DomainMailStatus>> {
  const resolver = new Resolver({ timeout: options.timeoutMs ?? 4000, tries: 2 });
  const queue = [...new Set([...domains].map((d) => d.toLowerCase()))];
  const results = new Map<string, DomainMailStatus>();

  const worker = async () => {
    for (let domain = queue.shift(); domain !== undefined; domain = queue.shift()) {
      results.set(domain, KNOWN_MAIL_DOMAINS.has(domain) ? "ok" : await checkDomain(resolver, domain));
    }
  };
  await Promise.all(Array.from({ length: options.concurrency ?? 10 }, worker));
  return results;
}

async function checkDomain(resolver: Resolver, domain: string): Promise<DomainMailStatus> {
  try {
    const mx = await resolver.resolveMx(domain);
    // A "null MX" (RFC 7505) explicitly says the domain accepts no mail.
    if (mx.length === 1 && mx[0]!.exchange === "") return "no_mail";
    if (mx.length > 0) return "ok";
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "ENOTFOUND") return "no_mail";
    if (code !== "ENODATA") return "unknown";
  }
  try {
    const a = await resolver.resolve4(domain).catch(() => resolver.resolve6(domain));
    return a.length > 0 ? "ok" : "no_mail";
  } catch (error) {
    const code = (error as { code?: string }).code;
    return code === "ENOTFOUND" || code === "ENODATA" ? "no_mail" : "unknown";
  }
}
