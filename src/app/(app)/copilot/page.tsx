import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { PageHeader } from "@/components/layout/page-header";
import { CopilotTriage } from "./copilot-triage";
import { computeCopilotInsights } from "@/lib/copilot/load";

export const metadata = { title: "Copilot" };

// ---------------------------------------------------------------------------
// Server component
// ---------------------------------------------------------------------------

export default async function CopilotPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const insights = await computeCopilotInsights(ctx.venue.id);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Copilot"
        subtitle="Ranked by priority. Act on what matters most."
        shimmer={false}
      />

      <div className="max-w-2xl">
        <CopilotTriage insights={insights} />
      </div>
    </div>
  );
}
