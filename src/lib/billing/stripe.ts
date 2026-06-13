import "server-only";
import Stripe from "stripe";

/**
 * Server-only Stripe client.
 * Returns null when STRIPE_SECRET_KEY is unset so local dev without Stripe
 * keys still boots — callers must handle the null case gracefully.
 */
export function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
}

/**
 * Create a Stripe Checkout Session for a venue.
 * Returns the session URL on success, null when Stripe is not configured.
 *
 * @param venueId  - Internal venue UUID (stored in Stripe metadata)
 * @param email    - Customer email to pre-fill Checkout
 * @param successUrl - Redirect after payment
 * @param cancelUrl  - Redirect on cancel
 */
export async function createCheckoutSession(
  venueId: string,
  email: string,
  successUrl: string,
  cancelUrl: string,
): Promise<string | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) return null;

  // Look up or create a Stripe Customer for this venue.
  // We search by metadata.venue_id to be idempotent.
  const existing = await stripe.customers.search({
    query: `metadata['venue_id']:'${venueId}'`,
    limit: 1,
  });

  let customerId: string;
  if (existing.data.length > 0 && existing.data[0]) {
    customerId = existing.data[0].id;
  } else {
    const customer = await stripe.customers.create({
      email,
      metadata: { venue_id: venueId },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      trial_period_days: 14,
      metadata: { venue_id: venueId },
    },
    metadata: { venue_id: venueId },
  });

  return session.url;
}

/**
 * Create a Stripe Customer Portal session for a venue.
 * Returns the portal URL on success, null when Stripe is not configured or
 * the venue has no Stripe customer yet.
 *
 * @param stripeCustomerId - Stripe customer ID stored in billing_subscriptions
 * @param returnUrl        - Where to redirect after the portal session
 */
export async function createPortalSession(
  stripeCustomerId: string,
  returnUrl: string,
): Promise<string | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });

  return session.url;
}
