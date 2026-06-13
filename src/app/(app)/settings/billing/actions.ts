"use server";

import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/stripe";
import { err, ok, type ActionResult } from "@/lib/actions";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Start a Stripe Checkout session for the active venue.
 * Owner-only. Redirects to Stripe on success.
 * Returns gracefully (no redirect) when Stripe is not configured — local dev.
 */
export async function startCheckout(
  _prev: ActionResult<void>,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated. Please sign in again.");
  if (ctx.role !== "owner") return err("Only the account owner can manage billing.");

  const email = ctx.user.email ?? "";
  const successUrl = `${APP_URL}/settings/billing?checkout=success`;
  const cancelUrl = `${APP_URL}/settings/billing`;

  const url = await createCheckoutSession(
    ctx.venue.id,
    email,
    successUrl,
    cancelUrl,
  );

  if (url) redirect(url);
  return ok(undefined);
}

/**
 * Open the Stripe Customer Portal for the active venue.
 * Owner-only. Redirects to Stripe on success.
 */
export async function openPortal(
  _prev: ActionResult<void>,
): Promise<ActionResult<void>> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return err("Not authenticated. Please sign in again.");
  if (ctx.role !== "owner") return err("Only the account owner can manage billing.");

  const stripeCustomerId = ctx.billing.stripeCustomerId;
  if (!stripeCustomerId) return err("No billing account found. Please start a subscription first.");

  const returnUrl = `${APP_URL}/settings/billing`;
  const url = await createPortalSession(stripeCustomerId, returnUrl);

  if (url) redirect(url);
  return ok(undefined);
}
