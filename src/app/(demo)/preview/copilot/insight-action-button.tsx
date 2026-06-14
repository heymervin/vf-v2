"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CopilotInsight } from "@/lib/mock";

interface InsightActionButtonProps {
  kind: CopilotInsight["kind"];
  label: string;
}

const TOAST_MESSAGES: Record<CopilotInsight["kind"], string> = {
  at_risk:
    "Nudge drafted — review it in the Inbox before sending.",
  action:
    "Reply drafted and ready in the Inbox.",
  win:
    "Opening Wedding Workspace for this booking.",
  nudge:
    "Reminder scheduled — the couple will receive it at 10 am tomorrow.",
};

export function InsightActionButton({ kind, label }: InsightActionButtonProps) {
  return (
    <Button
      size="sm"
      variant={kind === "at_risk" ? "default" : kind === "win" ? "primary" : "outline"}
      className="min-h-[36px]"
      onClick={() =>
        toast(label, { description: TOAST_MESSAGES[kind] })
      }
    >
      {label}
    </Button>
  );
}
