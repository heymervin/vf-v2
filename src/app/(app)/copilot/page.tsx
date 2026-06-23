import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { deriveInsights, type InsightInput } from "@/lib/copilot/insights";
import { CopilotTriage } from "./copilot-triage";

export const metadata = { title: "Copilot" };

/** YYYY-MM-DD for `date`-typed columns (due_date, wedding_date). */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function CopilotPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const venueId = ctx.venue.id;
  const supabase = await createClient();

  const now = new Date();
  const today = isoDate(now);
  const in30Days = isoDate(new Date(now.getTime() + 30 * 86_400_000));
  const fortnightAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString();

  // All queries are RLS-scoped (security-invoker session client) AND explicitly
  // filtered by venue_id. `head: true` returns only the count, never the rows.
  const [
    overdueTasks,
    overduePayments,
    duePayments,
    imminentWeddings,
    stalePipeline,
    outstandingRsvps,
  ] = await Promise.all([
    supabase
      .from("wedding_tasks")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .eq("done", false)
      .lt("due_date", today),
    supabase
      .from("payment_milestones")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .eq("status", "overdue"),
    supabase
      .from("payment_milestones")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .eq("status", "due"),
    supabase
      .from("weddings")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .neq("status", "cancelled")
      .gte("wedding_date", today)
      .lte("wedding_date", in30Days),
    supabase
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .is("archived_at", null)
      .lt("updated_at", fortnightAgo),
    supabase
      .from("wedding_guests")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", venueId)
      .eq("rsvp", "pending"),
  ]);

  const input: InsightInput = {
    overdueTaskCount: overdueTasks.count ?? 0,
    overduePaymentCount: overduePayments.count ?? 0,
    duePaymentCount: duePayments.count ?? 0,
    imminentWeddingCount: imminentWeddings.count ?? 0,
    stalePipelineCount: stalePipeline.count ?? 0,
    outstandingRsvpCount: outstandingRsvps.count ?? 0,
  };

  const insights = deriveInsights(input);

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
          Copilot
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          What needs your attention at {ctx.venue.name} — ranked by priority.
          Ask anything with ⌘K.
        </p>
      </div>

      <div className="max-w-2xl">
        <CopilotTriage insights={insights} />
      </div>
    </div>
  );
}
