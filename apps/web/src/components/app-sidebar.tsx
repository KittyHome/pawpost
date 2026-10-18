"use client";

import {
  BanIcon,
  BookOpenIcon,
  InboxIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MailIcon,
  SendIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  {
    label: "Outreach",
    items: [
      { title: "Overview", href: "/", icon: LayoutDashboardIcon },
      { title: "Campaigns", href: "/campaigns", icon: SendIcon },
      { title: "Contact lists", href: "/lists", icon: UsersIcon },
    ],
  },
  {
    label: "Sending",
    items: [
      { title: "Mailboxes", href: "/mailboxes", icon: InboxIcon },
      { title: "Suppression list", href: "/suppressions", icon: BanIcon },
      { title: "Settings", href: "/settings", icon: SettingsIcon },
    ],
  },
  {
    label: "Support",
    items: [{ title: "Help center", href: "/help", icon: BookOpenIcon }],
  },
];

export function AppSidebar({
  userEmail,
  worker,
  logoutAction,
}: {
  userEmail: string;
  worker: { online: boolean; lastSeenAt: string | null };
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <MailIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">Pawpost</span>
                  <span className="truncate text-xs text-muted-foreground">Cold outreach</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.title}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={worker.online ? "Worker online" : "Worker offline"}
              className="cursor-default hover:bg-transparent active:bg-transparent"
            >
              <span className={cn("size-2 shrink-0 rounded-full", worker.online ? "bg-emerald-500" : "bg-red-500")} aria-hidden />
              <span className="truncate text-xs text-muted-foreground">
                {worker.online
                  ? "Worker online"
                  : worker.lastSeenAt
                    ? `Worker offline · seen ${formatRelative(worker.lastSeenAt)}`
                    : "Worker not started"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action={logoutAction}>
              <SidebarMenuButton type="submit" tooltip="Sign out">
                <LogOutIcon />
                <span className="truncate">{userEmail}</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
