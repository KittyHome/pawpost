/**
 * Spots replies that ask to stop ("please remove me", "unsubscribe").
 * Only the reply's own text is checked, not the quoted original below it,
 * because our footer contains the word "Unsubscribe".
 */

const OPT_OUT_PATTERNS = [
  /\bunsubscribe\b/i,
  /\bremove me\b/i,
  /\btake me off\b/i,
  /\bstop (e-?mailing|contacting|sending)\b/i,
  /\b(do not|don't|dont) (e-?mail|contact) me\b/i,
  /\bnot interested\b/i,
  /^\s*stop\.?\s*$/im,
];

export function stripQuotedReply(text: string): string {
  const lines: string[] = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (/^\s*>/.test(line)) break;
    // "On Tue, 13 Oct 2026, Sam <sam@x> wrote:" and Outlook's separator start the quoted part.
    if (/^On .+wrote:\s*$/.test(line) || /^-{2,}\s*Original Message\s*-{2,}/i.test(line) || /^From: .+/.test(line)) break;
    if (line.trim() === "--") break;
    lines.push(line);
  }
  return lines.join("\n").trim();
}

export function isOptOutReply(text: string): boolean {
  const own = stripQuotedReply(text).slice(0, 1000);
  return OPT_OUT_PATTERNS.some((pattern) => pattern.test(own));
}
