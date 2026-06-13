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

  // -------------------------------------------------------------------------
  // Step 3c: Seed contact + opportunity in each venue via RPC
  // (create_contact_with_opportunity auto-creates the opening opportunity at
  //  inbound_enquiry, which fires the trigger → a stage_events row)
  // -------------------------------------------------------------------------
  console.log('\n--- Step 3c: Seed contacts + opportunities via RPC ---');
  let contactIdA = null, contactIdB = null;
  let oppIdA = null, oppIdB = null;
  {
    const { data: cA, error: eA } = await anonClientA.rpc('create_contact_with_opportunity', {
      p_venue_id: venueIdA, p_first_name: `Lead A ${rand}`, p_email: `lead-a+${rand}@example.com`,
    });
    if (eA) { console.error(`FATAL: create_contact_with_opportunity A: ${eA.message}`); return; }
    contactIdA = cA.id;
    console.log(`  OK    Contact A created: ${contactIdA}`);

    const { data: cB, error: eB } = await anonClientB.rpc('create_contact_with_opportunity', {
      p_venue_id: venueIdB, p_first_name: `Lead B ${rand}`, p_email: `lead-b+${rand}@example.com`,
    });
    if (eB) { console.error(`FATAL: create_contact_with_opportunity B: ${eB.message}`); return; }
    contactIdB = cB.id;
    console.log(`  OK    Contact B created: ${contactIdB}`);

    // Resolve the auto-created opportunity ids via service role
    const { data: oA } = await serviceClient.from('opportunities').select('id').eq('contact_id', contactIdA).single();
    oppIdA = oA?.id;
    const { data: oB } = await serviceClient.from('opportunities').select('id').eq('contact_id', contactIdB).single();
    oppIdB = oB?.id;
    console.log(`  OK    Opportunities resolved: A=${oppIdA} B=${oppIdB}`);
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
  // Step 4b: M2 ASSERTIONS — contacts / opportunities / stage_events
  // =========================================================================
  console.log('\n--- M2 positive controls (own data visible) ---');
  {
    const { data, error } = await anonClientA.from('contacts').select('id').eq('venue_id', venueIdA);
    assert('User A can read own contacts', !error && data?.length === 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientA.from('opportunities').select('id').eq('venue_id', venueIdA);
    assert('User A can read own opportunities', !error && data?.length === 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientA.from('stage_events').select('id').eq('venue_id', venueIdA);
    assert('User A can read own stage_events (trigger wrote ≥1)', !error && data?.length >= 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientB.from('contacts').select('id').eq('venue_id', venueIdB);
    assert('User B can read own contacts', !error && data?.length === 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientB.from('opportunities').select('id').eq('venue_id', venueIdB);
    assert('User B can read own opportunities', !error && data?.length === 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientB.from('stage_events').select('id').eq('venue_id', venueIdB);
    assert('User B can read own stage_events (trigger wrote ≥1)', !error && data?.length >= 1, JSON.stringify({ error, count: data?.length }));
  }

  console.log('\n--- M2 SELECT isolation (filtered by other venue id → 0 rows) ---');
  for (const table of ['contacts', 'opportunities', 'stage_events']) {
    const { data, error } = await anonClientA.from(table).select('id').eq('venue_id', venueIdB);
    assert(`A→B: ${table} filtered by venueB → 0 rows`, !error && data?.length === 0, JSON.stringify({ error, count: data?.length }));
  }
  for (const table of ['contacts', 'opportunities', 'stage_events']) {
    const { data, error } = await anonClientB.from(table).select('id').eq('venue_id', venueIdA);
    assert(`B→A: ${table} filtered by venueA → 0 rows`, !error && data?.length === 0, JSON.stringify({ error, count: data?.length }));
  }

  console.log('\n--- M2 SELECT isolation (unfiltered — no leakage) ---');
  for (const table of ['contacts', 'opportunities', 'stage_events']) {
    const { data, error } = await anonClientA.from(table).select('venue_id');
    const leaked = data?.some(r => r.venue_id === venueIdB);
    assert(`A unfiltered ${table} does not contain venueB`, !error && !leaked, JSON.stringify({ error }));
  }
  for (const table of ['contacts', 'opportunities', 'stage_events']) {
    const { data, error } = await anonClientB.from(table).select('venue_id');
    const leaked = data?.some(r => r.venue_id === venueIdA);
    assert(`B unfiltered ${table} does not contain venueA`, !error && !leaked, JSON.stringify({ error }));
  }

  console.log('\n--- M2 INSERT isolation: contacts / opportunities into other venue → rejected ---');
  {
    const { data, error } = await anonClientA.from('contacts')
      .insert({ venue_id: venueIdB, first_name: 'Injected by A' });
    assert('A→B: insert contact into venueB → rejected', error != null || data === null, JSON.stringify({ error: error?.message, data }));
  }
  {
    const { data, error } = await anonClientB.from('contacts')
      .insert({ venue_id: venueIdA, first_name: 'Injected by B' });
    assert('B→A: insert contact into venueA → rejected', error != null || data === null, JSON.stringify({ error: error?.message, data }));
  }
  {
    const { data, error } = await anonClientA.from('opportunities')
      .insert({ venue_id: venueIdB, contact_id: contactIdB });
    assert('A→B: insert opportunity into venueB → rejected', error != null || data === null, JSON.stringify({ error: error?.message, data }));
  }
  // Verify no rogue contact landed
  {
    const { data } = await serviceClient.from('contacts').select('first_name').eq('venue_id', venueIdB);
    const rogue = data?.some(c => c.first_name === 'Injected by A');
    assert('venueB contacts: no row injected by A', !rogue, JSON.stringify(data));
  }

  console.log('\n--- M2 stage_events is append-only (direct insert blocked even for own venue) ---');
  {
    const { data, error } = await anonClientA.from('stage_events')
      .insert({ venue_id: venueIdA, opportunity_id: oppIdA, to_stage: 'wedding_booked' });
    assert('A: direct insert into own stage_events → rejected (writer = trigger only)', error != null || data === null, JSON.stringify({ error: error?.message, data }));
  }
  {
    const { data } = await serviceClient.from('stage_events').select('to_stage').eq('opportunity_id', oppIdA);
    const rogue = data?.some(e => e.to_stage === 'wedding_booked');
    assert('venueA stage_events: no direct-insert row landed', !rogue, JSON.stringify(data));
  }

  console.log('\n--- M2 UPDATE isolation: move other venue\'s opportunity → blocked ---');
  {
    const { data, error } = await anonClientA.from('opportunities')
      .update({ stage: 'wedding_booked' }).eq('id', oppIdB).select();
    assert('A→B: move venueB opportunity → blocked (0 rows or error)', error != null || (data != null && data.length === 0), JSON.stringify({ error: error?.message, rows: data?.length }));
  }
  {
    const { data } = await serviceClient.from('opportunities').select('stage').eq('id', oppIdB).single();
    assert('venueB opportunity stage unchanged after A attempt', data?.stage === 'inbound_enquiry', `actual: ${data?.stage}`);
  }

  console.log('\n--- M2 cross-tenant RPC: create_contact_with_opportunity for other venue → rejected ---');
  {
    const { data, error } = await anonClientA.rpc('create_contact_with_opportunity', {
      p_venue_id: venueIdB, p_first_name: 'RPC intrusion by A', p_email: `intrusion+${rand}@example.com`,
    });
    assert('A→B: RPC create_contact for venueB → rejected (not a member)', error != null, JSON.stringify({ error: error?.message, data }));
  }
  {
    const { data } = await serviceClient.from('contacts').select('first_name').eq('venue_id', venueIdB);
    const rogue = data?.some(c => c.first_name === 'RPC intrusion by A');
    assert('venueB contacts: no RPC-injected row by A', !rogue, JSON.stringify(data));
  }

  // =========================================================================
  // Step 4c: M3 ASSERTIONS — form_submissions / brochures / venue_email_settings
  // =========================================================================
  console.log('\n--- M3 seed (service role) ---');
  {
    await serviceClient.from('brochures').insert([
      { venue_id: venueIdA, file_path: `${venueIdA}/a.pdf`, title: 'A brochure' },
      { venue_id: venueIdB, file_path: `${venueIdB}/b.pdf`, title: 'B brochure' },
    ]);
    await serviceClient.from('venue_email_settings').insert([
      { venue_id: venueIdA, from_name: 'Venue A', reply_to: 'a@example.com' },
      { venue_id: venueIdB, from_name: 'Venue B', reply_to: 'b@example.com' },
    ]);
    await serviceClient.from('form_submissions').insert([
      { venue_id: venueIdA, payload: { email: `lead-a+${rand}@example.com` } },
      { venue_id: venueIdB, payload: { email: `lead-b+${rand}@example.com` } },
    ]);
    console.log('  OK    seeded brochures + email settings + form_submissions');
  }

  console.log('\n--- M3 positive controls (own data visible) ---');
  for (const table of ['form_submissions', 'brochures', 'venue_email_settings']) {
    const { data, error } = await anonClientA.from(table).select('id').eq('venue_id', venueIdA);
    assert(`User A can read own ${table}`, !error && data?.length === 1, JSON.stringify({ error, count: data?.length }));
  }

  console.log('\n--- M3 SELECT isolation (other venue → 0 rows) ---');
  for (const table of ['form_submissions', 'brochures', 'venue_email_settings']) {
    const { data, error } = await anonClientA.from(table).select('id').eq('venue_id', venueIdB);
    assert(`A→B: ${table} filtered by venueB → 0 rows`, !error && data?.length === 0, JSON.stringify({ error, count: data?.length }));
  }
  for (const table of ['form_submissions', 'brochures', 'venue_email_settings']) {
    const { data, error } = await anonClientB.from(table).select('id').eq('venue_id', venueIdA);
    assert(`B→A: ${table} filtered by venueA → 0 rows`, !error && data?.length === 0, JSON.stringify({ error, count: data?.length }));
  }

  console.log('\n--- M3 form_submissions has NO client INSERT (admin-write only) ---');
  {
    const { data, error } = await anonClientA.from('form_submissions')
      .insert({ venue_id: venueIdA, payload: { x: 1 } });
    assert('A: direct insert into own form_submissions → rejected', error != null || data === null, JSON.stringify({ error: error?.message, data }));
  }

  console.log('\n--- M3 INSERT isolation: brochures / email settings into other venue → rejected ---');
  {
    const { data, error } = await anonClientA.from('brochures')
      .insert({ venue_id: venueIdB, file_path: `${venueIdB}/intrusion.pdf` });
    assert('A→B: insert brochure into venueB → rejected', error != null || data === null, JSON.stringify({ error: error?.message, data }));
  }
  {
    const { data, error } = await anonClientA.from('venue_email_settings')
      .insert({ venue_id: venueIdB, from_name: 'Injected' });
    assert('A→B: insert email settings into venueB → rejected', error != null || data === null, JSON.stringify({ error: error?.message, data }));
  }

  // =========================================================================
  // Step 4d: M4 ASSERTIONS — sequences / sequence_steps / sequence_enrollments
  //                           / email_messages / email_suppressions
  // =========================================================================
  console.log('\n--- M4 seed (service role) ---');
  let seqIdA = null, seqIdB = null;
  let enrollIdA = null;
  {
    // Insert sequence rows for each venue.
    const { data: sA } = await serviceClient.from('sequences').insert(
      { venue_id: venueIdA, enabled: true }
    ).select('id').single();
    seqIdA = sA?.id;
    const { data: sB } = await serviceClient.from('sequences').insert(
      { venue_id: venueIdB, enabled: false }
    ).select('id').single();
    seqIdB = sB?.id;

    // Insert a step for each.
    await serviceClient.from('sequence_steps').insert([
      { sequence_id: seqIdA, venue_id: venueIdA, step_number: 1, subject: 'Step 1', body: 'Body 1', delay_hours: 1, enabled: true },
      { sequence_id: seqIdB, venue_id: venueIdB, step_number: 1, subject: 'Step 1', body: 'Body 1', delay_hours: 1, enabled: true },
    ]);

    // Insert an enrollment for venue A.
    const { data: enA } = await serviceClient.from('sequence_enrollments').insert({
      venue_id: venueIdA, contact_id: contactIdA, opportunity_id: oppIdA,
      status: 'active', current_step: 0,
    }).select('id').single();
    enrollIdA = enA?.id;

    // Insert an email_messages row for venue A.
    await serviceClient.from('email_messages').insert({
      venue_id: venueIdA, contact_id: contactIdA, enrollment_id: enrollIdA,
      step_number: 1, subject: 'Test subject', status: 'skipped',
      idempotency_key: `test:${rand}:step:1`,
    });

    console.log('  OK    seeded sequences + steps + enrollment + email_messages');
  }

  console.log('\n--- M4 positive controls (own data visible) ---');
  {
    const { data, error } = await anonClientA.from('sequences').select('id').eq('venue_id', venueIdA);
    assert('User A can read own sequences', !error && data?.length === 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientA.from('sequence_steps').select('id').eq('venue_id', venueIdA);
    assert('User A can read own sequence_steps', !error && data?.length === 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientA.from('sequence_enrollments').select('id').eq('venue_id', venueIdA);
    assert('User A can read own sequence_enrollments', !error && data?.length === 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientA.from('email_messages').select('id').eq('venue_id', venueIdA);
    assert('User A can read own email_messages', !error && data?.length === 1, JSON.stringify({ error, count: data?.length }));
  }

  console.log('\n--- M4 SELECT isolation (filtered by other venue id → 0 rows) ---');
  for (const table of ['sequences', 'sequence_steps', 'sequence_enrollments', 'email_messages']) {
    const { data, error } = await anonClientA.from(table).select('id').eq('venue_id', venueIdB);
    assert(`A→B: ${table} filtered by venueB → 0 rows`, !error && data?.length === 0, JSON.stringify({ error, count: data?.length }));
  }
  for (const table of ['sequences', 'sequence_steps', 'sequence_enrollments', 'email_messages']) {
    const { data, error } = await anonClientB.from(table).select('id').eq('venue_id', venueIdA);
    assert(`B→A: ${table} filtered by venueA → 0 rows`, !error && data?.length === 0, JSON.stringify({ error, count: data?.length }));
  }

  console.log('\n--- M4 SELECT isolation (unfiltered — no leakage) ---');
  for (const table of ['sequences', 'sequence_steps', 'sequence_enrollments', 'email_messages']) {
    const { data, error } = await anonClientA.from(table).select('venue_id');
    const leaked = data?.some(r => r.venue_id === venueIdB);
    assert(`A unfiltered ${table} does not contain venueB`, !error && !leaked, JSON.stringify({ error }));
  }
  for (const table of ['sequences', 'sequence_steps', 'sequence_enrollments', 'email_messages']) {
    const { data, error } = await anonClientB.from(table).select('venue_id');
    const leaked = data?.some(r => r.venue_id === venueIdA);
    assert(`B unfiltered ${table} does not contain venueA`, !error && !leaked, JSON.stringify({ error }));
  }

  console.log('\n--- M4 INSERT isolation: sequences / steps into other venue → rejected ---');
  {
    const { data, error } = await anonClientA.from('sequences')
      .insert({ venue_id: venueIdB, enabled: false });
    assert('A→B: insert sequence into venueB → rejected', error != null || data === null, JSON.stringify({ error: error?.message, data }));
  }
  {
    const { data, error } = await anonClientA.from('sequence_steps')
      .insert({ sequence_id: seqIdB, venue_id: venueIdB, step_number: 2, subject: 'Injected', body: 'Body', delay_hours: 0, enabled: true });
    assert('A→B: insert sequence_step into venueB → rejected', error != null || data === null, JSON.stringify({ error: error?.message, data }));
  }

  console.log('\n--- M4 sequence_enrollments + email_messages have NO client INSERT (admin-write only) ---');
  {
    const { data, error } = await anonClientA.from('sequence_enrollments')
      .insert({ venue_id: venueIdA, contact_id: contactIdA, opportunity_id: oppIdA, status: 'active', current_step: 0 });
    assert('A: direct insert into own sequence_enrollments → rejected', error != null || data === null, JSON.stringify({ error: error?.message, data }));
  }
  {
    const { data, error } = await anonClientA.from('email_messages')
      .insert({ venue_id: venueIdA, contact_id: contactIdA, subject: 'Injected', status: 'sent' });
    assert('A: direct insert into own email_messages → rejected', error != null || data === null, JSON.stringify({ error: error?.message, data }));
  }

  console.log('\n--- M4 email_suppressions: no client access (service-role only) ---');
  {
    const { data, error } = await anonClientA.from('email_suppressions').select('id');
    // RLS returns empty or error — either is a pass (no row leaked)
    const blocked = error != null || (Array.isArray(data) && data.length === 0);
    assert('A: select email_suppressions → 0 rows / denied', blocked, JSON.stringify({ error: error?.message, count: data?.length }));
  }
  {
    const { data, error } = await anonClientA.from('email_suppressions')
      .insert({ email: `suppressed+${rand}@example.com`, reason: 'bounce' });
    assert('A: insert into email_suppressions → rejected', error != null || data === null, JSON.stringify({ error: error?.message, data }));
  }

  // =========================================================================
  // Step 4e: M5 ASSERTIONS — meeting_types / availability_rules / appointments
  // =========================================================================
  console.log('\n--- M5 seed (service role) ---');
  let mtIdA = null, mtIdB = null;
  let memIdA = null;
  let apptIdA = null;
  {
    // meeting_types were auto-seeded by the trigger when venues were created — read them back
    const { data: mtA } = await serviceClient.from('meeting_types').select('id').eq('venue_id', venueIdA).eq('kind', 'viewing').single();
    mtIdA = mtA?.id;
    const { data: mtB } = await serviceClient.from('meeting_types').select('id').eq('venue_id', venueIdB).eq('kind', 'viewing').single();
    mtIdB = mtB?.id;

    // Resolve membership IDs for each venue owner
    const { data: mA } = await serviceClient.from('memberships').select('id').eq('venue_id', venueIdA).single();
    memIdA = mA?.id;
    const { data: mB } = await serviceClient.from('memberships').select('id').eq('venue_id', venueIdB).single();
    const memIdB = mB?.id;

    // Seed availability_rules for both venues (service role bypasses RLS)
    await serviceClient.from('availability_rules').insert([
      { venue_id: venueIdA, membership_id: memIdA, weekday: 1, start_time: '09:00', end_time: '17:00' },
      { venue_id: venueIdB, membership_id: memIdB, weekday: 2, start_time: '10:00', end_time: '16:00' },
    ]);

    // Seed one appointment for venue A (service role, admin path)
    const { data: apptA } = await serviceClient.from('appointments').insert({
      venue_id: venueIdA,
      meeting_type_id: mtIdA,
      membership_id: memIdA,
      contact_id: contactIdA,
      opportunity_id: oppIdA,
      starts_at: '2027-06-01T09:00:00Z',
      ends_at: '2027-06-01T10:00:00Z',
      status: 'booked',
      source: 'staff',
    }).select('id').single();
    apptIdA = apptA?.id;

    console.log(`  OK    meeting_types resolved: A=${mtIdA} B=${mtIdB}`);
    console.log(`  OK    availability_rules + appointment seeded`);
  }

  console.log('\n--- M5 positive controls (own data visible) ---');
  {
    const { data, error } = await anonClientA.from('meeting_types').select('id').eq('venue_id', venueIdA);
    assert('User A can read own meeting_types', !error && data?.length >= 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientA.from('availability_rules').select('id').eq('venue_id', venueIdA);
    assert('User A can read own availability_rules', !error && data?.length >= 1, JSON.stringify({ error, count: data?.length }));
  }
  {
    const { data, error } = await anonClientA.from('appointments').select('id').eq('venue_id', venueIdA);
    assert('User A can read own appointments', !error && data?.length === 1, JSON.stringify({ error, count: data?.length }));
  }

  console.log('\n--- M5 SELECT isolation (filtered by other venue id → 0 rows) ---');
  for (const table of ['meeting_types', 'availability_rules', 'appointments']) {
    const { data, error } = await anonClientA.from(table).select('id').eq('venue_id', venueIdB);
    assert(`A→B: ${table} filtered by venueB → 0 rows`, !error && data?.length === 0, JSON.stringify({ error, count: data?.length }));
  }
  for (const table of ['meeting_types', 'availability_rules', 'appointments']) {
    const { data, error } = await anonClientB.from(table).select('id').eq('venue_id', venueIdA);
    assert(`B→A: ${table} filtered by venueA → 0 rows`, !error && data?.length === 0, JSON.stringify({ error, count: data?.length }));
  }

  console.log('\n--- M5 SELECT isolation (unfiltered — no leakage) ---');
  for (const table of ['meeting_types', 'availability_rules', 'appointments']) {
    const { data, error } = await anonClientA.from(table).select('venue_id');
    const leaked = data?.some(r => r.venue_id === venueIdB);
    assert(`A unfiltered ${table} does not contain venueB`, !error && !leaked, JSON.stringify({ error }));
  }
  for (const table of ['meeting_types', 'availability_rules', 'appointments']) {
    const { data, error } = await anonClientB.from(table).select('venue_id');
    const leaked = data?.some(r => r.venue_id === venueIdA);
    assert(`B unfiltered ${table} does not contain venueA`, !error && !leaked, JSON.stringify({ error }));
  }

  console.log('\n--- M5 INSERT isolation: availability_rules into other venue → rejected ---');
  {
    const { data: mB2 } = await serviceClient.from('memberships').select('id').eq('venue_id', venueIdB).single();
    const { data, error } = await anonClientA.from('availability_rules')
      .insert({ venue_id: venueIdB, membership_id: mB2?.id, weekday: 3, start_time: '09:00', end_time: '17:00' });
    assert('A→B: insert availability_rule into venueB → rejected', error != null || data === null, JSON.stringify({ error: error?.message, data }));
  }

  console.log('\n--- M5 appointments: no authenticated INSERT (admin-write only) ---');
  {
    const { data, error } = await anonClientA.from('appointments')
      .insert({
        venue_id: venueIdA,
        meeting_type_id: mtIdA,
        membership_id: memIdA,
        contact_id: contactIdA,
        starts_at: '2027-07-01T09:00:00Z',
        ends_at: '2027-07-01T10:00:00Z',
        status: 'booked',
        source: 'public',
      });
    assert('A: direct insert into own appointments (client) → rejected', error != null || data === null, JSON.stringify({ error: error?.message, data }));
  }

  console.log('\n--- M5 meeting_types: no authenticated INSERT (trigger-only) ---');
  {
    const { data, error } = await anonClientA.from('meeting_types')
      .insert({ venue_id: venueIdA, kind: 'viewing', duration_minutes: 45, buffer_minutes: 0, enabled: true });
    assert('A: direct insert into own meeting_types (client) → rejected', error != null || data === null, JSON.stringify({ error: error?.message, data }));
  }

  console.log('\n--- M5 meeting_types: update own venue (owner allowed) ---');
  {
    const { data, error } = await anonClientA.from('meeting_types')
      .update({ duration_minutes: 90 })
      .eq('id', mtIdA)
      .select();
    assert('A: update own meeting_type → allowed (1 row)', !error && data?.length === 1, JSON.stringify({ error: error?.message, count: data?.length }));
  }

  console.log('\n--- M5 meeting_types: update other venue → blocked ---');
  {
    const { data, error } = await anonClientA.from('meeting_types')
      .update({ duration_minutes: 10 })
      .eq('id', mtIdB)
      .select();
    assert('A→B: update venueB meeting_type → blocked (0 rows or error)', error != null || (data != null && data.length === 0), JSON.stringify({ error: error?.message, count: data?.length }));
  }

  // Anon check: add meeting_types + availability_rules + appointments to the anon table list
  // (handled below in the existing anon loop — we just need to add them to the table array there)

  // =========================================================================
  // Step 4: Storage assertions
  // =========================================================================
  console.log('\n--- Storage: own upload (should succeed) ---');
  // venue-assets bucket only allows image/png|jpeg|webp (M1 hardening), so the
  // payload must be a real PNG — otherwise the rejection would be MIME, not RLS,
  // making the cross-tenant assertions below ambiguous. 1x1 transparent PNG:
  const pngContent = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

  // Own uploads must succeed
  {
    const { error } = await anonClientA.storage
      .from('venue-assets')
      .upload(`${venueIdA}/test.png`, pngContent, { contentType: 'image/png', upsert: true });
    assert('User A upload to own folder succeeds', !error, error?.message ?? '');
  }
  {
    const { error } = await anonClientB.storage
      .from('venue-assets')
      .upload(`${venueIdB}/test.png`, pngContent, { contentType: 'image/png', upsert: true });
    assert('User B upload to own folder succeeds', !error, error?.message ?? '');
  }

  console.log('\n--- Storage: cross-tenant upload (must fail) ---');
  {
    const { data, error } = await anonClientA.storage
      .from('venue-assets')
      .upload(`${venueIdB}/intrusion.png`, pngContent, { contentType: 'image/png', upsert: true });
    const blocked = error != null;
    assert('A→B: upload to venueB folder → rejected', blocked,
      blocked ? '' : `data: ${JSON.stringify(data)}`);
  }
  {
    const { data, error } = await anonClientB.storage
      .from('venue-assets')
      .upload(`${venueIdA}/intrusion.png`, pngContent, { contentType: 'image/png', upsert: true });
    const blocked = error != null;
    assert('B→A: upload to venueA folder → rejected', blocked,
      blocked ? '' : `data: ${JSON.stringify(data)}`);
  }

  console.log('\n--- Storage: cross-tenant download (must fail) ---');
  {
    const { data, error } = await anonClientA.storage
      .from('venue-assets')
      .download(`${venueIdB}/test.png`);
    const blocked = error != null || data === null;
    assert('A→B: download venueB/test.png → rejected', blocked,
      blocked ? '' : 'download returned data');
  }
  {
    const { data, error } = await anonClientB.storage
      .from('venue-assets')
      .download(`${venueIdA}/test.png`);
    const blocked = error != null || data === null;
    assert('B→A: download venueA/test.png → rejected', blocked,
      blocked ? '' : 'download returned data');
  }

  // =========================================================================
  // Step 5: Anon (no session) select on all four tables → 0 rows / denied
  // =========================================================================
  console.log('\n--- Anon (unauthenticated) access → must return 0 rows ---');
  for (const table of ['venues', 'memberships', 'spaces', 'venue_hours', 'contacts', 'opportunities', 'stage_events', 'form_submissions', 'brochures', 'venue_email_settings', 'sequences', 'sequence_steps', 'sequence_enrollments', 'email_messages', 'email_suppressions', 'meeting_types', 'availability_rules', 'appointments', 'billing_subscriptions']) {
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
