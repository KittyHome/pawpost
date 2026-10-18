import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { ToneBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AiSettingsForm } from "@/features/settings/ai-settings-form";
import { formatRelative } from "@/lib/format";
import { engine } from "@/server/engine";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [ai, worker] = await Promise.all([engine().ai.status(), engine().system.workerStatus()]);

  return (
    <>
      <PageHeader
        title="Settings"
        help={{ href: "/help/ai-features", label: "AI features" }}
        description="Instance-wide configuration."
      />

      <Card>
        <CardHeader>
          <CardTitle>AI</CardTitle>
          <CardDescription>
            Writes and reviews sequences, and triages replies. Optional: everything else works without it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AiSettingsForm status={ai} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System</CardTitle>
          <CardDescription>Set through environment variables; see .env.example.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-[12rem_1fr]">
          <span className="text-muted-foreground">Public URL</span>
          <span className="font-mono">{env().APP_URL}</span>
          <span className="text-muted-foreground">Admin</span>
          <span>{env().ADMIN_EMAIL}</span>
          <span className="text-muted-foreground">Worker</span>
          <span className="flex items-center gap-2">
            {worker.online ? <ToneBadge tone="success">Online</ToneBadge> : <ToneBadge tone="danger">Offline</ToneBadge>}
            <span className="text-muted-foreground">
              last heartbeat {formatRelative(worker.lastSeenAt)}
              {worker.version ? ` · v${worker.version}` : ""}
            </span>
          </span>
        </CardContent>
      </Card>
    </>
  );
}
