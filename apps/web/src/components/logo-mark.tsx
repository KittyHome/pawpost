import Image from "next/image";

import { cn } from "@/lib/utils";

/** The Pawpost mark. Size it with `className` (defaults to 32px). */
export function LogoMark({ className }: { className?: string }) {
  return <Image src="/logo.png" alt="" width={32} height={32} className={cn("size-8 shrink-0 rounded-md", className)} />;
}
