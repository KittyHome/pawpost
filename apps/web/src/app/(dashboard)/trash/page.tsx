import { TRASH_RETENTION_DAYS } from "@pawpost/engine";
import { can } from "@pawpost/engine/permissions";
import { Trash2Icon } from "lucide-react";
import type { Metadata } from "next";

import { ActionButton } from "@/components/action-button";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { emptyTrash } from "@/features/trash/actions";
import { TrashItemActions } from "@/features/trash/trash-item-actions";
import { formatNumber, formatRelative } from "@/lib/format";
import { engine } from "@/server/engine";
import { requireSession } from "@/server/session";

export const metadata: Metadata = { title: "Trash" };

export default async function TrashPage() {
  const { user } = await requireSession();
  const canPurge = can(user.role, "trash.purge");
  const trash = await engine().trash.list();
  const total = trash.campaigns.length + trash.lists.length + trash.contacts.length;

  const deletedLine = (r: { deletedAt: Date | null; deletedBy: string | null; purgeAt: Date | null }) =>
    `Deleted ${formatRelative(r.deletedAt)}${r.deletedBy ? ` by ${r.deletedBy}` : ""} · removed for good ${formatRelative(r.purgeAt)}`;

  return (
    <>
      <PageHeader
        title="Trash"
        description={`Deleted campaigns, lists and contacts stay here for ${TRASH_RETENTION_DAYS} days, then are deleted permanently.`}
        help={{ href: "/help/managing-data#trash", label: "Trash and restore" }}
        actions={
          canPurge && total > 0 ? (
            <ActionButton
              variant="outline"
              action={emptyTrash}
              confirm={{
                title: "Empty the trash?",
                description: `All ${total} item(s) are deleted permanently. Lists still used by a campaign are kept. This can't be undone.`,
                confirmLabel: "Empty trash",
                destructive: true,
              }}
            >
              <Trash2Icon /> Empty trash
            </ActionButton>
          ) : null
        }
      />

      {total === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Trash2Icon />
            </EmptyMedia>
            <EmptyTitle>The trash is empty</EmptyTitle>
            <EmptyDescription>Things you delete appear here, so you can restore them if you change your mind.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Tabs
          defaultValue={trash.campaigns.length ? "campaigns" : trash.lists.length ? "lists" : "contacts"}
          className="gap-4"
        >
          <TabsList>
            <TabsTrigger value="campaigns">Campaigns ({trash.campaigns.length})</TabsTrigger>
            <TabsTrigger value="lists">Lists ({trash.lists.length})</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({trash.contacts.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns">
            <Card className="gap-0 py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trash.campaigns.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{deletedLine(c)}</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <TrashItemActions kind="campaign" id={c.id} label={c.name} canPurge={canPurge} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!trash.campaigns.length && <EmptyRow />}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="lists">
            <Card className="gap-0 py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>List</TableHead>
                    <TableHead className="text-right">Contacts</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trash.lists.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div className="font-medium">{l.name}</div>
                        <div className="text-xs text-muted-foreground">{deletedLine(l)}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(l.contactCount)}</TableCell>
                      <TableCell className="text-right">
                        <TrashItemActions kind="list" id={l.id} label={l.name} canPurge={canPurge} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!trash.lists.length && <EmptyRow />}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="contacts">
            <Card className="gap-0 py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>From list</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trash.contacts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.email}</div>
                        <div className="text-xs text-muted-foreground">{deletedLine(c)}</div>
                      </TableCell>
                      <TableCell className="text-sm">{c.listName}</TableCell>
                      <TableCell className="text-right">
                        <TrashItemActions kind="contact" id={c.id} label={c.email} canPurge={canPurge} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!trash.contacts.length && <EmptyRow />}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

function EmptyRow() {
  return (
    <TableRow>
      <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
        Nothing here.
      </TableCell>
    </TableRow>
  );
}
