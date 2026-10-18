import { Trash2Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ImportForm } from "@/features/lists/import-form";
import { formatDateTime, formatNumber } from "@/lib/format";
import { engine } from "@/server/engine";

export const metadata: Metadata = { title: "Contact lists" };

export default async function ListsPage({ searchParams }: PageProps<"/lists">) {
  const { trashed } = await searchParams;
  const lists = await engine().lists.list();

  return (
    <>
      <PageHeader
        title="Contact lists"
        help={{ href: "/help/contact-lists", label: "Contact lists and CSV import" }}
        description="Imported recipients. Suppressed and undeliverable addresses are filtered out on import."
      />

      {trashed && (
        <Alert>
          <Trash2Icon />
          <AlertDescription>
            List moved to the trash.{" "}
            <Link href="/trash" className="font-medium underline underline-offset-4">
              Open the trash
            </Link>{" "}
            to restore it.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3 py-0">
          {lists.length === 0 ? (
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No lists yet. Import your first CSV.
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Contacts</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lists.map((list) => (
                  <TableRow key={list.id}>
                    <TableCell>
                      <Link href={`/lists/${list.id}`} className="font-medium hover:underline">
                        {list.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(list.contactCount)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(list.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Import a new list</CardTitle>
            <CardDescription>Only import people you have a legitimate reason to contact.</CardDescription>
          </CardHeader>
          <CardContent>
            <ImportForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
