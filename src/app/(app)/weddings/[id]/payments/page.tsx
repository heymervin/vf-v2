import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/layout/page-header";
import { PaymentsClient } from "./payments-client";
import type { MilestoneWithStatus } from "./actions";
import type { GhlInvoiceDisplayStatus } from "@/lib/ghl/types";

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("weddings")
    .select("couple_names")
    .eq("id", id)
    .maybeSingle();
  return { title: data ? `Payments — ${data.couple_names}` : "Payments" };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const supabase = await createClient();

  // Verify wedding belongs to this venue
  const { data: wedding, error: weddingError } = await supabase
    .from("weddings")
    .select("id, couple_names, ghl_contact_id")
    .eq("id", id)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (weddingError) console.error("payments page wedding load:", weddingError.message);
  if (!wedding) notFound();

  // Load milestones (admin client for RLS bypass — venue_id filter below ensures scope)
  const admin = createAdminClient();
  const { data: milestonesData, error: milestonesError } = await admin
    .from("payment_milestones")
    .select("*")
    .eq("wedding_id", id)
    .eq("venue_id", ctx.venue.id)
    .order("due_date", { ascending: true })
    .order("sort_order", { ascending: true });

  if (milestonesError) console.error("payments page milestones load:", milestonesError.message);

  // Check whether this venue has GHL credentials (determines whether invoice actions show)
  const { data: ghlCreds } = await admin
    .from("ghl_credentials")
    .select("id")
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  const hasGhlConnection = !!ghlCreds;

  // Enrich milestones with displayStatus
  const milestones: MilestoneWithStatus[] = (milestonesData ?? []).map((m) => ({
    ...m,
    displayStatus: m.ghl_invoice_id
      ? (m.status as GhlInvoiceDisplayStatus)
      : null,
  }));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Payments"
        subtitle={`${wedding.couple_names} · ${milestones.length} milestone${milestones.length === 1 ? "" : "s"}`}
        actions={
          <Link
            href={`/weddings/${id}`}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-xs transition-all hover:border-foreground/30 hover:shadow-sm"
          >
            <ArrowLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {wedding.couple_names}
          </Link>
        }
      />

      <PaymentsClient
        weddingId={id}
        ghlContactId={wedding.ghl_contact_id}
        initialMilestones={milestones}
        hasGhlConnection={hasGhlConnection}
      />
    </div>
  );
}
