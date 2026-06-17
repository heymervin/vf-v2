import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { getMoneyKpis, getProposals, getBookingsPaymentHealth } from "./actions";
import { MoneyClient } from "./money-client";

export const metadata = { title: "Proposals & Payments" };

export default async function MoneyPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const supabase = await createClient();

  const [kpisResult, proposalsResult, bookingsResult, weddingsRes] =
    await Promise.all([
      getMoneyKpis(),
      getProposals(),
      getBookingsPaymentHealth(),
      supabase
        .from("weddings")
        .select("id, couple_names")
        .eq("venue_id", ctx.venue.id)
        .neq("status", "cancelled")
        .order("wedding_date", { ascending: true, nullsFirst: false }),
    ]);

  const kpis = kpisResult.ok
    ? kpisResult.data
    : { totalBookedMinor: 0, totalCollectedMinor: 0, totalOutstandingMinor: 0, weddingCount: 0 };

  const proposals = proposalsResult.ok ? proposalsResult.data : [];
  const bookings = bookingsResult.ok ? bookingsResult.data : [];
  const weddings = (weddingsRes.data ?? []).map((w) => ({
    id: w.id,
    couple_names: w.couple_names,
  }));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Proposals & Payments"
        subtitle="Track proposals from draft to accepted, booked value, and every payment milestone."
      />

      <MoneyClient
        kpis={kpis}
        proposals={proposals}
        bookings={bookings}
        weddings={weddings}
      />
    </div>
  );
}
