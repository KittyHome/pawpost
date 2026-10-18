import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { logout } from "@/features/auth/actions";
import { engine } from "@/server/engine";
import { requireSession } from "@/server/session";

// Every dashboard page reads live data and the session.
export const dynamic = "force-dynamic";

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
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <span className="text-sm text-muted-foreground">Pawpost</span>
        </header>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
