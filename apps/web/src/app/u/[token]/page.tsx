import { CircleCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { engine } from "@/server/engine";

export const metadata: Metadata = { title: "Unsubscribe" };
export const dynamic = "force-dynamic";

/**
 * Recipient-facing. A GET only shows a confirm button, because link scanners
 * open every URL in an email; the unsubscribe itself happens on POST.
 */
export default async function UnsubscribePage({ params, searchParams }: PageProps<"/u/[token]">) {
  const { token } = await params;
  const { done } = await searchParams;
  const info = await engine().suppressions.lookupToken(token);

  async function confirm() {
    "use server";
    await engine().suppressions.unsubscribeByToken(token, "link");
    redirect(`/u/${token}?done=1`);
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        {!info ? (
          <CardHeader>
            <CardTitle>Link not recognised</CardTitle>
            <CardDescription>
              This unsubscribe link is invalid or has expired. Reply to the email and ask to be removed.
            </CardDescription>
          </CardHeader>
        ) : done || info.alreadyUnsubscribed ? (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleCheckIcon className="size-5 text-emerald-600" aria-hidden /> You&apos;re unsubscribed
            </CardTitle>
            <CardDescription>{info.maskedEmail} won&apos;t receive any more emails from this sender.</CardDescription>
          </CardHeader>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Unsubscribe</CardTitle>
              <CardDescription>Stop all emails from this sender to {info.maskedEmail}?</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={confirm}>
                <SubmitButton className="w-full" pendingText="Unsubscribing…">
                  Unsubscribe
                </SubmitButton>
              </form>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
