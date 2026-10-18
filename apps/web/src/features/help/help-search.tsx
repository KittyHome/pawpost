"use client";

import { FileTextIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";

export interface SearchEntry {
  slug: string;
  title: string;
  description: string;
  categoryLabel: string;
  keywords: string[];
  sections: { id: string | null; heading: string | null; text: string }[];
}

interface Result {
  entry: SearchEntry;
  score: number;
  section: SearchEntry["sections"][number] | null;
  snippet: string;
}

/** Instant client-side search over every help article, linking to the best-matching section. */
export function HelpSearch({ entries }: { entries: SearchEntry[] }) {
  const [query, setQuery] = useState("");
  const terms = useMemo(() => tokenize(query), [query]);
  const results = useMemo(() => search(entries, terms), [entries, terms]);
  const active = query.trim().length >= 2;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search the guide, e.g. "app password", "bounce", "spam"'
          className="h-11 pl-9 text-base"
          aria-label="Search help"
          autoFocus
        />
      </div>

      {active && (
        <div className="rounded-lg border bg-card" role="region" aria-live="polite" aria-label="Search results">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No articles match &ldquo;{query}&rdquo;. Try a different word, or browse the topics below.
            </p>
          ) : (
            <ul className="divide-y">
              {results.slice(0, 8).map(({ entry, section, snippet }) => (
                <li key={entry.slug}>
                  <Link
                    href={`/help/${entry.slug}${section?.id ? `#${section.id}` : ""}`}
                    className="flex gap-3 p-4 transition-colors hover:bg-muted/50"
                  >
                    <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm font-medium">
                        {entry.title}
                        {section?.heading && <span className="text-muted-foreground"> › {section.heading}</span>}
                      </span>
                      <span className="line-clamp-2 text-sm text-muted-foreground">
                        <Highlight text={snippet} terms={terms} />
                      </span>
                      <span className="text-xs text-muted-foreground">{entry.categoryLabel}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function tokenize(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^\p{L}\p{N}@.+-]+/u)
        .filter((t) => t.length >= 2),
    ),
  ];
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches a term at the start of a word, so "app" finds "app password" but not "happens". */
function wordStart(term: string, flags = "iu") {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escape(term)}`, flags);
}

function countMatches(text: string, term: string): number {
  return Math.min((text.match(wordStart(term, "giu")) ?? []).length, 3);
}

function search(entries: SearchEntry[], terms: string[]): Result[] {
  if (!terms.length) return [];
  const phrase = terms.join(" ");
  const results: Result[] = [];

  for (const entry of entries) {
    const meta = `${entry.title} ${entry.description} ${entry.keywords.join(" ")}`;
    const everything = `${meta} ${entry.sections.map((s) => `${s.heading ?? ""} ${s.text}`).join(" ")}`;
    // Every term must appear somewhere in the article.
    if (!terms.every((t) => wordStart(t).test(everything))) continue;

    let score = 0;
    for (const t of terms) {
      if (wordStart(t).test(entry.title)) score += 10;
      if (entry.keywords.some((k) => wordStart(t).test(k))) score += 6;
      if (wordStart(t).test(entry.description)) score += 3;
    }

    // The section that best matches the query, so the result can link straight to it.
    let best: { section: SearchEntry["sections"][number]; score: number } | null = null;
    for (const section of entry.sections) {
      const heading = section.heading ?? "";
      let s = 0;
      for (const t of terms) s += countMatches(heading, t) * 5 + countMatches(section.text, t);
      if (terms.length > 1 && (heading.toLowerCase().includes(phrase) || section.text.toLowerCase().includes(phrase))) s += 8;
      if (s > 0 && (!best || s > best.score)) best = { section, score: s };
    }
    score += best?.score ?? 0;

    results.push({
      entry,
      score,
      section: best?.section ?? null,
      snippet: best ? snippetAround(best.section.text, terms, phrase) : entry.description,
    });
  }
  return results.sort((a, b) => b.score - a.score);
}

function snippetAround(text: string, terms: string[], phrase: string): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  let at = terms.length > 1 ? lower.indexOf(phrase) : -1;
  if (at < 0) at = terms.map((t) => text.search(wordStart(t))).find((i) => i >= 0) ?? 0;
  const start = Math.max(at - 70, 0);
  const end = Math.min(at + 160, text.length);
  // Start and end on word boundaries.
  const from = start === 0 ? 0 : text.indexOf(" ", start) + 1;
  const to = end === text.length ? end : text.lastIndexOf(" ", end);
  return `${from > 0 ? "…" : ""}${text.slice(from, to > from ? to : end).trim()}${to < text.length ? "…" : ""}`;
}

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return text;
  const pattern = new RegExp(`((?<![\\p{L}\\p{N}])(?:${terms.map(escape).join("|")}))`, "giu");
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded-sm bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-500/30">
        {part}
      </mark>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}
