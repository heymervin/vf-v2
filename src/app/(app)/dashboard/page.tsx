import { redirect } from "next/navigation";
import Link from "next/link";
import { getTenantContext } from "@/lib/tenant";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Dashboard" };

/**
 * Dashboard — empty-state that teaches (PRODUCT.md principle 5).
 *
 * - Solid deep navy H1 with .title-shimmer-underline (one of the two permitted surfaces)
 * - Greeting with venue name
 * - Single empty-state panel (no card grid — DESIGN.md ban)
 * - No fake metrics
 */
export default async function DashboardPage() {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const venueName = ctx.venue.name;

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Page header */}
      <div className="mb-10">
        <h1 className="title-shimmer-underline inline-block text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
          Dashboard
        </h1>
        <p className="mt-5 text-sm text-muted-foreground">
          Welcome to {venueName}.
        </p>
      </div>

      {/* Single empty-state panel — teaches the next step */}
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm max-w-xl">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Quick links
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          Your enquiry form drives the pipeline
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Share your form link or embed it on your website. Every submission
          lands in your pipeline automatically, tagged with its source.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {/* Pink CTA → settings (forms at M3) */}
          <Button asChild>
            <Link href="/settings">Set up your form</Link>
          </Button>
          {/* Secondary outline → contacts */}
          <Button asChild variant="outline">
            <Link href="/contacts">View contacts</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
