import { can } from "@pawpost/engine/permissions";
import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LearnMore } from "@/components/help-link";
import { NoAccess } from "@/components/no-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EraseForm } from "@/features/privacy/erase-form";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Privacy & data" };

export default async function PrivacyPage() {
  const { user } = await requireSession();
  if (!can(user.role, "data.erase")) return <NoAccess what="privacy and data tools" />;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Erase a person</CardTitle>
          <CardDescription>
            For requests to delete someone&apos;s data (for example under GDPR). Removes them from every list, campaign and
            activity record. <LearnMore href="/help/managing-data#erasing-a-person">How erasure works</LearnMore>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EraseForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export data</CardTitle>
          <CardDescription>
            CSV files that open in Excel, Google Sheets or Numbers. Every export is recorded in the audit log.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Suppression list (everyone who must never be emailed)</span>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/export/suppressions" download>
                <DownloadIcon /> Download
              </a>
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Audit log</span>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/export/audit" download>
                <DownloadIcon /> Download
              </a>
            </Button>
          </div>
          <p className="text-muted-foreground">
            Contact lists and campaign results are exported from their own pages:{" "}
            <Link href="/lists" className="underline underline-offset-4">
              Contact lists
            </Link>{" "}
            ·{" "}
            <Link href="/campaigns" className="underline underline-offset-4">
              Campaigns
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </>
  );
}
