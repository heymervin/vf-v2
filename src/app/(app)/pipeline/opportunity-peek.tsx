"use client";

import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StageBadge } from "@/components/stage-badge";
import { formatWeddingDate, formatBudget } from "../contacts/format";
import type { BoardOpportunity } from "./types";

export function OpportunityPeek({
  opportunity,
  open,
  onOpenChange,
}: {
  opportunity: BoardOpportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const o = opportunity;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-sm">
        {o && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <SheetTitle>{o.name}</SheetTitle>
                <StageBadge stage={o.stage} />
              </div>
              <SheetDescription>
                {o.partnerName ? `With ${o.partnerName}` : "Enquiry details"}
              </SheetDescription>
            </SheetHeader>

            <dl className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              <Row label="Email" value={o.email} />
              <Row label="Phone" value={o.phone} />
              <Row
                label="Wedding date"
                value={formatWeddingDate(o.weddingDate)}
              />
              <Row
                label="Guest count"
                value={o.guestCount != null ? String(o.guestCount) : null}
              />
              <Row label="Budget" value={formatBudget(o.budgetMinor)} />
              <Row label="Source" value={o.source} />
            </dl>

            <SheetFooter className="border-t border-border">
              <Button asChild className="w-full">
                <Link href={`/contacts/${o.contactId}`}>Open full contact</Link>
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground tabular-nums">
        {value ?? <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}
