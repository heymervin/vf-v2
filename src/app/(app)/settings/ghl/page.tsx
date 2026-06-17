import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenantContext } from "@/lib/tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { ghlClient } from "@/lib/ghl/client";
import { GhlSettings } from "./ghl-settings";
import type { GhlCounts } from "./actions";

export const metadata = { title: "GoHighLevel" };

export default async function GhlSettingsPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const admin = createAdminClient();

  // Load credentials row via service-role (SD-8 — no RLS on ghl_credentials)
  const { data: creds } = await admin
    .from("ghl_credentials")
    .select("location_id, auth_type")
    .eq("venue_id", ctx.venue.id)
    .maybeSingle();

  // Load current mode from venues
  const { data: venueRow } = await admin
    .from("venues")
    .select("mode")
    .eq("id", ctx.venue.id)
    .single();

  const connected = creds !== null;
  const mode = venueRow?.mode ?? "standalone";
  const canManage = ctx.role === "owner" || ctx.role === "admin";

  // If connected, fetch live counts (graceful degradation — never throws to the page)
  let counts: GhlCounts | null = null;
  if (connected) {
    try {
      const client = await ghlClient(ctx.venue.id);
      if (client) {
        const [contactsResp, pipelineStages] = await Promise.all([
          client.listContacts(1),
          client.getPipelineCounts(),
        ]);
        counts = {
          totalContacts: contactsResp.meta.total,
          pipelineStages,
        };
      }
    } catch {
      // Live counts are a "first visible win" — don't break the page if GHL is unreachable
      counts = null;
    }
  }

  return (
    <div className="mx-auto max-w-[680px]">
      <Link
        href="/settings"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Settings
      </Link>

      <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
        GoHighLevel
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Connect your GoHighLevel sub-account to sync contacts and pipeline data
        into VenueFlow.
      </p>

      <div className="mt-8">
        <GhlSettings
          connected={connected}
          mode={mode}
          locationId={creds?.location_id ?? null}
          counts={counts}
          canManage={canManage}
        />
      </div>
    </div>
  );
}
