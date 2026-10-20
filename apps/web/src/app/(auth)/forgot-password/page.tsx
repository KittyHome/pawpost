import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/features/auth/auth-forms";
import { engine } from "@/server/engine";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  const mailConfigured = engine().accounts.systemMailConfigured();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot your password?</CardTitle>
        <CardDescription>
          {mailConfigured
            ? "Enter your email and we'll send you a link to choose a new password."
            : "This installation doesn't send email, so password resets go through an admin."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {mailConfigured ? (
          <ForgotPasswordForm />
        ) : (
          <div className="flex flex-col gap-3 text-sm text-muted-foreground">
            <p>
              Ask an admin of your workspace to open <span className="font-medium text-foreground">Settings → Team</span>, choose{" "}
              <span className="font-medium text-foreground">Reset password</span> next to your name, and send you the link.
            </p>
            <p>
              If you&apos;re the owner and can&apos;t sign in, whoever runs the server can create a link with{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">pnpm user:reset-link your@email</code>.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Link href="/login" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
