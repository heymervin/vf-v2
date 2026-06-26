import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Smartphone } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { RunsheetClient } from "./runsheet-client";
import type { Tables } from "@/lib/supabase/types";

type TimelineEventRow = Tables<"timeline_events">;
type WeddingSupplierRow = Tables<"wedding_suppliers">;

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
  return { title: data ? `Run-sheet — ${data.couple_names}` : "Run-sheet" };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RunsheetPage({
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
    .select("id, couple_names, wedding_date, guest_count_day")
    .eq("id", id)
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  if (weddingError) console.error("runsheet page wedding load:", weddingError.message);
  if (!wedding) notFound();

  // Load timeline events ordered by sort_order (chronological)
  const { data: eventsData, error: eventsError } = await supabase
    .from("timeline_events")
    .select("*")
    .eq("wedding_id", id)
    .order("sort_order", { ascending: true });

  if (eventsError) console.error("runsheet page events load:", eventsError.message);

  // Load wedding suppliers for the check-in board + supplier links on events
  const { data: suppliersData, error: suppliersError } = await supabase
    .from("wedding_suppliers")
    .select("id, name, contact_name, phone, checked_in_at")
    .eq("wedding_id", id)
    .order("name", { ascending: true });

  if (suppliersError) console.error("runsheet page suppliers load:", suppliersError.message);

  const events = (eventsData ?? []) as TimelineEventRow[];
  const suppliers = (suppliersData ?? []) as Pick<
    WeddingSupplierRow,
    "id" | "name" | "contact_name" | "phone" | "checked_in_at"
  >[];

  const guestCount = wedding.guest_count_day ?? 0;

  // Format the date for display (e.g. "Saturday 14 June 2025")
  const formattedDate = wedding.wedding_date
    ? new Date(wedding.wedding_date).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Date TBC";

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Run-sheet"
        subtitle={`${wedding.couple_names} · ${formattedDate}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/weddings/${id}/runsheet/day`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-xs transition-all hover:border-foreground/30 hover:shadow-sm"
            >
              <Smartphone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              Day mode
            </Link>
            <Link
              href={`/weddings/${id}/beo`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-xs transition-all hover:border-foreground/30 hover:shadow-sm"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              Print BEO
            </Link>
            <Link
              href={`/weddings/${id}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-xs transition-all hover:border-foreground/30 hover:shadow-sm"
            >
              <ArrowLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {wedding.couple_names}
            </Link>
          </div>
        }
      />

      <RunsheetClient
        weddingId={id}
        coupleName={wedding.couple_names}
        formattedDate={formattedDate}
        guestCount={guestCount}
        initialEvents={events}
        initialSuppliers={suppliers}
      />
    </div>
  );
}
