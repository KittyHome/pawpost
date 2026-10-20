import { can, canManageUser, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES } from "@pawpost/engine/permissions";
import type { Metadata } from "next";

import { ActionButton } from "@/components/action-button";
import { LearnMore } from "@/components/help-link";
import { ToneBadge } from "@/components/status-badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { revokeInvitation } from "@/features/team/actions";
import { InviteDialog } from "@/features/team/invite-dialog";
import { MemberActions } from "@/features/team/member-actions";
import { formatRelative } from "@/lib/format";
import { engine } from "@/server/engine";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Team" };

const ROLE_TONE = { owner: "info", admin: "success", member: "neutral" } as const;

export default async function TeamPage() {
  const { user: me } = await requireSession();
  const manage = can(me.role, "team.manage");
  const [users, invitations] = await Promise.all([
    engine().accounts.listUsers(),
    manage ? engine().accounts.listInvitations() : [],
  ]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            Everyone with access to this workspace. <LearnMore href="/help/team-and-access">Roles explained</LearnMore>
          </CardDescription>
          {manage && (
            <CardAction>
              <InviteDialog canInviteAdmins={manage} />
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last sign-in</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {u.name}
                        {u.id === me.id && <span className="font-normal text-muted-foreground"> (you)</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <ToneBadge tone={ROLE_TONE[u.role]}>{ROLE_LABELS[u.role]}</ToneBadge>
                      {u.status === "disabled" && <ToneBadge tone="danger">Disabled</ToneBadge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatRelative(u.lastLoginAt)}</TableCell>
                  <TableCell className="text-right">
                    {canManageUser(me, u) && (
                      <MemberActions
                        member={{ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status }}
                        actorIsOwner={me.role === "owner"}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {manage && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invitations</CardTitle>
            <CardDescription>
              Links are shown once, when created. To resend, withdraw the invitation and invite again.
            </CardDescription>
          </CardHeader>
          <CardContent className={invitations.length === 0 ? undefined : "px-0"}>
            {invitations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending invitations.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{inv.email}</span>
                          <span className="text-xs text-muted-foreground">invited by {inv.invitedByName ?? "a former user"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{ROLE_LABELS[inv.role]}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatRelative(inv.expiresAt)}</TableCell>
                      <TableCell className="text-right">
                        <ActionButton variant="ghost" size="sm" action={revokeInvitation.bind(null, inv.id)}>
                          Withdraw
                        </ActionButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
          {ROLES.map((role) => (
            <div key={role} className="contents">
              <span className="font-medium">{ROLE_LABELS[role]}</span>
              <span className="text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
