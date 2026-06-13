"use server";

import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Start a Stripe Checkout session for the active venue.
 * Owner-only. Redirects to Stripe on success.
 * Returns gracefully (no redirect) when Stripe is not configured — local dev.
 */
export async function startCheckout(): Promise<void> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return;
  if (ctx.role !== "owner") return;

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
}

/**
 * Open the Stripe Customer Portal for the active venue.
 * Owner-only. Redirects to Stripe on success.
 */
export async function openPortal(): Promise<void> {
  const ctx = await getTenantContext();
  if (!ctx.ok) return;
  if (ctx.role !== "owner") return;

  const stripeCustomerId = ctx.billing.stripeCustomerId;
  if (!stripeCustomerId) return;

  const returnUrl = `${APP_URL}/settings/billing`;
  const url = await createPortalSession(stripeCustomerId, returnUrl);

  if (url) redirect(url);
}
