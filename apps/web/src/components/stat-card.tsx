import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <Card className="gap-3">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardDescription>{label}</CardDescription>
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <CardTitle className="text-2xl font-semibold tracking-tight tabular-nums">{value}</CardTitle>
        {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
