import { ROLE_LABELS } from "@pawpost/engine/permissions";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AcceptInviteForm } from "@/features/auth/auth-forms";
import { engine } from "@/server/engine";

export const metadata: Metadata = { title: "Join Pawpost" };

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const invitation = await engine().accounts.lookupInvitation(token);

  if (!invitation) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitation not valid</CardTitle>
          <CardDescription>
            This invitation was already used, has expired (after 7 days) or was withdrawn. Ask the person who invited you for a
            new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join your team on Pawpost</CardTitle>
        <CardDescription>
          {invitation.invitedByName ?? "An admin"} invited you as {ROLE_LABELS[invitation.role].toLowerCase()}. Choose your name
          and password to finish.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AcceptInviteForm token={token} email={invitation.email} />
      </CardContent>
    </Card>
  );
}
