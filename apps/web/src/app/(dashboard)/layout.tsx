import type { Metadata } from "next";

import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { logout } from "@/features/auth/actions";
import { engine } from "@/server/engine";
import { requireSession } from "@/server/session";

// Every dashboard page reads live data and the session.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const { user } = await requireSession();
  const [worker, trashCount] = await Promise.all([engine().system.workerStatus(), engine().trash.count()]);

  return (
    <SidebarProvider>
      <AppSidebar
        user={{ name: user.name, email: user.email, role: user.role }}
        worker={{ online: worker.online, lastSeenAt: worker.lastSeenAt?.toISOString() ?? null }}
        trashCount={trashCount}
        logoutAction={logout}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center border-b">
          <div className="mx-auto flex h-full w-full max-w-6xl items-center px-6">
            <SidebarTrigger className="-ml-1" />
            <ThemeToggle className="ml-auto" />
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
