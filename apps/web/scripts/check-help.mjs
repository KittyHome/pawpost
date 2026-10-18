// Validates the in-app help: front matter of every article, and every "/help/<slug>#<anchor>"
// link found in articles and in the app's source. Runs as part of `pnpm lint`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import GithubSlugger from "github-slugger";

const root = path.resolve(import.meta.dirname, "..");
const contentDir = path.join(root, "content", "help");
const categories = new Set(["start", "setup", "campaigns", "results", "practice", "admin", "support"]);
const problems = [];

/** slug → set of heading ids (same algorithm as rehype-slug). */
const articles = new Map();
for (const file of readdirSync(contentDir).filter((f) => f.endsWith(".md"))) {
  const slug = file.replace(/\.md$/, "");
  const raw = readFileSync(path.join(contentDir, file), "utf8");
  const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!front) {
    problems.push(`${file}: missing front matter`);
    continue;
  }
  const meta = Object.fromEntries(
    front[1].split(/\r?\n/).map((line) => [line.slice(0, line.indexOf(":")).trim(), line.slice(line.indexOf(":") + 1).trim()]),
  );
  for (const key of ["title", "description", "category", "order"])
    if (!meta[key]) problems.push(`${file}: front matter needs "${key}"`);
  if (meta.category && !categories.has(meta.category)) problems.push(`${file}: unknown category "${meta.category}"`);

  const slugger = new GithubSlugger();
  const ids = new Set();
  let fence = false;
  for (const line of raw.slice(front[0].length).split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const heading = !fence && /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      const text = heading[2]
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/`([^`]*)`/g, "$1")
        .replace(/(\*\*|__|\*|_)(.*?)\1/g, "$2");
      ids.add(slugger.slug(text.trim()));
    }
  }
  articles.set(slug, ids);
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(md|tsx?|mjs)$/.test(entry)) yield full;
  }
}

// Only real link targets: quoted strings, template literals and Markdown links (not import paths).
const LINK = /(?<=["'`(])\/help\/([a-z0-9-]+)(?:#([a-z0-9-]+))?/g;
let links = 0;
for (const file of [...walk(contentDir), ...walk(path.join(root, "src"))]) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(LINK)) {
    links++;
    const [, slug, anchor] = match;
    const where = path.relative(root, file);
    if (!articles.has(slug)) problems.push(`${where}: link to unknown article /help/${slug}`);
    else if (anchor && !articles.get(slug).has(anchor)) problems.push(`${where}: /help/${slug}#${anchor}: no such heading`);
  }
}

if (problems.length) {
  console.error(`Help check failed:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`Help check passed: ${articles.size} articles, ${links} links.`);
