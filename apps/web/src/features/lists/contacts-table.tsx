"use client";

import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  BanIcon,
  CopyIcon,
  FolderInputIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { bulkContacts } from "./actions";
import { ContactDialog, type EditableContact } from "./contact-dialog";

export interface ContactRow extends EditableContact {
  suppressed: boolean;
}

type SortKey = "email" | "name" | "company" | "created";

export function ContactsTable({
  listId,
  rows,
  otherLists,
  attributeColumns,
  sort,
  dir,
}: {
  listId: string;
  rows: ContactRow[];
  otherLists: { id: string; name: string }[];
  attributeColumns: string[];
  sort: SortKey;
  dir: "asc" | "desc";
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<EditableContact | null>(null);
  const [confirm, setConfirm] = useState<"trash" | "suppress" | null>(null);
  const [target, setTarget] = useState<{ mode: "move" | "copy"; listId: string } | null>(null);
  const [busy, startTransition] = useTransition();

  const ids = [...selected].filter((id) => rows.some((r) => r.id === id));
  const allSelected = rows.length > 0 && ids.length === rows.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = (operation: "trash" | "suppress" | "move" | "copy", contactIds: string[], targetListId?: string) =>
    bulkContacts(listId, operation, contactIds, targetListId).then((result) => {
      if (result.status === "success") setSelected(new Set());
      return result;
    });

  const sortHref = (key: SortKey) => {
    const next = new URLSearchParams(params);
    next.set("sort", key);
    next.set("dir", sort === key && dir === "asc" ? "desc" : "asc");
    next.delete("page");
    return `${pathname}?${next}`;
  };

  const sortHeader = (label: string, sortKey: SortKey) => {
    const Icon = sort !== sortKey ? ArrowUpDownIcon : dir === "asc" ? ArrowUpIcon : ArrowDownIcon;
    return (
      <TableHead key={sortKey} aria-sort={sort === sortKey ? (dir === "asc" ? "ascending" : "descending") : undefined}>
        <Link href={sortHref(sortKey)} className="inline-flex items-center gap-1 hover:text-foreground">
          {label}
          <Icon className={cn("size-3.5", sort !== sortKey && "opacity-40")} aria-hidden />
        </Link>
      </TableHead>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {ids.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2"
          role="toolbar"
          aria-label="Selected contacts"
        >
          <span className="mr-auto text-sm font-medium">{ids.length} selected</span>
          {otherLists.length > 0 && (
            <>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setTarget({ mode: "move", listId: "" })}>
                <FolderInputIcon /> Move
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setTarget({ mode: "copy", listId: "" })}>
                <CopyIcon /> Copy
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm("suppress")}>
            <BanIcon /> Suppress
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm("trash")}>
            <Trash2Icon /> Move to trash
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <XIcon />
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected ? true : ids.length ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label="Select all on this page"
              />
            </TableHead>
            {sortHeader("Email", "email")}
            {sortHeader("Name", "name")}
            {sortHeader("Company", "company")}
            <TableHead>Status</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.id} data-state={selected.has(c.id) ? "selected" : undefined}>
              <TableCell>
                <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} aria-label={`Select ${c.email}`} />
              </TableCell>
              <TableCell className="font-medium">{c.email}</TableCell>
              <TableCell>
                {[c.firstName, c.lastName].filter(Boolean).join(" ") || <span className="text-muted-foreground">–</span>}
              </TableCell>
              <TableCell>{c.company ?? <span className="text-muted-foreground">–</span>}</TableCell>
              <TableCell>{c.suppressed ? <StatusBadge status="suppressed" /> : <StatusBadge status="active" />}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.email}`}>
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(c)}>
                      <PencilIcon /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() =>
                        startTransition(async () => {
                          const result = await run("trash", [c.id]);
                          if (result.status === "error") toast.error(result.message);
                          else toast.success(`${c.email} moved to the trash.`);
                        })
                      }
                    >
                      <Trash2Icon /> Move to trash
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No contacts match.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <ContactDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        listId={listId}
        attributeColumns={attributeColumns}
        contact={editing}
      />

      <ConfirmDialog
        open={confirm === "trash"}
        onOpenChange={(open) => !open && setConfirm(null)}
        onConfirm={() => run("trash", ids)}
        title={`Move ${ids.length} contact(s) to the trash?`}
        description="They stop receiving emails and can be restored from the trash for 30 days."
        confirmLabel="Move to trash"
        destructive
      />
      <ConfirmDialog
        open={confirm === "suppress"}
        onOpenChange={(open) => !open && setConfirm(null)}
        onConfirm={() => run("suppress", ids)}
        title={`Suppress ${ids.length} contact(s)?`}
        description="Their addresses go on the suppression list: they won't be emailed by any campaign, now or in future."
        confirmLabel="Suppress"
      />

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {target?.mode === "move" ? "Move" : "Copy"} {ids.length} contact(s) to another list
            </DialogTitle>
            <DialogDescription>Anyone already in the chosen list is skipped.</DialogDescription>
          </DialogHeader>
          <Select value={target?.listId ?? ""} onValueChange={(v) => setTarget((t) => (t ? { ...t, listId: v } : t))}>
            <SelectTrigger className="w-full" aria-label="Target list">
              <SelectValue placeholder="Choose a list" />
            </SelectTrigger>
            <SelectContent>
              {otherLists.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              disabled={!target?.listId || busy}
              onClick={() =>
                startTransition(async () => {
                  if (!target) return;
                  const result = await run(target.mode, ids, target.listId);
                  if (result.status === "error") toast.error(result.message);
                  else {
                    toast.success((result.status === "success" && result.message) || "Done.");
                    setTarget(null);
                  }
                })
              }
            >
              {target?.mode === "move" ? "Move" : "Copy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
