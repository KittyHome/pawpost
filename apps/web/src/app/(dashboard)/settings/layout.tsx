import { can } from "@pawpost/engine/permissions";

import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/features/settings/settings-nav";
import { requireSession } from "@/server/session";

export default async function SettingsLayout({ children }: LayoutProps<"/settings">) {
  const { user } = await requireSession();
  const admin = can(user.role, "settings.manage");

  return (
    <>
      <PageHeader title="Settings" help={{ href: "/help/team-and-access", label: "Team and access" }} />
      <div className="grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
        <SettingsNav
          items={[
            { href: "/settings", label: "General" },
            { href: "/settings/team", label: "Team" },
            { href: "/settings/ai", label: "AI", restricted: !admin },
            { href: "/settings/audit", label: "Audit log", restricted: !can(user.role, "audit.view") },
            { href: "/settings/privacy", label: "Privacy & data", restricted: !can(user.role, "data.erase") },
          ]}
        />
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </>
  );
}
