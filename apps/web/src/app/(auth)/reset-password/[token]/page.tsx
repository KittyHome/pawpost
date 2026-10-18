import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "@/features/auth/auth-forms";
import { engine } from "@/server/engine";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  const { token } = await params;
  const reset = await engine().accounts.lookupReset(token);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{reset ? "Choose a new password" : "Link not valid"}</CardTitle>
        <CardDescription>
          {reset
            ? "Pick a new password for your account."
            : "This reset link was already used or has expired. Ask for a new one."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {reset ? (
          <ResetPasswordForm token={token} email={reset.email} />
        ) : (
          <Button asChild variant="outline" className="w-full">
            <Link href="/forgot-password">Request a new link</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
