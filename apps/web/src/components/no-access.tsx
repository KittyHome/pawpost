import { LockIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/** Shown in place of a page the current role can't use. */
export function NoAccess({ what = "this page" }: { what?: string }) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockIcon />
        </EmptyMedia>
        <EmptyTitle>Admins only</EmptyTitle>
        <EmptyDescription>Only owners and admins can use {what}. Ask an admin if you need access.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline">
          <Link href="/">Back to overview</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
