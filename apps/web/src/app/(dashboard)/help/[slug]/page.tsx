import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { helpCategory } from "@/features/help/categories";
import { helpArticle, helpArticles } from "@/features/help/content";
import { Markdown } from "@/features/help/markdown";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/help/[slug]">): Promise<Metadata> {
  const article = helpArticle((await params).slug);
  return { title: article ? `${article.title} · Help` : "Help" };
}

export default async function HelpArticlePage({ params }: PageProps<"/help/[slug]">) {
  const { slug } = await params;
  const article = helpArticle(slug);
  if (!article) notFound();

  const all = helpArticles();
  const index = all.findIndex((a) => a.slug === slug);
  const previous = all[index - 1];
  const next = all[index + 1];
  const category = helpCategory(article.category);
  const related = all.filter((a) => a.category === article.category && a.slug !== slug);

  return (
    <>
      <PageHeader
        title={article.title}
        description={article.description}
        breadcrumbs={[
          { label: "Help center", href: "/help" },
          { label: category.label, href: "/help" },
          { label: article.title },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardContent className="py-6">
              <Markdown>{article.body}</Markdown>
            </CardContent>
          </Card>

          <nav className="grid gap-3 sm:grid-cols-2" aria-label="More articles">
            {previous ? <PagerLink article={previous} direction="previous" /> : <span />}
            {next && <PagerLink article={next} direction="next" />}
          </nav>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20 flex flex-col gap-8 text-sm">
            {article.headings.length > 0 && (
              <nav aria-label="On this page" className="flex flex-col gap-2">
                <span className="font-medium">On this page</span>
                <ul className="flex flex-col gap-1.5 border-l">
                  {article.headings.map((h) => (
                    <li key={h.id}>
                      <a
                        href={`#${h.id}`}
                        className={cn(
                          "-ml-px block border-l border-transparent text-muted-foreground hover:border-foreground hover:text-foreground",
                          h.depth === 2 ? "pl-3" : "pl-6 text-xs",
                        )}
                      >
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            {related.length > 0 && (
              <nav aria-label="Related articles" className="flex flex-col gap-2">
                <span className="font-medium">More in {category.label}</span>
                <ul className="flex flex-col gap-1.5">
                  {related.map((a) => (
                    <li key={a.slug}>
                      <Link href={`/help/${a.slug}`} className="text-muted-foreground hover:text-foreground">
                        {a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function PagerLink({ article, direction }: { article: { slug: string; title: string }; direction: "previous" | "next" }) {
  return (
    <Link
      href={`/help/${article.slug}`}
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-4 transition-colors hover:bg-muted/50",
        direction === "next" && "sm:col-start-2 sm:items-end sm:text-right",
      )}
    >
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {direction === "previous" ? (
          <>
            <ArrowLeftIcon className="size-3" /> Previous
          </>
        ) : (
          <>
            Next <ArrowRightIcon className="size-3" />
          </>
        )}
      </span>
      <span className="text-sm font-medium">{article.title}</span>
    </Link>
  );
}
