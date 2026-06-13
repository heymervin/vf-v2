import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { CheckoutButton, PortalButton } from "./billing-actions";

export const metadata = { title: "Billing" };

function daysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400_000));
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!ctx.ok) redirect("/login");

  const { checkout } = await searchParams;
  const isOwner = ctx.role === "owner";
  const access = ctx.access;
  const billing = ctx.billing;
  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;

  const trialDays = daysLeft(ctx.venue.trialEndsAt);
  const periodEndDays = daysLeft(billing.currentPeriodEnd);

  // Human-readable status label
  const statusLabel: Record<typeof access, string> = {
    trialing: `Free trial${trialDays !== null ? ` — ${trialDays} day${trialDays === 1 ? "" : "s"} left` : ""}`,
    active: "Active subscription",
    past_due: "Payment overdue",
    expired: "Trial ended — subscription required",
  };

  const hasActiveSub =
    billing.status === "active" || billing.status === "trialing";

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-[-0.022em] leading-[1.1] text-foreground">
          Billing
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Manage your VenueFlow subscription.
        </p>
      </div>

      {/* Checkout success banner */}
      {checkout === "success" && (
        <div className="mb-6 rounded-xl border border-[oklch(0.774_0.161_135)] bg-[oklch(0.934_0.076_134)] px-5 py-4 text-sm font-medium text-[oklch(0.447_0.098_135)]">
          Subscription activated. Welcome to VenueFlow.
        </div>
      )}

      {/* Plan status card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Current plan
        </p>
        <p className="mt-2 text-xl font-semibold text-foreground">
          {statusLabel[access]}
        </p>

        {access === "active" && periodEndDays !== null && (
          <p className="mt-1 text-sm text-muted-foreground">
            Next renewal in {periodEndDays} day{periodEndDays === 1 ? "" : "s"}
          </p>
        )}

        {access === "past_due" && (
          <p className="mt-1 text-sm text-destructive">
            Update your payment method to restore access.
          </p>
        )}

        {access === "expired" && (
          <p className="mt-1 text-sm text-destructive">
            Your account is read-only until you subscribe.
          </p>
        )}

        {!stripeConfigured && (
          <p className="mt-3 rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
            Stripe is not configured. Set{" "}
            <code className="font-mono text-xs">STRIPE_SECRET_KEY</code> and{" "}
            <code className="font-mono text-xs">STRIPE_PRICE_ID</code> to
            enable billing.
          </p>
        )}

        {stripeConfigured && isOwner && (
          <div className="mt-6">
            {hasActiveSub ? <PortalButton /> : <CheckoutButton />}
          </div>
        )}

        {!isOwner && (
          <p className="mt-4 text-sm text-muted-foreground">
            Only the account owner can manage billing.
          </p>
        )}
      </div>
    </div>
  );
}
