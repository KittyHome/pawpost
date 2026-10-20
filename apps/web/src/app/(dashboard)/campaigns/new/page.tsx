import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateCampaignForm } from "@/features/campaigns/create-campaign-form";
import { engine } from "@/server/engine";

export const metadata: Metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  const lists = (await engine().lists.list()).filter((l) => l.contactCount > 0);

  return (
    <>
      <PageHeader
        title="New campaign"
        help={{ href: "/help/campaigns", label: "Creating and running campaigns" }}
        breadcrumbs={[{ label: "Campaigns", href: "/campaigns" }, { label: "New" }]}
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Who is it for?</CardTitle>
          <CardDescription>Pick the contact list this campaign will email.</CardDescription>
        </CardHeader>
        <CardContent>
          {lists.length ? (
            <CreateCampaignForm lists={lists} />
          ) : (
            <div className="flex flex-col items-start gap-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Import a contact list first. A campaign needs at least one person to email.
              </p>
              <Button asChild>
                <Link href="/lists">Import contacts</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
