import Link from "next/link";

import { LogoMark } from "@/components/logo-mark";
import { ThemeToggle } from "@/components/theme-toggle";

// Sign-in and account flows read the database on every request.
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="relative flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center justify-center gap-2 font-semibold">
          <LogoMark />
          Pawpost
        </Link>
        {children}
      </div>
    </main>
  );
}
