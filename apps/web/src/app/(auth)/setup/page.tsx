import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SetupForm } from "@/features/auth/auth-forms";
import { engine, ensureBootstrap } from "@/server/engine";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Set up Pawpost" };

/** First run only: creates the owner account. Disappears once anyone has an account. */
export default async function SetupPage() {
  await ensureBootstrap();
  if (await engine().accounts.hasUsers()) redirect("/login");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome to Pawpost</CardTitle>
        <CardDescription>
          Create the owner account for this installation. You can invite your team once you&apos;re in.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <SetupForm requiresToken={Boolean(env().SETUP_TOKEN)} />
      </CardContent>
    </Card>
  );
}
