/**
 * booking-race.mjs
 * VenueFlow — Double-booking race condition test
 * Run: node scripts/booking-race.mjs
 *
 * Fires 2 concurrent INSERT attempts for the same staff member + time slot
 * via the service-role client. Asserts that:
 *   - Exactly one succeeds (HTTP 201 / no error)
 *   - The other fails with SQLSTATE 23P01 (exclusion_violation)
 *
 * The EXCLUDE USING gist constraint on appointments is the guard being tested.
 * Self-cleaning: deletes all test data after the run.
 * Exit code 0 = assertion passed (exactly-one-wins).
 * Exit code 1 = assertion failed or fatal setup error.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';

// ---------------------------------------------------------------------------
// 1. Load .env.local
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
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnv(new URL('../.env.local', import.meta.url).pathname);

const SUPABASE_URL     = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('FAIL: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------------------------------------------------------------------------
// 2. Test state — all IDs tracked for cleanup
// ---------------------------------------------------------------------------
const rand = Math.random().toString(36).slice(2, 8);
let venueId = null;
let membershipId = null;
let meetingTypeId = null;
let contactId = null;
let userId = null;

// ---------------------------------------------------------------------------
// 3. Cleanup
// ---------------------------------------------------------------------------
async function cleanup() {
  console.log('\n--- Cleanup ---');

  // Delete appointments for this test venue (cascade wouldn't reach manage_token uniqueness)
  if (venueId) {
    const { error } = await admin.from('appointments').delete().eq('venue_id', venueId);
    if (error) console.warn('  WARN  appointments delete:', error.message);
    else console.log('  OK    appointments deleted');

    // Delete contact
    await admin.from('contacts').delete().eq('venue_id', venueId);
    console.log('  OK    contacts deleted');

    // Delete meeting_types (cascade via venue delete, but being explicit)
    const { error: vErr } = await admin.from('venues').delete().eq('id', venueId);
    if (vErr) console.warn('  WARN  venue delete:', vErr.message);
    else console.log('  OK    venue deleted (cascades memberships, meeting_types)');
  }

  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.warn('  WARN  user delete:', error.message);
    else console.log('  OK    user deleted');
  }
}

// ---------------------------------------------------------------------------
// 4. Setup: venue, staff user, membership, meeting type, contact
// ---------------------------------------------------------------------------
async function setup() {
  console.log(`\n=== Booking Race Condition Test (run: ${rand}) ===\n`);
  console.log('--- Setup ---');

  // Create a test user
  const email = `race-${rand}@venueflow.io`;
  const { data: userData, error: uErr } = await admin.auth.admin.createUser({
    email,
    password: `RaceTest${rand}!1`,
    email_confirm: true,
  });
  if (uErr) { console.error('FATAL: createUser:', uErr.message); return false; }
  userId = userData.user.id;
  console.log(`  OK    User created: ${userId}`);

  // Create venue
  const { data: venue, error: vErr } = await admin
    .from('venues')
    .insert({ name: `Race Test Venue ${rand}`, slug: `race-${rand}`, timezone: 'Europe/London' })
    .select('id')
    .single();
  if (vErr) { console.error('FATAL: venue insert:', vErr.message); return false; }
  venueId = venue.id;
  console.log(`  OK    Venue created: ${venueId}`);

  // Create membership
  const { data: mem, error: mErr } = await admin
    .from('memberships')
    .insert({ venue_id: venueId, user_id: userId, role: 'owner' })
    .select('id')
    .single();
  if (mErr) { console.error('FATAL: membership insert:', mErr.message); return false; }
  membershipId = mem.id;
  console.log(`  OK    Membership created: ${membershipId}`);

  // Get the auto-seeded meeting type (viewing, 60 min) for this venue
  const { data: mt, error: mtErr } = await admin
    .from('meeting_types')
    .select('id')
    .eq('venue_id', venueId)
    .eq('kind', 'viewing')
    .single();
  if (mtErr || !mt) { console.error('FATAL: meeting_type not found (seed trigger may not have run):', mtErr?.message); return false; }
  meetingTypeId = mt.id;
  console.log(`  OK    Meeting type (viewing): ${meetingTypeId}`);

  // Create a contact
  const { data: contact, error: cErr } = await admin
    .from('contacts')
    .insert({ venue_id: venueId, first_name: `Race Contact ${rand}`, email: `couple-${rand}@example.com` })
    .select('id')
    .single();
  if (cErr) { console.error('FATAL: contact insert:', cErr.message); return false; }
  contactId = contact.id;
  console.log(`  OK    Contact created: ${contactId}`);

  return true;
}

// ---------------------------------------------------------------------------
// 5. Race test
// ---------------------------------------------------------------------------
async function runRace() {
  console.log('\n--- Race Test ---');
  console.log('  Firing 2 concurrent inserts for same staff + slot...');

  // Fixed slot: 2027-03-15 10:00-11:00 UTC (well in the future)
  const startsAt = '2027-03-15T10:00:00.000Z';
  const endsAt   = '2027-03-15T11:00:00.000Z';

  const insertPayload = {
    venue_id: venueId,
    meeting_type_id: meetingTypeId,
    membership_id: membershipId,
    contact_id: contactId,
    starts_at: startsAt,
    ends_at: endsAt,
    status: 'booked',
    source: 'staff',
  };

  // Fire both concurrently
  const [result1, result2] = await Promise.allSettled([
    admin.from('appointments').insert(insertPayload).select('id').single(),
    admin.from('appointments').insert(insertPayload).select('id').single(),
  ]);

  // Classify outcomes
  let successes = 0;
  let exclusionViolations = 0;
  const outcomes = [];

  for (const [i, result] of [result1, result2].entries()) {
    if (result.status === 'rejected') {
      outcomes.push({ n: i + 1, ok: false, reason: `Promise rejected: ${result.reason}` });
      continue;
    }
    const { data, error } = result.value;
    if (error) {
      // 23P01 = exclusion_violation (Postgres SQLSTATE)
      if (error.code === '23P01') {
        exclusionViolations++;
        outcomes.push({ n: i + 1, ok: false, code: error.code, reason: error.message });
        console.log(`  INSERT ${i + 1}: BLOCKED (23P01 exclusion_violation) — ${error.message}`);
      } else {
        outcomes.push({ n: i + 1, ok: false, code: error.code, reason: error.message });
        console.log(`  INSERT ${i + 1}: ERROR (unexpected code ${error.code}) — ${error.message}`);
      }
    } else {
      successes++;
      outcomes.push({ n: i + 1, ok: true, id: data?.id });
      console.log(`  INSERT ${i + 1}: SUCCESS — appointment ${data?.id}`);
    }
  }

  console.log(`\n  Results: ${successes} succeeded, ${exclusionViolations} blocked by EXCLUDE`);

  // The assertion: exactly one wins, exactly one loses with 23P01
  const passed = successes === 1 && exclusionViolations === 1;

  if (passed) {
    console.log('\n  PASS  Exactly one insert won, one was blocked by the EXCLUDE constraint.');
    console.log('  PASS  Double-booking guard confirmed working.');
  } else {
    console.error(`\n  FAIL  Expected 1 success + 1 exclusion_violation.`);
    console.error(`        Got: successes=${successes}, exclusionViolations=${exclusionViolations}`);
    for (const o of outcomes) {
      console.error(`        INSERT ${o.n}:`, JSON.stringify(o));
    }
  }

  return passed;
}

// ---------------------------------------------------------------------------
// 6. Reschedule atomicity test
//
// Scenario: customer has booking A. A third party concurrently books the
// same slot the customer wants to reschedule to. The reschedule_appointment
// RPC must:
//   - Leave booking A still 'booked' (not cancelled)
//   - Return a 23P01 error (not silently succeed)
// ---------------------------------------------------------------------------
async function runRescheduleAtomicityTest() {
  console.log('\n--- Reschedule Atomicity Test ---');
  console.log('  Scenario: reschedule into a slot that gets taken mid-flight...');

  const slotA = { starts: '2027-04-10T09:00:00.000Z', ends: '2027-04-10T10:00:00.000Z' };
  const slotB = { starts: '2027-04-10T11:00:00.000Z', ends: '2027-04-10T12:00:00.000Z' };
  // slotC is the target for both the reschedule and a concurrent booking
  const slotC = { starts: '2027-04-10T13:00:00.000Z', ends: '2027-04-10T14:00:00.000Z' };

  // Create a second contact for the concurrent booking
  const { data: contact2, error: c2Err } = await admin
    .from('contacts')
    .insert({ venue_id: venueId, first_name: `Race Contact2 ${rand}`, email: `couple2-${rand}@example.com` })
    .select('id')
    .single();
  if (c2Err || !contact2) {
    console.error('  FATAL: contact2 insert:', c2Err?.message);
    return false;
  }

  // Step 1: Create the customer's existing booking (slotA)
  const { data: existingAppt, error: eaErr } = await admin
    .from('appointments')
    .insert({
      venue_id: venueId,
      meeting_type_id: meetingTypeId,
      membership_id: membershipId,
      contact_id: contactId,
      starts_at: slotA.starts,
      ends_at: slotA.ends,
      status: 'booked',
      source: 'staff',
    })
    .select('id, manage_token')
    .single();

  if (eaErr || !existingAppt) {
    console.error('  FATAL: existing appointment insert:', eaErr?.message);
    return false;
  }
  console.log(`  OK    Customer booking created: ${existingAppt.id} (slotA)`);

  // Step 2: Concurrently book slotC directly (simulating another customer
  // taking the target slot just before our reschedule RPC fires).
  const { data: blocker, error: blErr } = await admin
    .from('appointments')
    .insert({
      venue_id: venueId,
      meeting_type_id: meetingTypeId,
      membership_id: membershipId,
      contact_id: contact2.id,
      starts_at: slotC.starts,
      ends_at: slotC.ends,
      status: 'booked',
      source: 'staff',
    })
    .select('id')
    .single();

  if (blErr || !blocker) {
    console.error('  FATAL: blocker appointment insert:', blErr?.message);
    return false;
  }
  console.log(`  OK    Concurrent booking on slotC: ${blocker.id}`);

  // Step 3: Call reschedule_appointment RPC targeting slotC (which is now taken).
  //         Expect 23P01 → transaction should roll back, original booking preserved.
  const { data: newToken, error: rpcErr } = await admin.rpc('reschedule_appointment', {
    p_manage_token: existingAppt.manage_token,
    p_starts_at:    slotC.starts,
    p_ends_at:      slotC.ends,
  });

  let testPassed = false;

  if (rpcErr) {
    if (rpcErr.code === '23P01') {
      console.log(`  OK    RPC returned 23P01 (exclusion_violation) as expected`);

      // Verify the original booking is still 'booked'
      const { data: original } = await admin
        .from('appointments')
        .select('status')
        .eq('id', existingAppt.id)
        .single();

      if (original?.status === 'booked') {
        console.log('  OK    Original booking status: booked (preserved — tx rolled back)');
        testPassed = true;
      } else {
        console.error(`  FAIL  Original booking status: ${original?.status} (expected booked)`);
      }
    } else {
      console.error(`  FAIL  RPC returned unexpected error code ${rpcErr.code}: ${rpcErr.message}`);
    }
  } else {
    console.error(`  FAIL  RPC succeeded (returned token ${newToken}) but slotC was taken — EXCLUDE did not fire`);

    // Check original booking — it may have been wrongly cancelled
    const { data: original } = await admin
      .from('appointments')
      .select('status')
      .eq('id', existingAppt.id)
      .single();
    console.error(`  INFO  Original booking status: ${original?.status}`);
  }

  if (testPassed) {
    console.log('\n  PASS  Reschedule into taken slot preserved original booking (atomic rollback confirmed).');
  } else {
    console.error('\n  FAIL  Reschedule atomicity test failed — see above.');
  }

  // Cleanup: remove the test appointments (venue cascade handles them in main cleanup,
  // but delete explicitly so they don't interfere with the EXCLUDE check in runRace).
  await admin.from('appointments').delete().eq('id', existingAppt.id);
  await admin.from('appointments').delete().eq('id', blocker.id);
  await admin.from('contacts').delete().eq('id', contact2.id);

  return testPassed;
}

// ---------------------------------------------------------------------------
// 7. Main
// ---------------------------------------------------------------------------
let racePassed = false;
let atomicPassed = false;
try {
  const ok = await setup();
  if (ok) {
    racePassed   = await runRace();
    atomicPassed = await runRescheduleAtomicityTest();
  }
} finally {
  await cleanup();
}

const passed = racePassed && atomicPassed;
console.log('\n' + (passed ? '=== PASS ===' : '=== FAIL ==='));
process.exit(passed ? 0 : 1);
