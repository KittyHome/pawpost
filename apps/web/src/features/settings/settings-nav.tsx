"use client";

import { LockIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export interface SettingsNavItem {
  href: string;
  label: string;
  /** Shown with a lock for members; the page explains it's admin-only. */
  restricted?: boolean;
}

export function SettingsNav({ items }: { items: SettingsNavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto md:sticky md:top-20 md:flex-col">
      {items.map((item) => {
        const active = item.href === "/settings" ? pathname === "/settings" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted",
              active ? "bg-muted font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {item.label}
            {item.restricted && <LockIcon className="size-3.5" aria-label="Admins only" />}
          </Link>
        );
      })}
    </nav>
  );
}
