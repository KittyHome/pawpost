import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@pawpost/engine/permissions";
import { LaptopIcon, SmartphoneIcon } from "lucide-react";
import type { Metadata } from "next";

import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/page-header";
import { ToneBadge } from "@/components/status-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { revokeOtherSessions, revokeSession } from "@/features/account/actions";
import { PasswordForm, ProfileForm } from "@/features/account/account-forms";
import { formatRelative } from "@/lib/format";
import { engine } from "@/server/engine";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Account" };

/** "Chrome on Windows" from a user agent, good enough to recognise a device. */
function describeDevice(userAgent: string | null): { label: string; mobile: boolean } {
  if (!userAgent) return { label: "Unknown device", mobile: false };
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /Mac OS X/.test(userAgent) && !/iPhone|iPad/.test(userAgent)
      ? "macOS"
      : /iPhone|iPad/.test(userAgent)
        ? "iOS"
        : /Android/.test(userAgent)
          ? "Android"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "another system";
  return { label: `${browser} on ${os}`, mobile: /Mobile|Android|iPhone/.test(userAgent) };
}

export default async function AccountPage() {
  const { user, sessionId } = await requireSession();
  const sessions = await engine().accounts.listSessions(user.id);

  return (
    <>
      <PageHeader title="Account" description="Your profile, password and signed-in devices." />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Role: <span className="font-medium text-foreground">{ROLE_LABELS[user.role]}</span>. {ROLE_DESCRIPTIONS[user.role]}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm name={user.name} email={user.email} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signed-in devices</CardTitle>
          <CardDescription>Sign out anything you don&apos;t recognise, then change your password.</CardDescription>
          {sessions.length > 1 && (
            <CardAction>
              <ActionButton variant="outline" size="sm" action={revokeOtherSessions}>
                Sign out all other devices
              </ActionButton>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {sessions.map((s) => {
              const device = describeDevice(s.userAgent);
              const Icon = device.mobile ? SmartphoneIcon : LaptopIcon;
              const current = s.id === sessionId;
              return (
                <li key={s.id} className="flex items-center gap-3 py-3">
                  <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {device.label}
                      {current && <ToneBadge tone="success">This device</ToneBadge>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.ipAddress ?? "unknown IP"} · active {formatRelative(s.lastSeenAt)} · signed in{" "}
                      {formatRelative(s.createdAt)}
                    </span>
                  </div>
                  {!current && (
                    <ActionButton variant="ghost" size="sm" action={revokeSession.bind(null, s.id)}>
                      Sign out
                    </ActionButton>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
