import { checkPublicUrl, type PublicUrlProblem } from "@pawpost/core";
import { TRASH_RETENTION_DAYS } from "@pawpost/engine";
import type { Metadata } from "next";

import { LearnMore } from "@/components/help-link";
import { ToneBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatRelative } from "@/lib/format";
import { engine } from "@/server/engine";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Settings" };

const PUBLIC_URL_LABELS: Record<PublicUrlProblem, string> = {
  invalid: "Invalid",
  localhost: "Local only",
  ip_address: "IP address",
  not_https: "No HTTPS",
};

export default async function GeneralSettingsPage() {
  const publicUrl = checkPublicUrl(env().APP_URL);
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
      <CardContent className="px-0 pb-0">
        <dl className="divide-y">
            <SettingRow label="Public URL">
              <span className="flex flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono break-all">{env().APP_URL}</span>
                  {publicUrl.problem ? (
                    <ToneBadge tone={publicUrl.problem === "localhost" ? "info" : "warning"}>
                      {PUBLIC_URL_LABELS[publicUrl.problem]}
                    </ToneBadge>
                  ) : (
                    <ToneBadge tone="success">HTTPS</ToneBadge>
                  )}
                </span>
                {publicUrl.message && (
                  <span className="text-muted-foreground">
                    {publicUrl.message} <LearnMore href="/help/self-hosting#your-domain-and-https">Set up a domain</LearnMore>
                  </span>
                )}
              </span>
            </SettingRow>
            <SettingRow label="Owner">{owner ? `${owner.name} (${owner.email})` : "–"}</SettingRow>
            <SettingRow label="Team">{formatNumber(users.length)} user(s)</SettingRow>
            <SettingRow label="Worker">
              <span className="flex flex-wrap items-center gap-2">
                {worker.online ? <ToneBadge tone="success">Online</ToneBadge> : <ToneBadge tone="danger">Offline</ToneBadge>}
                <span className="text-muted-foreground">
                  last heartbeat {formatRelative(worker.lastSeenAt)}
                  {worker.version ? ` · v${worker.version}` : ""}
                </span>
              </span>
            </SettingRow>
            <SettingRow label="System email">
              {e.accounts.systemMailConfigured() ? (
                <ToneBadge tone="success">Configured</ToneBadge>
              ) : (
                <span className="text-muted-foreground">
                  Not configured: invitation and reset links are shown to copy and share.
                </span>
              )}
            </SettingRow>
            <SettingRow label="AI">
              {ai.configured ? (
                <ToneBadge tone="success">OpenAI · {ai.model}</ToneBadge>
              ) : (
                <span className="text-muted-foreground">Not configured</span>
              )}
            </SettingRow>
          <SettingRow label="Trash retention">{TRASH_RETENTION_DAYS} days, then deleted permanently</SettingRow>
        </dl>
      </CardContent>
    </Card>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 px-(--card-spacing) py-3.5 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
