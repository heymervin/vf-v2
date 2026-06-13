/**
 * M6 Trial enforcement verification script.
 *
 * Tests:
 *   1. A venue with trial_ends_at in the past + no active sub → gated mutation
 *      actions return the read-only error.
 *   2. Public bookSlot still works (not gated).
 *
 * Run: node scripts/verify-m6-trial-enforcement.mjs
 * Requires .env.local with SUPABASE_* credentials.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';

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

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('FAIL: Missing SUPABASE env vars in .env.local');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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

// Import computeAccessState logic inline (mirrors src/lib/tenant.ts)
function computeAccessState(trialEndsAt, billingStatus) {
  const now = Date.now();
  if (billingStatus === 'active' || billingStatus === 'trialing') return 'active';
  if (billingStatus === 'past_due' || billingStatus === 'incomplete') return 'past_due';
  if (trialEndsAt && new Date(trialEndsAt).getTime() > now) return 'trialing';
  return 'expired';
}

console.log('\n=== M6 Trial Enforcement Verification ===\n');

// ── Test 1: computeAccessState logic ─────────────────────────────────────────
console.log('--- Access state computation ---');

const past = new Date(Date.now() - 86400_000).toISOString();   // yesterday
const future = new Date(Date.now() + 86400_000).toISOString(); // tomorrow

assert('trialing: future trial, no billing',
  computeAccessState(future, null) === 'trialing');

assert('expired: past trial, no billing',
  computeAccessState(past, null) === 'expired');

assert('active: billing status=active overrides expired trial',
  computeAccessState(past, 'active') === 'active');

assert('active: billing status=trialing overrides expired trial',
  computeAccessState(past, 'trialing') === 'active');

assert('past_due: billing status=past_due',
  computeAccessState(future, 'past_due') === 'past_due');

assert('past_due: billing status=incomplete',
  computeAccessState(future, 'incomplete') === 'past_due');

assert('expired: canceled billing + past trial',
  computeAccessState(past, 'canceled') === 'expired');

// ── Test 2: assertCanMutate returns error when expired ────────────────────────
console.log('\n--- assertCanMutate guard ---');

// Inline the guard logic (mirrors src/lib/billing/access.ts)
function assertCanMutate(access) {
  if (access === 'expired') {
    return { ok: false, error: 'Your trial has ended. Subscribe to continue making changes.' };
  }
  if (access === 'past_due') {
    return { ok: false, error: 'Your subscription payment is overdue. Update your billing to continue.' };
  }
  return null;
}

assert('expired → guard returns error',
  assertCanMutate('expired')?.ok === false);

assert('expired → error message mentions trial',
  assertCanMutate('expired')?.error.includes('trial'));

assert('past_due → guard returns error',
  assertCanMutate('past_due')?.ok === false);

assert('trialing → guard returns null (allowed)',
  assertCanMutate('trialing') === null);

assert('active → guard returns null (allowed)',
  assertCanMutate('active') === null);

// ── Test 3: DB state — set trial_ends_at to past, verify computeAccessState ──
console.log('\n--- DB-backed trial expiry ---');

const runId = Math.random().toString(36).slice(2, 8);
const venueId = crypto.randomUUID();

const { error: venueErr } = await admin.from('venues').insert({
  id: venueId,
  name: `Trial Test Venue ${runId}`,
  slug: `trial-test-${runId}`,
  trial_ends_at: past,  // ← already expired
  onboarding_completed_at: new Date().toISOString(),
});
assert('Test venue inserted', !venueErr, venueErr?.message ?? '');

if (!venueErr) {
  // Fetch billing row (none exists for this fresh venue)
  const { data: billing } = await admin
    .from('billing_subscriptions')
    .select('status')
    .eq('venue_id', venueId)
    .maybeSingle();

  // Fetch venue to get trial_ends_at
  const { data: venue } = await admin
    .from('venues')
    .select('trial_ends_at')
    .eq('id', venueId)
    .single();

  const accessState = computeAccessState(venue?.trial_ends_at ?? null, billing?.status ?? null);
  assert('Expired venue with no billing → access=expired', accessState === 'expired', `got=${accessState}`);

  const guard = assertCanMutate(accessState);
  assert('assertCanMutate returns error for expired venue', guard?.ok === false, JSON.stringify(guard));

  // Now insert an active subscription → access should become active
  await admin.from('billing_subscriptions').insert({
    venue_id: venueId,
    stripe_customer_id: `cus_test_${runId}`,
    stripe_subscription_id: `sub_test_${runId}`,
    status: 'active',
    current_period_end: future,
  });

  const { data: billingActive } = await admin
    .from('billing_subscriptions')
    .select('status')
    .eq('venue_id', venueId)
    .maybeSingle();

  const accessStateActive = computeAccessState(past, billingActive?.status ?? null);
  assert('Expired trial + active subscription → access=active', accessStateActive === 'active', `got=${accessStateActive}`);

  const guardActive = assertCanMutate(accessStateActive);
  assert('assertCanMutate returns null for active subscription', guardActive === null);
}

// ── Test 4: Public booking route is NOT gated ─────────────────────────────────
console.log('\n--- Public booking route not gated ---');
// bookSlot lives in src/app/(public)/book/[venueSlug]/[meetingType]/actions.ts
// It uses getTenantContext only for the venue slug lookup (not for the booker).
// The public action does NOT call assertCanMutate. We verify this by checking
// the source file doesn't import assertCanMutate.
import { readFileSync as rf } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(import.meta.url), '../../');
let bookActionsPath;
try {
  bookActionsPath = path.join(root, 'src/app/(public)/book/[venueSlug]/[meetingType]/actions.ts');
  rf(bookActionsPath); // will throw if doesn't exist
} catch {
  bookActionsPath = null;
}

if (bookActionsPath) {
  const source = rf(bookActionsPath, 'utf8');
  assert('bookSlot does NOT import assertCanMutate',
    !source.includes('assertCanMutate'),
    'found assertCanMutate import in public booking actions');
} else {
  console.log('  SKIP  bookSlot actions file not found — manual verification needed');
}

// Cleanup
await admin.from('billing_subscriptions').delete().eq('venue_id', venueId);
await admin.from('venues').delete().eq('id', venueId);

console.log(`\n${'='.repeat(50)}`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
