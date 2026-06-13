import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type SubscriptionStatus =
  Database["public"]["Enums"]["subscription_status"];

/**
 * Stripe webhook handler.
 *
 * Security: constructEvent verifies the stripe-signature header using
 * STRIPE_WEBHOOK_SECRET. Missing secret → 500 at startup (never accept
 * unsigned payloads). Invalid signature → 401.
 *
 * Idempotency: every processed event_id is inserted into stripe_events with
 * ON CONFLICT DO NOTHING. A duplicate event returns 200 immediately without
 * re-applying the upsert.
 *
 * Handled events:
 *   customer.subscription.created  → upsert billing_subscriptions
 *   customer.subscription.updated  → upsert billing_subscriptions
 *   customer.subscription.deleted  → upsert status=canceled
 *   checkout.session.completed     → upsert billing_subscriptions from session
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured." },
      { status: 500 },
    );
  }

  const stripe = getStripeClient();
  if (!stripe) {
    console.error("[stripe-webhook] STRIPE_SECRET_KEY is not set");
    return NextResponse.json(
      { error: "Stripe not configured." },
      { status: 500 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header." },
      { status: 400 },
    );
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (e) {
    console.warn(
      "[stripe-webhook] signature verification failed:",
      (e as Error).message,
    );
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const admin = createAdminClient();

  // ── Idempotency check ─────────────────────────────────────────────────────
  // ignoreDuplicates=true → ON CONFLICT DO NOTHING. When the event_id already
  // exists data will be null/empty — that means it was already processed.
  const { data: dedupRows, error: dedupError } = await admin
    .from("stripe_events")
    .upsert({ event_id: event.id, type: event.type }, { onConflict: "event_id", ignoreDuplicates: true })
    .select("event_id");

  if (dedupError) {
    console.error("[stripe-webhook] dedup insert failed:", dedupError.message);
    return NextResponse.json({ error: "DB error." }, { status: 500 });
  }

  // If no rows were returned the event was already processed — ack and return.
  if (!dedupRows || dedupRows.length === 0) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // ── Event dispatch ────────────────────────────────────────────────────────
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpsert(admin, stripe, sub);
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const sub = await stripe.subscriptions.retrieve(subId);
        await handleSubscriptionUpsert(admin, stripe, sub);
      }
      break;
    }

    default:
      // Unhandled event type — acknowledge and ignore.
      break;
  }

  return NextResponse.json({ received: true });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createAdminClient>;

async function handleSubscriptionUpsert(
  admin: AdminClient,
  _stripe: Stripe,
  sub: Stripe.Subscription,
): Promise<void> {
  // venue_id is stored in subscription metadata set at checkout creation.
  const venueId =
    sub.metadata?.venue_id ??
    (sub as unknown as { metadata: Record<string, string> }).metadata
      ?.venue_id;

  if (!venueId) {
    console.warn(
      "[stripe-webhook] subscription missing venue_id metadata:",
      sub.id,
    );
    return;
  }

  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const stripeStatus = sub.status; // Stripe's status string
  const dbStatus = mapStripeStatus(stripeStatus);

  const rawPeriodEnd = sub.items.data[0]?.current_period_end;
  const currentPeriodEnd =
    rawPeriodEnd != null
      ? new Date(rawPeriodEnd * 1000).toISOString()
      : null;

  const priceId =
    sub.items.data[0]?.price?.id ?? null;

  const { error } = await admin
    .from("billing_subscriptions")
    .upsert(
      {
        venue_id: venueId,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        status: dbStatus,
        current_period_end: currentPeriodEnd,
        price_id: priceId,
      },
      { onConflict: "venue_id" },
    );

  if (error) {
    console.error(
      "[stripe-webhook] billing_subscriptions upsert failed:",
      error.message,
    );
  }
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
    case "unpaid":
    case "paused":
      return "canceled";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    default:
      return "incomplete";
  }
}
