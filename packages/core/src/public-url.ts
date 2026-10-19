/**
 * Every email links to APP_URL (unsubscribe page and one-click header), so its
 * shape affects deliverability: spam filters distrust links to bare IP
 * addresses, and Gmail expects one-click unsubscribe over HTTPS.
 */

export type PublicUrlProblem = "invalid" | "localhost" | "ip_address" | "not_https";

export interface PublicUrlCheck {
  problem: PublicUrlProblem | null;
  /** User-facing explanation, or null when the URL is fine. */
  message: string | null;
}

const MESSAGES: Record<PublicUrlProblem, string> = {
  invalid: "The public URL (APP_URL) isn't a valid web address, so unsubscribe links in emails won't work.",
  localhost:
    "The public URL (APP_URL) points to this computer, so recipients can't open the unsubscribe link. Fine for testing, not for real sending.",
  ip_address:
    "The public URL (APP_URL) is a bare IP address. Every email links to it, and spam filters treat links to IP addresses as a strong spam signal. Put Pawpost on a domain with HTTPS before sending.",
  not_https:
    "The public URL (APP_URL) uses plain HTTP. Gmail expects HTTPS for one-click unsubscribe, and sign-ins aren't encrypted. Turn on HTTPS before sending.",
};

export function checkPublicUrl(appUrl: string): PublicUrlCheck {
  let url: URL;
  try {
    url = new URL(appUrl);
  } catch {
    return { problem: "invalid", message: MESSAGES.invalid };
  }
  const host = url.hostname.toLowerCase();

  const problem: PublicUrlProblem | null =
    host === "localhost" || host.endsWith(".localhost") || /^127(\.\d{1,3}){3}$/.test(host) || host === "[::1]"
      ? "localhost"
      : isIpAddress(host)
        ? "ip_address"
        : url.protocol !== "https:"
          ? "not_https"
          : null;

  return { problem, message: problem ? MESSAGES[problem] : null };
}

function isIpAddress(host: string): boolean {
  // URL keeps IPv6 hosts in brackets and normalises IPv4 to dotted decimal.
  return host.startsWith("[") || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}
