import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { MailboxForm } from "@/features/mailboxes/mailbox-form";

export const metadata: Metadata = { title: "Connect mailbox" };

export default function NewMailboxPage() {
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
