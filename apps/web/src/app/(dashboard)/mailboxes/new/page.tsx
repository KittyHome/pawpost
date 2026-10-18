import { can } from "@pawpost/engine/permissions";
import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { NoAccess } from "@/components/no-access";
import { MailboxForm } from "@/features/mailboxes/mailbox-form";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Connect mailbox" };

export default async function NewMailboxPage() {
  const { user } = await requireSession();
  if (!can(user.role, "mailboxes.manage")) return <NoAccess what="mailbox settings" />;
  return (
    <>
      <PageHeader
        title="Connect mailbox"
        help={{ href: "/help/mailboxes", label: "Connecting mailboxes" }}
        breadcrumbs={[{ label: "Mailboxes", href: "/mailboxes" }, { label: "Connect" }]}
      />
      <MailboxForm />
    </>
  );
}
