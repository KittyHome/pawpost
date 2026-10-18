import "server-only";

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import GithubSlugger from "github-slugger";

import { HELP_CATEGORIES, type HelpCategoryId } from "./categories";

/**
 * Help articles are Markdown files in apps/web/content/help, so the guide can be
 * improved without touching React code. Each starts with simple front matter:
 *
 *   ---
 *   title: Connecting mailboxes
 *   description: One sentence shown in lists and search.
 *   category: setup            (an id from categories.ts)
 *   order: 1                   (position within the category)
 *   keywords: smtp, imap, gmail
 *   ---
 *
 * `pnpm lint` validates front matter and every /help link (scripts/check-help.mjs).
 */

export interface HelpHeading {
  depth: 2 | 3;
  text: string;
  id: string;
}

/** A searchable slice of an article: the intro, or one heading and the text under it. */
export interface HelpSection {
  /** Heading anchor; null for the text before the first heading. */
  id: string | null;
  heading: string | null;
  /** Plain text, original casing. */
  text: string;
}

export interface HelpArticle {
  slug: string;
  title: string;
  description: string;
  category: HelpCategoryId;
  order: number;
  keywords: string[];
  body: string;
  headings: HelpHeading[];
  sections: HelpSection[];
}

export type HelpSearchEntry = Pick<HelpArticle, "slug" | "title" | "description" | "category" | "keywords" | "sections">;

const CONTENT_DIR = path.join(process.cwd(), "content", "help");
const CATEGORY_IDS = new Set<string>(HELP_CATEGORIES.map((c) => c.id));

let cache: HelpArticle[] | undefined;

/** All articles, in reading order (category order, then `order`). Cached in production. */
export function helpArticles(): HelpArticle[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const articles = readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => parseArticle(file.replace(/\.md$/, ""), readFileSync(path.join(CONTENT_DIR, file), "utf8")));

  const categoryOrder = HELP_CATEGORIES.map((c) => c.id as string);
  articles.sort((a, b) => categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category) || a.order - b.order);
  cache = articles;
  return articles;
}

export function helpArticle(slug: string): HelpArticle | undefined {
  return helpArticles().find((a) => a.slug === slug);
}

export function helpSearchIndex(): HelpSearchEntry[] {
  return helpArticles().map(({ slug, title, description, category, keywords, sections }) => ({
    slug,
    title,
    description,
    category,
    keywords,
    sections,
  }));
}

function parseArticle(slug: string, raw: string): HelpArticle {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) throw new Error(`Help article "${slug}" is missing front matter.`);

  const meta: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator > 0) meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  if (!meta.title) throw new Error(`Help article "${slug}" needs a title.`);
  if (!meta.category || !CATEGORY_IDS.has(meta.category)) {
    throw new Error(`Help article "${slug}" has an unknown category "${meta.category ?? ""}".`);
  }

  const body = raw.slice(match[0].length).trim();
  const { headings, sections } = splitSections(body);
  return {
    slug,
    title: meta.title,
    description: meta.description ?? "",
    category: meta.category as HelpCategoryId,
    order: Number(meta.order ?? 99),
    keywords: (meta.keywords ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    body,
    headings,
    sections,
  };
}

/**
 * Splits the body at headings. Heading ids use the same algorithm as rehype-slug,
 * so table-of-contents and search links land on the rendered headings.
 */
function splitSections(body: string): { headings: HelpHeading[]; sections: HelpSection[] } {
  const slugger = new GithubSlugger();
  const headings: HelpHeading[] = [];
  const sections: HelpSection[] = [];
  let current: { id: string | null; heading: string | null; lines: string[] } = { id: null, heading: null, lines: [] };
  let inFence = false;

  const flush = () => {
    const text = plainText(current.lines.join("\n"));
    if (text || current.heading) sections.push({ id: current.id, heading: current.heading, text });
  };

  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      current.lines.push(line);
      continue;
    }
    const match = inFence ? null : /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) {
      current.lines.push(line);
      continue;
    }
    const text = inlineText(match[2]!);
    const id = slugger.slug(text);
    const depth = match[1]!.length;
    if (depth === 2 || depth === 3) headings.push({ depth, text, id });
    flush();
    current = { id, heading: text, lines: [] };
  }
  flush();
  return { headings, sections };
}

function inlineText(markdown: string): string {
  return (
    markdown
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      // Single * or _ emphasis only at word boundaries, so names like OPENAI_API_KEY stay intact.
      .replace(/(?<!\w)[*_](\S(?:.*?\S)?)[*_](?!\w)/g, "$1")
      .trim()
  );
}

/** Markdown → readable plain text (code blocks kept as text, table pipes and markers removed). */
function plainText(markdown: string): string {
  return inlineText(
    markdown
      .replace(/^\s*(```|~~~).*$/gm, " ")
      .replace(/^>\s?\[!\w+\]\s*$/gm, " ")
      .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, " ")
      .replace(/^\s*(>\s?)+/gm, "")
      .replace(/^\s*([-*+]|\d+\.)\s+/gm, ""),
  )
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
