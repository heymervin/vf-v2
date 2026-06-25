import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant";
import { StageBadge } from "@/components/stage-badge";
import { stageMeta, type PipelineStage } from "@/lib/pipeline";
import {
  contactDisplayName,
  formatWeddingDate,
  formatBudget,
  formatDateTime,
} from "../format";
import type { ContactFormValues } from "../contact-form-sheet";
import { ContactDetailActions } from "./contact-detail-actions";

export const metadata = { title: "Contact" };

interface StageEvent {
  id: string;
  from_stage: PipelineStage | null;
  to_stage: PipelineStage;
  occurred_at: string;
}

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const { id } = await params;
  const supabase = await createClient();

  const { data: contact, error } = await supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, email, phone, partner_first_name, partner_last_name, wedding_date, wedding_date_flexible, guest_count, budget_minor, source, created_at, opportunities(id, stage, archived_at)",
    )
    .eq("id", id)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (error) console.error("contact detail query failed:", error.message);
  if (!contact) notFound();

  const activeOpp = contact.opportunities.find((o) => o.archived_at === null);

  // Activity timeline — stage history for the active opportunity, newest first.
  let events: StageEvent[] = [];
  if (activeOpp) {
    const { data: ev } = await supabase
      .from("stage_events")
      .select("id, from_stage, to_stage, occurred_at")
      .eq("opportunity_id", activeOpp.id)
      .order("occurred_at", { ascending: false });
    events = ev ?? [];
  }

  const initialValues: ContactFormValues = {
    first_name: contact.first_name,
    last_name: contact.last_name ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    partner_first_name: contact.partner_first_name ?? "",
    partner_last_name: contact.partner_last_name ?? "",
    wedding_date: contact.wedding_date ?? "",
    wedding_date_flexible: contact.wedding_date_flexible,
    guest_count: contact.guest_count != null ? String(contact.guest_count) : "",
    budget: contact.budget_minor != null ? String(contact.budget_minor / 100) : "",
    source: contact.source ?? "",
  };

  const name = contactDisplayName(contact);
  const partnerName = contactDisplayName({
    first_name: contact.partner_first_name ?? "",
    last_name: contact.partner_last_name ?? null,
  }).trim();

  return (
    <div className="mx-auto max-w-[1000px]">
      <Link
        href="/contacts"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Contacts
      </Link>

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
              {name}
            </h1>
            {activeOpp && <StageBadge stage={activeOpp.stage} />}
          </div>
          {partnerName && (
            <p className="mt-2 text-sm text-muted-foreground">
              With {partnerName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/contacts/${contact.id}/messages`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <MessageSquare className="size-4" aria-hidden />
            Messages
          </Link>
          <ContactDetailActions
            contactId={contact.id}
            contactName={name}
            initialValues={initialValues}
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        {/* Details */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Details
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
            <Detail label="Email" value={contact.email} />
            <Detail label="Phone" value={contact.phone} />
            <Detail
              label="Wedding date"
              value={
                formatWeddingDate(contact.wedding_date)
                  ? `${formatWeddingDate(contact.wedding_date)}${contact.wedding_date_flexible ? " (flexible)" : ""}`
                  : null
              }
            />
            <Detail
              label="Guest count"
              value={contact.guest_count != null ? String(contact.guest_count) : null}
            />
            <Detail label="Budget" value={formatBudget(contact.budget_minor)} />
            <Detail label="Source" value={contact.source} />
          </dl>
        </div>

        {/* Activity timeline */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Activity
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="relative space-y-5 border-l border-border pl-5">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span
                    className="absolute -left-[1.4rem] top-1 size-2.5 rounded-full bg-fun-pink-strong ring-4 ring-card"
                    aria-hidden
                  />
                  <p className="text-sm text-foreground">
                    {e.from_stage === null ? (
                      <>Enquiry created in {stageMeta(e.to_stage).label}</>
                    ) : (
                      <>
                        Moved from {stageMeta(e.from_stage).label} to{" "}
                        {stageMeta(e.to_stage).label}
                      </>
                    )}
                  </p>
                  <time className="text-xs text-muted-foreground tabular-nums">
                    {formatDateTime(e.occurred_at)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">
        {value ?? <span className="text-muted-foreground">—</span>}
      </dd>
    </div>
  );
}
