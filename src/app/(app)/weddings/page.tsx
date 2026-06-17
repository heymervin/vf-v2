import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { WeddingsList, type WeddingRow } from "./weddings-list";

export const metadata = { title: "Weddings" };

export default async function WeddingsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const supabase = await createClient();

  // Fetch weddings joined to spaces for the space name
  const { data, error } = await supabase
    .from("weddings")
    .select(
      "id, couple_names, wedding_date, status, guest_count_day, guest_count_evening, total_value_minor, space_id, source, spaces(name)",
    )
    .eq("venue_id", ctx.venue.id)
    .neq("status", "cancelled")
    .order("wedding_date", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("weddings list query failed:", error.message);
  }

  const weddings: WeddingRow[] = (data ?? []).map((row) => ({
    id: row.id,
    couple_names: row.couple_names,
    wedding_date: row.wedding_date,
    status: row.status,
    guest_count_day: row.guest_count_day,
    guest_count_evening: row.guest_count_evening,
    total_value_minor: row.total_value_minor,
    space_id: row.space_id,
    source: row.source,
    space_name:
      row.spaces && !Array.isArray(row.spaces) ? row.spaces.name : null,
  }));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Weddings"
        subtitle="Every booked wedding workspace — plans, payments, and planning tools in one place."
      />
      {/* WeddingsList handles both the populated grid and empty state with create button */}
      <WeddingsList weddings={weddings} />
    </div>
  );
}
