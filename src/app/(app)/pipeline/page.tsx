import { redirect } from "next/navigation";
import Link from "next/link";
import { KanbanSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { STAGE_VALUES, type PipelineStage } from "@/lib/pipeline";
import { contactDisplayName } from "../contacts/format";
import { Button } from "@/components/ui/button";
import { PipelineBoard } from "./pipeline-board";
import type { BoardColumns, BoardOpportunity } from "./types";

export const metadata = { title: "Pipeline" };

interface OppRow {
  id: string;
  stage: PipelineStage;
  sort_index: number;
  contact_id: string;
  contacts: {
    id: string;
    first_name: string;
    last_name: string | null;
    partner_first_name: string | null;
    partner_last_name: string | null;
    email: string | null;
    phone: string | null;
    wedding_date: string | null;
    guest_count: number | null;
    budget_minor: number | null;
    source: string | null;
  } | null;
}

function emptyColumns(): BoardColumns {
  return Object.fromEntries(
    STAGE_VALUES.map((s) => [s, []]),
  ) as unknown as BoardColumns;
}

export default async function PipelinePage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");
  // Bundled (GHL-backed) venues run pre-sales in GHL — the native CRM is standalone-only.
  if (ctx.venue.mode === "bundled") redirect("/weddings");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "id, stage, sort_index, contact_id, contacts(id, first_name, last_name, partner_first_name, partner_last_name, email, phone, wedding_date, guest_count, budget_minor, source)",
    )
    .eq("venue_id", ctx.venue.id)
    .is("archived_at", null)
    .order("sort_index", { ascending: true })
    .overrideTypes<OppRow[]>();

  if (error) console.error("pipeline query failed:", error.message);
  const rows = data ?? [];

  const columns = emptyColumns();
  for (const r of rows) {
    if (!r.contacts) continue;
    const partner = contactDisplayName({
      first_name: r.contacts.partner_first_name ?? "",
      last_name: r.contacts.partner_last_name ?? null,
    }).trim();
    const opp: BoardOpportunity = {
      id: r.id,
      stage: r.stage,
      sortIndex: Number(r.sort_index),
      contactId: r.contacts.id,
      name: contactDisplayName(r.contacts),
      partnerName: partner || null,
      email: r.contacts.email,
      phone: r.contacts.phone,
      weddingDate: r.contacts.wedding_date,
      guestCount: r.contacts.guest_count,
      budgetMinor: r.contacts.budget_minor,
      source: r.contacts.source,
    };
    columns[r.stage].push(opp);
  }

  const total = rows.length;

  return (
    <div className="flex h-full flex-col">
      {/* Header (inside the normal padded content area) */}
      <div className="mb-6 px-1">
        <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
          Pipeline
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {total === 0
            ? "Every enquiry, from first contact to wedding booked."
            : `${total} active ${total === 1 ? "enquiry" : "enquiries"} across your eight stages.`}
        </p>
      </div>

      {total === 0 ? (
        <EmptyBoard />
      ) : (
        <PipelineBoard initialColumns={columns} />
      )}
    </div>
  );
}

function EmptyBoard() {
  return (
    <div className="rounded-xl border border-border bg-card p-10 text-center shadow-sm">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <KanbanSquare className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">
        Your pipeline fills up as enquiries arrive
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Share your enquiry form and every new couple lands here automatically,
        ready to move through to a booked wedding. You can also add one by hand.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/settings">Share your enquiry form</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/contacts">Add a contact</Link>
        </Button>
      </div>
    </div>
  );
}
