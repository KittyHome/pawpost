import { ArrowRightIcon, LifeBuoyIcon, RocketIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HELP_CATEGORIES, helpCategory } from "@/features/help/categories";
import { helpArticles, helpSearchIndex } from "@/features/help/content";
import { HelpSearch } from "@/features/help/help-search";

export const metadata: Metadata = { title: "Help center" };

export default function HelpCenterPage() {
  const articles = helpArticles();
  const entries = helpSearchIndex().map((e) => ({ ...e, categoryLabel: helpCategory(e.category).label }));

  return (
    <>
      <PageHeader
        title="Help center"
        description="Step-by-step guides for everything in Pawpost, written for first-time users."
      />

      <div className="mx-auto w-full max-w-2xl">
        <HelpSearch entries={entries} />
      </div>

      <Card className="border-primary/20 bg-primary/[0.03]">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <RocketIcon className="size-4" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <span className="font-semibold">New to Pawpost?</span>
              <span className="text-sm text-muted-foreground">
                The quick start walks you from an empty account to your first email in about 20 minutes.
              </span>
            </div>
          </div>
          <Button asChild>
            <Link href="/help/getting-started">
              Start the quick start <ArrowRightIcon />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {HELP_CATEGORIES.map((category) => {
          const inCategory = articles.filter((a) => a.category === category.id);
          if (!inCategory.length) return null;
          const Icon = category.icon;
          return (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" aria-hidden />
                  {category.label}
                </CardTitle>
                <CardDescription>{category.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2.5">
                  {inCategory.map((article) => (
                    <li key={article.slug}>
                      <Link href={`/help/${article.slug}`} className="group flex flex-col">
                        <span className="text-sm font-medium group-hover:underline">{article.title}</span>
                        <span className="line-clamp-1 text-xs text-muted-foreground">{article.description}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="flex items-start gap-3 text-sm">
          <LifeBuoyIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">
            Something not working? Start with{" "}
            <Link href="/help/troubleshooting" className="font-medium text-foreground underline underline-offset-4">
              Troubleshooting
            </Link>
            . It covers connection errors, campaigns that don&apos;t send, and emails landing in spam. If you&apos;ve found a bug,
            report it on the project&apos;s issue tracker with the steps to reproduce it.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
