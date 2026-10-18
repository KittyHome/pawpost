"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { AUDIT_AREAS } from "./areas";

/** URL-driven filters, so filtered views can be shared and exported. */
export function AuditFilters({ users }: { users: { id: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete(key);
    else next.set(key, value);
    next.delete("page");
    router.push(`${pathname}?${next}`);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={params.get("action") ?? "all"} onValueChange={(v) => update("action", v)}>
        <SelectTrigger className="w-52" aria-label="Filter by area">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All activity</SelectItem>
          {AUDIT_AREAS.map((a) => (
            <SelectItem key={a.value} value={a.value}>
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={params.get("user") ?? "all"} onValueChange={(v) => update("user", v)}>
        <SelectTrigger className="w-56" aria-label="Filter by person">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Everyone</SelectItem>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
