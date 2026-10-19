"use client";

import { ROLE_LABELS, type Role } from "@pawpost/engine/permissions";
import {
  BanIcon,
  BookOpenIcon,
  ChevronsUpDownIcon,
  InboxIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  SendIcon,
  SettingsIcon,
  Trash2Icon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoMark } from "@/components/logo-mark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
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
    ],
  },
  {
    label: "Workspace",
    items: [
      { title: "Settings", href: "/settings", icon: SettingsIcon },
      { title: "Trash", href: "/trash", icon: Trash2Icon, badge: true },
      { title: "Help center", href: "/help", icon: BookOpenIcon },
    ],
  },
];

export interface SidebarUser {
  name: string;
  email: string;
  role: Role;
}

export function AppSidebar({
  user,
  worker,
  trashCount,
  logoutAction,
}: {
  user: SidebarUser;
  worker: { online: boolean; lastSeenAt: string | null };
  trashCount: number;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const initials =
    user.name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <LogoMark className="size-8!" />
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
                    {"badge" in item && trashCount > 0 && <SidebarMenuBadge>{trashCount}</SidebarMenuBadge>}
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
              size="sm"
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
                <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.email} · {ROLE_LABELS[user.role]}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/account">
                      <UserIcon /> Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings/team">
                      <UsersIcon /> Team
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/help">
                      <BookOpenIcon /> Help center
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void logoutAction()}>
                  <LogOutIcon /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
