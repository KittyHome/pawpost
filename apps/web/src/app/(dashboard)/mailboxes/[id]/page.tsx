import { isDomainError } from "@pawpost/engine";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { MailboxForm } from "@/features/mailboxes/mailbox-form";
import { engine } from "@/server/engine";

export const metadata: Metadata = { title: "Edit mailbox" };

export default async function EditMailboxPage({ params }: PageProps<"/mailboxes/[id]">) {
  const { id } = await params;
  const mailbox = await engine()
    .mailboxes.get(id)
    .catch((error: unknown) => {
      if (isDomainError(error)) notFound();
      throw error;
    });

  return (
    <>
      <PageHeader
        title={mailbox.email}
        help={{ href: "/help/mailboxes", label: "Connecting mailboxes" }}
        breadcrumbs={[{ label: "Mailboxes", href: "/mailboxes" }, { label: "Edit" }]}
      />
      <MailboxForm
        mailboxId={mailbox.id}
        defaults={{
          email: mailbox.email,
          fromName: mailbox.fromName,
          smtpHost: mailbox.smtpHost,
          smtpPort: mailbox.smtpPort,
          smtpSecure: mailbox.smtpSecure,
          smtpUsername: mailbox.smtpUsername,
          imapHost: mailbox.imapHost,
          imapPort: mailbox.imapPort,
          imapSecure: mailbox.imapSecure,
          imapUsername: mailbox.imapUsername,
          dailyLimit: mailbox.dailyLimit,
          minIntervalSeconds: mailbox.minIntervalSeconds,
        }}
      />
    </>
  );
}
