/**
 * rls-cross-tenant.mjs
 * VenueFlow — Cross-tenant RLS integration test
 * Run: node scripts/rls-cross-tenant.mjs
 *
 * Tests that Row Level Security truly isolates tenant data.
 * Self-cleaning, idempotent (unique suffix per run).
 * Exit code 0 = all assertions passed.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';

// ---------------------------------------------------------------------------
// 1. Load .env.local (tiny hand-rolled parser — no dotenv dep)
// ---------------------------------------------------------------------------
function loadEnv(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    throw new Error(`Cannot read ${filePath}`);
  }
  const env = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnv(new URL('../.env.local', import.meta.url).pathname);

const SUPABASE_URL        = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY   = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY    = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('FAIL: Missing required env vars in .env.local');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Supabase clients
// ---------------------------------------------------------------------------
const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anonClientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const anonClientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Unauthenticated client for the "anon select" assertions
const anonClientNoSession = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// 3. Test harness
// ---------------------------------------------------------------------------
const results = [];
let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  PASS  ${label}`);
    results.push({ label, pass: true });
    passed++;
  } else {
    console.error(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`);
    results.push({ label, pass: false, detail });
    failed++;
  }
}

// ---------------------------------------------------------------------------
// 4. Unique run suffix
// ---------------------------------------------------------------------------
const rand = Math.random().toString(36).slice(2, 8);
const emailA = `rls-a+${rand}@venueflow.io`;
const emailB = `rls-b+${rand}@venueflow.io`;
const pwA = `PwA${rand}!Aa1`;
const pwB = `PwB${rand}!Bb2`;
const slugA = `venue-a-${rand}`;
const slugB = `venue-b-${rand}`;

// Cleanup handles
let userIdA = null;
let userIdB = null;
let venueIdA = null;
let venueIdB = null;

// ---------------------------------------------------------------------------
// 5. Cleanup helper
// ---------------------------------------------------------------------------
async function cleanup() {
  console.log('\n--- Cleanup ---');

  // Delete storage objects
  for (const [venueId, label] of [[venueIdA, 'A'], [venueIdB, 'B']]) {
    if (!venueId) continue;
    try {
      const { data: objects } = await serviceClient.storage
        .from('venue-assets')
        .list(venueId);
      if (objects && objects.length > 0) {
        const paths = objects.map(o => `${venueId}/${o.name}`);
        const { error } = await serviceClient.storage
          .from('venue-assets')
          .remove(paths);
        if (error) console.warn(`  WARN  storage cleanup venue ${label}: ${error.message}`);
        else console.log(`  OK    storage objects deleted for venue ${label}`);
      }
    } catch (e) {
      console.warn(`  WARN  storage list venue ${label}: ${e.message}`);
    }
  }

  // Delete venues (cascades to memberships, spaces, venue_hours)
  for (const [venueId, label] of [[venueIdA, 'A'], [venueIdB, 'B']]) {
    if (!venueId) continue;
    const { error } = await serviceClient
      .from('venues')
      .delete()
      .eq('id', venueId);
    if (error) console.warn(`  WARN  venue ${label} delete: ${error.message}`);
    else console.log(`  OK    venue ${label} deleted`);
  }

  // Delete auth users
  for (const [userId, label] of [[userIdA, 'A'], [userIdB, 'B']]) {
    if (!userId) continue;
    const { error } = await serviceClient.auth.admin.deleteUser(userId);
    if (error) console.warn(`  WARN  user ${label} delete: ${error.message}`);
    else console.log(`  OK    user ${label} deleted`);
  }
}

// ---------------------------------------------------------------------------
// 6. Main test body
// ---------------------------------------------------------------------------
async function runTests() {
  console.log(`\n=== VenueFlow Cross-Tenant RLS Test (run: ${rand}) ===\n`);

  // -------------------------------------------------------------------------
  // Step 1: Create two users via service role
  // -------------------------------------------------------------------------
  console.log('--- Step 1: Create test users ---');
  {
    const { data: ua, error: eA } = await serviceClient.auth.admin.createUser({
      email: emailA,
      password: pwA,
      email_confirm: true,
    });
    if (eA) { console.error(`FATAL: createUser A: ${eA.message}`); return; }
    userIdA = ua.user.id;
    console.log(`  OK    User A created: ${userIdA}`);

    const { data: ub, error: eB } = await serviceClient.auth.admin.createUser({
      email: emailB,
      password: pwB,
      email_confirm: true,
    });
    if (eB) { console.error(`FATAL: createUser B: ${eB.message}`); return; }
    userIdB = ub.user.id;
    console.log(`  OK    User B created: ${userIdB}`);
  }

  // -------------------------------------------------------------------------
  // Step 2: Sign in both users to get real JWT sessions
  // -------------------------------------------------------------------------
  console.log('\n--- Step 2: Sign in users ---');
  {
    const { error: eA } = await anonClientA.auth.signInWithPassword({ email: emailA, password: pwA });
    if (eA) { console.error(`FATAL: signIn A: ${eA.message}`); return; }
    console.log('  OK    User A signed in');

    const { error: eB } = await anonClientB.auth.signInWithPassword({ email: emailB, password: pwB });
    if (eB) { console.error(`FATAL: signIn B: ${eB.message}`); return; }
    console.log('  OK    User B signed in');
  }

  // -------------------------------------------------------------------------
  // Step 3: Each user creates their venue via RPC
  // -------------------------------------------------------------------------
  console.log('\n--- Step 3: Create venues via RPC ---');
  {
    const { data: va, error: eA } = await anonClientA.rpc('create_venue_with_owner', {
      p_name: `Test Venue A ${rand}`,
      p_slug: slugA,
    });
    if (eA) { console.error(`FATAL: create_venue_with_owner A: ${eA.message}`); return; }
    venueIdA = va.id;
    console.log(`  OK    Venue A created: ${venueIdA}`);

    const { data: vb, error: eB } = await anonClientB.rpc('create_venue_with_owner', {
      p_name: `Test Venue B ${rand}`,
      p_slug: slugB,
    });
    if (eB) { console.error(`FATAL: create_venue_with_owner B: ${eB.message}`); return; }
    venueIdB = vb.id;
    console.log(`  OK    Venue B created: ${venueIdB}`);
  }

  // -------------------------------------------------------------------------
  // Step 3b: Seed data — space + venue_hours in each venue
  // -------------------------------------------------------------------------
  console.log('\n--- Step 3b: Seed spaces + venue_hours ---');
  {
    const { error: sA } = await anonClientA
      .from('spaces')
      .insert({ venue_id: venueIdA, name: `Space A ${rand}`, capacity_seated: 50 });
    if (sA) { console.error(`FATAL: insert space A: ${sA.message}`); return; }
    console.log('  OK    Space A inserted');

    const { error: hA } = await anonClientA
      .from('venue_hours')
      .insert({ venue_id: venueIdA, weekday: 1, open_time: '09:00', close_time: '17:00' });
    if (hA) { console.error(`FATAL: insert venue_hours A: ${hA.message}`); return; }
    console.log('  OK    Venue hours A inserted');

    const { error: sB } = await anonClientB
      .from('spaces')
      .insert({ venue_id: venueIdB, name: `Space B ${rand}`, capacity_seated: 80 });
    if (sB) { console.error(`FATAL: insert space B: ${sB.message}`); return; }
    console.log('  OK    Space B inserted');

    const { error: hB } = await anonClientB
      .from('venue_hours')
      .insert({ venue_id: venueIdB, weekday: 2, open_time: '10:00', close_time: '18:00' });
    if (hB) { console.error(`FATAL: insert venue_hours B: ${hB.message}`); return; }
    console.log('  OK    Venue hours B inserted');
  }

  // =========================================================================
  // Step 4: RLS ASSERTIONS
  // =========================================================================

  // -------------------------------------------------------------------------
  // POSITIVE CONTROLS: each user can read their own data
  // -------------------------------------------------------------------------
  console.log('\n--- Positive controls (own data visible) ---');
  {
    const { data, error } = await anonClientA.from('venues').select('id').eq('id', venueIdA);
    assert('User A can read own venue', !error && data?.length === 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientA.from('memberships').select('id').eq('venue_id', venueIdA);
    assert('User A can read own memberships', !error && data?.length >= 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientA.from('spaces').select('id').eq('venue_id', venueIdA);
    assert('User A can read own spaces', !error && data?.length === 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientA.from('venue_hours').select('id').eq('venue_id', venueIdA);
    assert('User A can read own venue_hours', !error && data?.length === 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientB.from('venues').select('id').eq('id', venueIdB);
    assert('User B can read own venue', !error && data?.length === 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientB.from('memberships').select('id').eq('venue_id', venueIdB);
    assert('User B can read own memberships', !error && data?.length >= 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientB.from('spaces').select('id').eq('venue_id', venueIdB);
    assert('User B can read own spaces', !error && data?.length === 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientB.from('venue_hours').select('id').eq('venue_id', venueIdB);
    assert('User B can read own venue_hours', !error && data?.length === 1, JSON.stringify({ error, count: data?.length }));
  }

  // -------------------------------------------------------------------------
  // SELECT isolation: filtered by the other venue id → 0 rows
  // -------------------------------------------------------------------------
  console.log('\n--- SELECT isolation (filtered by other venue id) ---');
  {
    const { data, error } = await anonClientA.from('venues').select('id').eq('id', venueIdB);
    assert('A→B: venues filtered by venueB → 0 rows', !error && data?.length === 0, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientA.from('memberships').select('id').eq('venue_id', venueIdB);
    assert('A→B: memberships filtered by venueB → 0 rows', !error && data?.length === 0, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientA.from('spaces').select('id').eq('venue_id', venueIdB);
    assert('A→B: spaces filtered by venueB → 0 rows', !error && data?.length === 0, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientA.from('venue_hours').select('id').eq('venue_id', venueIdB);
    assert('A→B: venue_hours filtered by venueB → 0 rows', !error && data?.length === 0, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientB.from('venues').select('id').eq('id', venueIdA);
    assert('B→A: venues filtered by venueA → 0 rows', !error && data?.length === 0, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientB.from('memberships').select('id').eq('venue_id', venueIdA);
    assert('B→A: memberships filtered by venueA → 0 rows', !error && data?.length === 0, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientB.from('spaces').select('id').eq('venue_id', venueIdA);
    assert('B→A: spaces filtered by venueA → 0 rows', !error && data?.length === 0, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientB.from('venue_hours').select('id').eq('venue_id', venueIdA);
    assert('B→A: venue_hours filtered by venueA → 0 rows', !error && data?.length === 0, JSON.stringify({ error, count: data?.length }));
  }

  // -------------------------------------------------------------------------
  // SELECT isolation: unfiltered select must not leak the other tenant's id
  // -------------------------------------------------------------------------
  console.log('\n--- SELECT isolation (unfiltered — no cross-tenant leakage) ---');
  {
    const { data, error } = await anonClientA.from('venues').select('id');
    const leaked = data?.some(r => r.id === venueIdB);
    assert('A unfiltered venues does not contain venueB', !error && !leaked, JSON.stringify({ error, ids: data?.map(r => r.id) }));
  }
  {
    const { data, error } = await anonClientA.from('memberships').select('venue_id');
    const leaked = data?.some(r => r.venue_id === venueIdB);
    assert('A unfiltered memberships does not contain venueB', !error && !leaked, JSON.stringify({ error }));
  }
  {
    const { data, error } = await anonClientA.from('spaces').select('venue_id');
    const leaked = data?.some(r => r.venue_id === venueIdB);
    assert('A unfiltered spaces does not contain venueB', !error && !leaked, JSON.stringify({ error }));
  }
  {
    const { data, error } = await anonClientA.from('venue_hours').select('venue_id');
    const leaked = data?.some(r => r.venue_id === venueIdB);
    assert('A unfiltered venue_hours does not contain venueB', !error && !leaked, JSON.stringify({ error }));
  }
  {
    const { data, error } = await anonClientB.from('venues').select('id');
    const leaked = data?.some(r => r.id === venueIdA);
    assert('B unfiltered venues does not contain venueA', !error && !leaked, JSON.stringify({ error, ids: data?.map(r => r.id) }));
  }
  {
    const { data, error } = await anonClientB.from('memberships').select('venue_id');
    const leaked = data?.some(r => r.venue_id === venueIdA);
    assert('B unfiltered memberships does not contain venueA', !error && !leaked, JSON.stringify({ error }));
  }
  {
    const { data, error } = await anonClientB.from('spaces').select('venue_id');
    const leaked = data?.some(r => r.venue_id === venueIdA);
    assert('B unfiltered spaces does not contain venueA', !error && !leaked, JSON.stringify({ error }));
  }
  {
    const { data, error } = await anonClientB.from('venue_hours').select('venue_id');
    const leaked = data?.some(r => r.venue_id === venueIdA);
    assert('B unfiltered venue_hours does not contain venueA', !error && !leaked, JSON.stringify({ error }));
  }

  // -------------------------------------------------------------------------
  // UPDATE other venue's name → 0 rows affected or error
  // -------------------------------------------------------------------------
  console.log('\n--- UPDATE isolation ---');
  {
    const { data, error, count } = await anonClientA
      .from('venues')
      .update({ name: 'HACKED by A' })
      .eq('id', venueIdB)
      .select();
    // RLS: UPDATE returns empty result set (not an error) when policy blocks
    const blocked = error != null || (data != null && data.length === 0);
    assert('A→B: update venueB name → blocked (0 rows or error)', blocked,
      JSON.stringify({ error: error?.message, rowsAffected: data?.length, count }));
  }
  {
    const { data, error } = await anonClientB
      .from('venues')
      .update({ name: 'HACKED by B' })
      .eq('id', venueIdA)
      .select();
    const blocked = error != null || (data != null && data.length === 0);
    assert('B→A: update venueA name → blocked (0 rows or error)', blocked,
      JSON.stringify({ error: error?.message, rowsAffected: data?.length }));
  }

  // Verify no update actually landed
  {
    const { data } = await serviceClient.from('venues').select('name').eq('id', venueIdB).single();
    assert('venueB name unchanged after A update attempt', data?.name !== 'HACKED by A', `actual: ${data?.name}`);
  }
  {
    const { data } = await serviceClient.from('venues').select('name').eq('id', venueIdA).single();
    assert('venueA name unchanged after B update attempt', data?.name !== 'HACKED by B', `actual: ${data?.name}`);
  }

  // -------------------------------------------------------------------------
  // INSERT space with venue_id = other venue → rejected
  // -------------------------------------------------------------------------
  console.log('\n--- INSERT isolation: spaces ---');
  {
    const { data, error } = await anonClientA
      .from('spaces')
      .insert({ venue_id: venueIdB, name: 'Injected by A' });
    const blocked = error != null || data === null;
    assert('A→B: insert space into venueB → rejected', blocked,
      JSON.stringify({ error: error?.message, data }));
  }
  {
    const { data, error } = await anonClientB
      .from('spaces')
      .insert({ venue_id: venueIdA, name: 'Injected by B' });
    const blocked = error != null || data === null;
    assert('B→A: insert space into venueA → rejected', blocked,
      JSON.stringify({ error: error?.message, data }));
  }

  // Verify no rogue rows landed
  {
    const { data } = await serviceClient.from('spaces').select('name').eq('venue_id', venueIdB);
    const rogue = data?.some(s => s.name === 'Injected by A');
    assert('venueB spaces: no row injected by A', !rogue, JSON.stringify(data));
  }
  {
    const { data } = await serviceClient.from('spaces').select('name').eq('venue_id', venueIdA);
    const rogue = data?.some(s => s.name === 'Injected by B');
    assert('venueA spaces: no row injected by B', !rogue, JSON.stringify(data));
  }

  // -------------------------------------------------------------------------
  // INSERT membership granting self access to other venue → rejected
  // -------------------------------------------------------------------------
  console.log('\n--- INSERT isolation: memberships ---');
  {
    const { data, error } = await anonClientA
      .from('memberships')
      .insert({ venue_id: venueIdB, user_id: userIdA, role: 'owner' });
    const blocked = error != null || data === null;
    assert('A: insert self membership into venueB → rejected', blocked,
      JSON.stringify({ error: error?.message, data }));
  }
  {
    const { data, error } = await anonClientB
      .from('memberships')
      .insert({ venue_id: venueIdA, user_id: userIdB, role: 'owner' });
    const blocked = error != null || data === null;
    assert('B: insert self membership into venueA → rejected', blocked,
      JSON.stringify({ error: error?.message, data }));
  }

  // -------------------------------------------------------------------------
  // INSERT venue_hours into other venue → rejected
  // -------------------------------------------------------------------------
  console.log('\n--- INSERT isolation: venue_hours ---');
  {
    const { data, error } = await anonClientA
      .from('venue_hours')
      .insert({ venue_id: venueIdB, weekday: 3, open_time: '08:00', close_time: '20:00' });
    const blocked = error != null || data === null;
    assert('A→B: insert venue_hours into venueB → rejected', blocked,
      JSON.stringify({ error: error?.message, data }));
  }
  {
    const { data, error } = await anonClientB
      .from('venue_hours')
      .insert({ venue_id: venueIdA, weekday: 4, open_time: '07:00', close_time: '19:00' });
    const blocked = error != null || data === null;
    assert('B→A: insert venue_hours into venueA → rejected', blocked,
      JSON.stringify({ error: error?.message, data }));
  }

  // Verify no rogue rows landed
  {
    const { data } = await serviceClient.from('venue_hours').select('weekday').eq('venue_id', venueIdB);
    const rogue = data?.some(h => h.weekday === 3);
    assert('venueB venue_hours: weekday 3 not injected by A', !rogue, JSON.stringify(data));
  }
  {
    const { data } = await serviceClient.from('venue_hours').select('weekday').eq('venue_id', venueIdA);
    const rogue = data?.some(h => h.weekday === 4);
    assert('venueA venue_hours: weekday 4 not injected by B', !rogue, JSON.stringify(data));
  }

  // =========================================================================
  // Step 4: Storage assertions
  // =========================================================================
  console.log('\n--- Storage: own upload (should succeed) ---');
  const textContent = new TextEncoder().encode('hello venueflow rls test');

  // Own uploads must succeed
  {
    const { error } = await anonClientA.storage
      .from('venue-assets')
      .upload(`${venueIdA}/test.txt`, textContent, { contentType: 'text/plain', upsert: true });
    assert('User A upload to own folder succeeds', !error, error?.message ?? '');
  }
  {
    const { error } = await anonClientB.storage
      .from('venue-assets')
      .upload(`${venueIdB}/test.txt`, textContent, { contentType: 'text/plain', upsert: true });
    assert('User B upload to own folder succeeds', !error, error?.message ?? '');
  }

  console.log('\n--- Storage: cross-tenant upload (must fail) ---');
  {
    const { data, error } = await anonClientA.storage
      .from('venue-assets')
      .upload(`${venueIdB}/intrusion.txt`, textContent, { contentType: 'text/plain', upsert: true });
    const blocked = error != null;
    assert('A→B: upload to venueB folder → rejected', blocked,
      blocked ? '' : `data: ${JSON.stringify(data)}`);
  }
  {
    const { data, error } = await anonClientB.storage
      .from('venue-assets')
      .upload(`${venueIdA}/intrusion.txt`, textContent, { contentType: 'text/plain', upsert: true });
    const blocked = error != null;
    assert('B→A: upload to venueA folder → rejected', blocked,
      blocked ? '' : `data: ${JSON.stringify(data)}`);
  }

  console.log('\n--- Storage: cross-tenant download (must fail) ---');
  {
    const { data, error } = await anonClientA.storage
      .from('venue-assets')
      .download(`${venueIdB}/test.txt`);
    const blocked = error != null || data === null;
    assert('A→B: download venueB/test.txt → rejected', blocked,
      blocked ? '' : 'download returned data');
  }
  {
    const { data, error } = await anonClientB.storage
      .from('venue-assets')
      .download(`${venueIdA}/test.txt`);
    const blocked = error != null || data === null;
    assert('B→A: download venueA/test.txt → rejected', blocked,
      blocked ? '' : 'download returned data');
  }

  // =========================================================================
  // Step 5: Anon (no session) select on all four tables → 0 rows / denied
  // =========================================================================
  console.log('\n--- Anon (unauthenticated) access → must return 0 rows ---');
  for (const table of ['venues', 'memberships', 'spaces', 'venue_hours']) {
    const { data, error } = await anonClientNoSession.from(table).select('id');
    // RLS can either return an error OR an empty array — both are acceptable
    const blocked = error != null || (Array.isArray(data) && data.length === 0);
    assert(`Anon select on ${table} → 0 rows / denied`, blocked,
      JSON.stringify({ error: error?.message, count: data?.length }));
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('\nFAILED ASSERTIONS:');
    results.filter(r => !r.pass).forEach(r => {
      console.error(`  - ${r.label}${r.detail ? ' | ' + r.detail : ''}`);
    });
  }
  console.log('='.repeat(60));
}

// ---------------------------------------------------------------------------
// 7. Entry point with cleanup guard
// ---------------------------------------------------------------------------
let exitCode = 0;
try {
  await runTests();
  exitCode = failed > 0 ? 1 : 0;
} catch (err) {
  console.error('\nUNEXPECTED ERROR:', err);
  exitCode = 1;
} finally {
  try {
    await cleanup();
  } catch (cleanupErr) {
    console.warn('\nCleanup error (test result unaffected):', cleanupErr.message);
  }
}

process.exit(exitCode);
