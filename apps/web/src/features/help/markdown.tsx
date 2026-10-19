import type { Blockquote, Root, RootContent } from "mdast";
import {
  ExternalLinkIcon,
  InfoIcon,
  LightbulbIcon,
  OctagonAlertIcon,
  SparklesIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
 * Callouts: GitHub-style "> [!TIP]" blockquotes become styled notices.
 * ------------------------------------------------------------------------- */

const CALLOUTS: Record<string, { title: string; icon: LucideIcon; className: string }> = {
  note: {
    title: "Note",
    icon: InfoIcon,
    className: "border-sky-500/30 bg-sky-500/5 [&_svg]:text-sky-600 dark:[&_svg]:text-sky-400",
  },
  tip: {
    title: "Tip",
    icon: LightbulbIcon,
    className: "border-emerald-500/30 bg-emerald-500/5 [&_svg]:text-emerald-600 dark:[&_svg]:text-emerald-400",
  },
  important: {
    title: "Important",
    icon: SparklesIcon,
    className: "border-violet-500/30 bg-violet-500/5 [&_svg]:text-violet-600 dark:[&_svg]:text-violet-400",
  },
  warning: {
    title: "Warning",
    icon: TriangleAlertIcon,
    className: "border-amber-500/40 bg-amber-500/5 [&_svg]:text-amber-600 dark:[&_svg]:text-amber-400",
  },
  caution: {
    title: "Caution",
    icon: OctagonAlertIcon,
    className: "border-red-500/30 bg-red-500/5 [&_svg]:text-red-600 dark:[&_svg]:text-red-400",
  },
};

function remarkCallouts() {
  const visit = (node: Root | RootContent) => {
    if (node.type === "blockquote") markCallout(node);
    if ("children" in node) node.children.forEach((child) => visit(child as RootContent));
  };
  return (tree: Root) => visit(tree);
}

function markCallout(node: Blockquote) {
  const paragraph = node.children[0];
  if (paragraph?.type !== "paragraph") return;
  const first = paragraph.children[0];
  if (first?.type !== "text") return;
  const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i.exec(first.value);
  if (!match) return;
  first.value = first.value.slice(match[0].length);
  node.data = { ...node.data, hProperties: { "data-callout": match[1]!.toLowerCase() } };
}

/* ---------------------------------------------------------------------------
 * Element styling, matching the shadcn/ui look of the rest of the app.
 * ------------------------------------------------------------------------- */

const components: Components = {
  h2: ({ className, ...props }) => (
    <h2
      className={cn("mt-10 scroll-mt-20 border-b pb-2 font-heading text-xl font-semibold tracking-tight first:mt-0", className)}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3 className={cn("mt-8 scroll-mt-20 font-heading text-lg font-semibold tracking-tight", className)} {...props} />
  ),
  h4: ({ className, ...props }) => <h4 className={cn("mt-6 scroll-mt-20 font-semibold", className)} {...props} />,
  p: ({ className, ...props }) => <p className={cn("leading-7 [&:not(:first-child)]:mt-4", className)} {...props} />,
  ul: ({ className, ...props }) => <ul className={cn("my-4 ml-6 list-disc [&>li]:mt-1.5", className)} {...props} />,
  ol: ({ className, ...props }) => <ol className={cn("my-4 ml-6 list-decimal [&>li]:mt-1.5", className)} {...props} />,
  li: ({ className, ...props }) => <li className={cn("leading-7 [&>p]:mt-0", className)} {...props} />,
  strong: ({ className, ...props }) => <strong className={cn("font-semibold", className)} {...props} />,
  hr: () => <hr className="my-8" />,
  a: ({ href = "", children, className, ...props }) => {
    const style = cn("font-medium text-primary underline underline-offset-4 hover:text-primary/80", className);
    if (href.startsWith("/") || href.startsWith("#")) {
      return (
        <Link href={href} className={style}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cn(style, "inline-flex items-center gap-0.5")} {...props}>
        {children}
        <ExternalLinkIcon className="size-3" aria-hidden />
      </a>
    );
  },
  code: ({ className, ...props }) => (
    <code className={cn("rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]", className)} {...props} />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "my-4 overflow-x-auto rounded-lg border bg-muted/50 p-4 text-sm leading-6 [&_code]:bg-transparent [&_code]:p-0",
        className,
      )}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <div className="my-6 w-full overflow-x-auto rounded-lg border">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  ),
  thead: ({ className, ...props }) => <thead className={cn("bg-muted/50", className)} {...props} />,
  th: ({ className, ...props }) => <th className={cn("border-b px-3 py-2 text-left font-medium", className)} {...props} />,
  td: ({ className, ...props }) => (
    <td className={cn("border-b px-3 py-2 align-top [tr:last-child_&]:border-0", className)} {...props} />
  ),
  blockquote: ({ className, children, ...props }) => {
    const kind = (props as Record<string, unknown>)["data-callout"];
    const callout = typeof kind === "string" ? CALLOUTS[kind] : undefined;
    if (!callout) {
      return <blockquote className={cn("my-4 border-l-2 pl-4 text-muted-foreground italic", className)}>{children}</blockquote>;
    }
    const Icon = callout.icon;
    return (
      <div role="note" className={cn("my-5 flex gap-3 rounded-lg border p-4 text-sm", callout.className)}>
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 [&>p]:leading-6 [&>p:first-child]:mt-0">
          <span className="sr-only">{callout.title}: </span>
          {children}
        </div>
      </div>
    );
  },
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[0.95rem] text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkCallouts]} rehypePlugins={[rehypeSlug]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
