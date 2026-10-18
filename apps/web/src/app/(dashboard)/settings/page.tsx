import { TRASH_RETENTION_DAYS } from "@pawpost/engine";
import type { Metadata } from "next";

import { ToneBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatRelative } from "@/lib/format";
import { engine } from "@/server/engine";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Settings" };

export default async function GeneralSettingsPage() {
  const e = engine();
  const [worker, users, ai] = await Promise.all([e.system.workerStatus(), e.accounts.listUsers(), e.ai.status()]);
  const owner = users.find((u) => u.role === "owner");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Installation</CardTitle>
        <CardDescription>
          How this Pawpost installation is configured. Server settings come from environment variables (.env).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm sm:grid-cols-[12rem_1fr]">
        <span className="text-muted-foreground">Public URL</span>
        <span className="font-mono break-all">{env().APP_URL}</span>
        <span className="text-muted-foreground">Owner</span>
        <span>{owner ? `${owner.name} (${owner.email})` : "–"}</span>
        <span className="text-muted-foreground">Team</span>
        <span>{formatNumber(users.length)} user(s)</span>
        <span className="text-muted-foreground">Worker</span>
        <span className="flex flex-wrap items-center gap-2">
          {worker.online ? <ToneBadge tone="success">Online</ToneBadge> : <ToneBadge tone="danger">Offline</ToneBadge>}
          <span className="text-muted-foreground">
            last heartbeat {formatRelative(worker.lastSeenAt)}
            {worker.version ? ` · v${worker.version}` : ""}
          </span>
        </span>
        <span className="text-muted-foreground">System email</span>
        <span>
          {e.accounts.systemMailConfigured() ? (
            <ToneBadge tone="success">Configured</ToneBadge>
          ) : (
            <span className="text-muted-foreground">Not configured: invitation and reset links are shown to copy and share.</span>
          )}
        </span>
        <span className="text-muted-foreground">AI</span>
        <span>
          {ai.configured ? (
            <ToneBadge tone="success">OpenAI · {ai.model}</ToneBadge>
          ) : (
            <span className="text-muted-foreground">Not configured</span>
          )}
        </span>
        <span className="text-muted-foreground">Trash retention</span>
        <span>{TRASH_RETENTION_DAYS} days, then deleted permanently</span>
      </CardContent>
    </Card>
  );
}
