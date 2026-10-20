import { CircleCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/auth-forms";
import { engine, ensureBootstrap } from "@/server/engine";
import { getSession } from "@/server/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getSession()) redirect("/overview");
  await ensureBootstrap();
  if (!(await engine().accounts.hasUsers())) redirect("/setup");
  const { next, reset } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back. Sign in to your Pawpost workspace.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {reset && (
          <Alert>
            <CircleCheckIcon />
            <AlertDescription>Your password was changed. Sign in with the new one.</AlertDescription>
          </Alert>
        )}
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </CardContent>
    </Card>
  );
}
