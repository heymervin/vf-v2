"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Read-only value (URL or embed snippet) with a copy-to-clipboard button. */
export function CopyField({
  value,
  multiline = false,
  label,
}: {
  value: string;
  multiline?: boolean;
  label: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  }

  return (
    <div className="flex items-start gap-2">
      {multiline ? (
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-foreground">
          <code>{value}</code>
        </pre>
      ) : (
        <input
          readOnly
          value={value}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-foreground"
        />
      )}
      <Button
        type="button"
        variant="outline"
        size={multiline ? "sm" : "default"}
        onClick={copy}
        aria-label={`Copy ${label}`}
        className={cn(multiline && "mt-0.5")}
      >
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
