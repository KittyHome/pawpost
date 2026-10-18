"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Read-only value with a copy button, for links people pass on (invitations, reset links). */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex gap-2">
      <Input value={value} readOnly aria-label={label} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
      <Button type="button" variant="outline" onClick={copy} aria-label={`Copy ${label}`}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
