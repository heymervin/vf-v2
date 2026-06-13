/**
 * M6 Idempotency verification script.
 *
 * Simulates a Stripe webhook event being delivered twice (duplicate event_id).
 * Asserts:
 *   1. First delivery → billing_subscriptions row created
 *   2. Second delivery with same event_id → stripe_events insert no-ops,
 *      billing_subscriptions NOT double-applied (row count stays at 1)
 *
 * Run: node scripts/verify-m6-idempotency.mjs
 * Requires .env.local with SUPABASE_SERVICE_ROLE_KEY and SUPABASE_DB_PASSWORD.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';
import Stripe from '../node_modules/stripe/cjs/stripe.cjs.node.js';

function loadEnv(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnv(new URL('../.env.local', import.meta.url).pathname);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_SECRET_KEY = env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = env.STRIPE_WEBHOOK_SECRET;
const APP_URL = env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('FAIL: Missing SUPABASE env vars');
  process.exit(1);
}

if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
  console.log('SKIP: STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not set — skipping idempotency test.');
  console.log('  To run this test, configure Stripe credentials in .env.local');
  process.exit(0);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2026-05-27.dahlia' });

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}${detail ? ' | ' + detail : ''}`);
    failed++;
  }
}

// Create a synthetic venue for the test
const runId = Math.random().toString(36).slice(2, 8);
const venueId = crypto.randomUUID();

async function run() {
  console.log(`\n=== M6 Idempotency Test (run: ${runId}) ===\n`);

  // 1. Insert a fake venue directly (service role)
  const { error: venueErr } = await admin.from('venues').insert({
    id: venueId,
    name: `Idempotency Test Venue ${runId}`,
    slug: `idempotency-${runId}`,
    trial_ends_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
    onboarding_completed_at: new Date().toISOString(),
  });
  if (venueErr) {
    console.error('Setup failed: could not insert test venue:', venueErr.message);
    process.exit(1);
  }
  console.log(`  OK    Created test venue: ${venueId}`);

  // 2. Build a synthetic customer.subscription.updated payload
  const eventId = `evt_test_idempotency_${runId}`;
  const customerId = `cus_test_${runId}`;
  const subscriptionId = `sub_test_${runId}`;
  const now = Math.floor(Date.now() / 1000);

  // Build a minimal subscription object matching Stripe's shape
  const subscriptionObject = {
    id: subscriptionId,
    object: 'subscription',
    customer: customerId,
    status: 'active',
    metadata: { venue_id: venueId },
    items: {
      object: 'list',
      data: [
        {
          id: `si_test_${runId}`,
          object: 'subscription_item',
          price: { id: `price_test_${runId}`, object: 'price' },
          current_period_end: now + 30 * 86400,
        },
      ],
    },
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    created: now,
    current_period_start: now,
    trial_end: null,
    trial_start: null,
  };

  // Sign the payload as Stripe would
  const payload = JSON.stringify({
    id: eventId,
    object: 'event',
    type: 'customer.subscription.updated',
    data: { object: subscriptionObject },
    created: now,
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
  });

  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: STRIPE_WEBHOOK_SECRET,
  });

  // 3. POST to webhook endpoint twice
  console.log('\n--- Delivering event twice ---');

  async function deliverWebhook() {
    const res = await fetch(`${APP_URL}/api/webhooks/stripe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature,
      },
      body: payload,
    });
    return res;
  }

  const res1 = await deliverWebhook();
  const body1 = await res1.json();
  assert('First delivery returns 200', res1.status === 200, `status=${res1.status}`);
  assert('First delivery not duplicate', body1.duplicate !== true, JSON.stringify(body1));

  const res2 = await deliverWebhook();
  const body2 = await res2.json();
  assert('Second delivery returns 200', res2.status === 200, `status=${res2.status}`);
  assert('Second delivery flagged as duplicate', body2.duplicate === true, JSON.stringify(body2));

  // 4. Verify billing_subscriptions has exactly 1 row for this venue
  const { data: subRows, error: subErr } = await admin
    .from('billing_subscriptions')
    .select('id, stripe_subscription_id, status')
    .eq('venue_id', venueId);

  assert('billing_subscriptions has exactly 1 row (not double-applied)',
    !subErr && subRows?.length === 1,
    subErr?.message ?? `rows=${subRows?.length}`);

  if (subRows?.length === 1) {
    assert('subscription row has correct stripe_subscription_id',
      subRows[0].stripe_subscription_id === subscriptionId,
      `got=${subRows[0].stripe_subscription_id}`);
    assert('subscription row has status=active',
      subRows[0].status === 'active',
      `got=${subRows[0].status}`);
  }

  // 5. Verify stripe_events has exactly 1 row for this event_id
  const { data: evtRows, error: evtErr } = await admin
    .from('stripe_events')
    .select('event_id')
    .eq('event_id', eventId);

  assert('stripe_events has exactly 1 row for event_id (no duplicate)',
    !evtErr && evtRows?.length === 1,
    evtErr?.message ?? `rows=${evtRows?.length}`);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));
}

async function cleanup() {
  console.log('\n--- Cleanup ---');
  // Delete billing_subscriptions first (FK)
  await admin.from('billing_subscriptions').delete().eq('venue_id', venueId);
  // Delete stripe_events
  const runPrefix = `evt_test_idempotency_${runId}`;
  await admin.from('stripe_events').delete().eq('event_id', runPrefix);
  // Delete venue
  await admin.from('venues').delete().eq('id', venueId);
  console.log('  OK    Cleaned up test data');
}

let exitCode = 0;
try {
  await run();
  exitCode = failed > 0 ? 1 : 0;
} catch (err) {
  console.error('\nUNEXPECTED ERROR:', err);
  exitCode = 1;
} finally {
  try { await cleanup(); } catch {}
}

process.exit(exitCode);
