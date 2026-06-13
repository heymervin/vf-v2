import type { TenantContext } from "@/lib/tenant";

/** The error branch of ActionResult — assignable to ActionResult<T> for any T. */
type ActionError = { ok: false; error: string };

/**
 * Guard for staff mutation actions.
 *
 * Returns an error object (the `ok: false` branch of ActionResult) when the
 * venue's access state blocks writes:
 *   - 'expired'  → trial elapsed and no active subscription
 *   - 'past_due' → subscription is past due or incomplete
 *
 * The return type is `{ ok: false; error: string } | null` which is assignable
 * to `ActionResult<T>` for any T — no generic needed at call sites.
 *
 * Public booking/lead-capture routes are NOT gated here (those are the
 * venue's customers, not the venue staff) — skip this guard in public actions.
 *
 * Usage:
 *   const ctx = await getTenantContext();
 *   if (!ctx.ok) return err("Not authenticated.");
 *   const guard = assertCanMutate(ctx);
 *   if (guard) return guard;
 *   // ... proceed with mutation
 */
export function assertCanMutate(
  ctx: Extract<TenantContext, { ok: true }>,
): ActionError | null {
  if (ctx.access === "expired") {
    return {
      ok: false,
      error: "Your trial has ended. Subscribe to continue making changes.",
    };
  }
  if (ctx.access === "past_due") {
    return {
      ok: false,
      error:
        "Your subscription payment is overdue. Update your billing to continue.",
    };
  }
  return null;
}
