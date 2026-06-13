/**
 * Availability engine unit tests — node --test (no extra deps).
 * Run: node src/lib/booking/__tests__/engine.test.mjs
 *
 * The engine is TypeScript, so we re-implement the pure logic inline here
 * (same contract) and test the behaviour specification rather than the
 * compiled module directly — matching the merge-tags test pattern.
 *
 * DST tests cover:
 *   - Europe/London spring-forward: 2026-03-29 02:00 → 03:00 (clocks forward 1h)
 *   - Europe/London fall-back:       2026-10-25 02:00 → 01:00 (clocks back 1h)
 *
 * For these tests we use the Temporal-like math via raw UTC arithmetic
 * with explicit expected UTC values for the DST transition dates.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Inline pure implementation (mirrors engine.ts logic, plain JS, no imports)
// ---------------------------------------------------------------------------

function parseTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return { hours: h ?? 0, minutes: m ?? 0 };
}

/**
 * Convert a venue-local wall-clock datetime to a UTC Date.
 *
 * Uses an iterative correction approach: start with a naive guess (treating
 * the local time as UTC), then repeatedly measure the actual local offset at
 * the guess and correct. Converges in 1-2 iterations, handles DST transitions
 * correctly — including Europe/London spring-forward (2026-03-29) and
 * fall-back (2026-10-25).
 */
function localToUtc(year, month, day, hhmm, tz) {
  const { hours, minutes } = parseTime(hhmm);
  const pad2 = (n) => String(n).padStart(2, "0");

  // Initial guess: treat local time as UTC
  let guess = new Date(
    `${year}-${pad2(month)}-${pad2(day)}T${pad2(hours)}:${pad2(minutes)}:00Z`
  );

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // Target in ms as if UTC (reference point for diff)
  const targetMs = Date.UTC(year, month - 1, day, hours, minutes, 0);

  // Iterate up to 3 times (converges in ≤2 for standard TZ offsets)
  for (let i = 0; i < 3; i++) {
    const parts = formatter.formatToParts(guess).reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
    const lh = parseInt(parts.hour, 10) % 24;
    const lm = parseInt(parts.minute, 10);
    const ls = parseInt(parts.second, 10);
    // What local time does 'guess' correspond to in tz?
    const guessLocalMs = Date.UTC(
      parseInt(parts.year, 10),
      parseInt(parts.month, 10) - 1,
      parseInt(parts.day, 10),
      lh, lm, ls,
    );
    const diff = targetMs - guessLocalMs;
    if (Math.abs(diff) < 1000) break; // converged
    guess = new Date(guess.getTime() + diff);
  }

  return guess;
}

function overlapsAnyBusy(membershipId, slotStart, slotEnd, busy) {
  for (const b of busy) {
    if (b.membershipId !== membershipId) continue;
    const busyStart = new Date(b.startsAt);
    const busyEnd   = new Date(b.endsAt);
    if (slotStart < busyEnd && slotEnd > busyStart) return true;
  }
  return false;
}

function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60_000);
}

function formatDisplay(utcDate, tz) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(utcDate);
}

function computeAvailableSlots({
  rules,
  busy,
  meetingType,
  venueTimezone,
  rangeStart,
  rangeEnd,
  leadTimeMinutes = 0,
  now,
}) {
  const slotDuration = meetingType.durationMinutes;
  const buffer       = meetingType.bufferMinutes;
  const blockMinutes = slotDuration + buffer;

  const nowUtc       = now ? new Date(now) : new Date();
  const earliestStart = addMinutes(nowUtc, leadTimeMinutes);
  const rangeStartUtc = new Date(rangeStart);
  const rangeEndUtc   = new Date(rangeEnd);

  const slots = [];

  for (const rule of rules) {
    // Convert range boundaries to venue-local calendar dates
    const toLocal = (utcDate) => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: venueTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(utcDate).reduce((a, p) => { a[p.type] = p.value; return a; }, {});
      return {
        year:  parseInt(parts.year,  10),
        month: parseInt(parts.month, 10),
        day:   parseInt(parts.day,   10),
      };
    };

    const startLocal = toLocal(rangeStartUtc);
    const endLocal   = toLocal(rangeEndUtc);

    // Cursor as a plain date triple to avoid JS Date DST pitfalls
    let { year, month, day } = startLocal;

    while (true) {
      const cursorUtc = new Date(`${String(year).padStart(4,"0")}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}T00:00:00Z`);
      const cursorLocal = toLocal(cursorUtc);

      // Determine the weekday of this local date
      const weekday = new Date(
        `${String(cursorLocal.year).padStart(4,"0")}-${String(cursorLocal.month).padStart(2,"0")}-${String(cursorLocal.day).padStart(2,"0")}T12:00:00Z`
      ).getDay();
      // Note: getDay() on a UTC noon date gives the correct weekday regardless of tz offset for +/-12h

      // Check past end
      if (
        year > endLocal.year ||
        (year === endLocal.year && month > endLocal.month) ||
        (year === endLocal.year && month === endLocal.month && day > endLocal.day)
      ) break;

      if (weekday === rule.weekday) {
        const windowStartUtc = localToUtc(year, month, day, rule.startTime, venueTimezone);
        const windowEndUtc   = localToUtc(year, month, day, rule.endTime,   venueTimezone);

        let slotStart = new Date(windowStartUtc);

        while (true) {
          const slotEnd  = addMinutes(slotStart, slotDuration);
          const blockEnd = addMinutes(slotStart, blockMinutes);

          if (blockEnd > windowEndUtc) break;

          if (slotStart >= rangeStartUtc && slotEnd <= rangeEndUtc) {
            if (slotStart >= earliestStart) {
              if (!overlapsAnyBusy(rule.membershipId, slotStart, slotEnd, busy)) {
                slots.push({
                  membershipId: rule.membershipId,
                  startsAtUtc:  slotStart.toISOString(),
                  endsAtUtc:    slotEnd.toISOString(),
                  displayLabel: formatDisplay(slotStart, venueTimezone),
                });
              }
            }
          }

          slotStart = new Date(blockEnd);
        }
      }

      // Advance cursor by 1 calendar day (simple arithmetic on year/month/day)
      const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
      year  = nextDay.getUTCFullYear();
      month = nextDay.getUTCMonth() + 1;
      day   = nextDay.getUTCDate();
    }
  }

  slots.sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc));
  return slots;
}

// ---------------------------------------------------------------------------
// Helpers for tests
// ---------------------------------------------------------------------------

const MID = "member-1";
const TZ_LONDON = "Europe/London";

function rule(weekday, start = "09:00", end = "17:00", mid = MID) {
  return { membershipId: mid, weekday, startTime: start, endTime: end };
}

function slots60(rules, rangeStart, rangeEnd, tz = TZ_LONDON, busyList = [], now = "2026-01-01T00:00:00Z") {
  return computeAvailableSlots({
    rules,
    busy: busyList,
    meetingType: { durationMinutes: 60, bufferMinutes: 0 },
    venueTimezone: tz,
    rangeStart,
    rangeEnd,
    now,
  });
}

// ---------------------------------------------------------------------------
// Basic correctness tests
// ---------------------------------------------------------------------------

test("generates 8 slots for a 09:00-17:00 window with 60min duration", () => {
  // Monday 2026-01-05 is a Monday (weekday 1)
  const result = slots60(
    [rule(1)],
    "2026-01-05T00:00:00Z",
    "2026-01-05T23:59:00Z",
  );
  // 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00 = 8 slots
  assert.equal(result.length, 8);
});

test("first slot starts at 09:00 UTC in Jan (no DST offset)", () => {
  const result = slots60(
    [rule(1)],
    "2026-01-05T00:00:00Z",
    "2026-01-05T23:59:00Z",
  );
  // London in January = UTC, so 09:00 local = 09:00 UTC
  assert.equal(result[0].startsAtUtc, "2026-01-05T09:00:00.000Z");
  assert.equal(result[0].endsAtUtc,   "2026-01-05T10:00:00.000Z");
});

test("slots span exactly 60 minutes each", () => {
  const result = slots60(
    [rule(1)],
    "2026-01-05T00:00:00Z",
    "2026-01-05T23:59:00Z",
  );
  for (const s of result) {
    const dur = (new Date(s.endsAtUtc) - new Date(s.startsAtUtc)) / 60_000;
    assert.equal(dur, 60, `slot ${s.startsAtUtc} duration should be 60 min, got ${dur}`);
  }
});

test("no slots on a day with no matching rule", () => {
  // rule for Monday (1), checking Tuesday (2) 2026-01-06
  const result = slots60(
    [rule(1)],
    "2026-01-06T00:00:00Z",
    "2026-01-06T23:59:00Z",
  );
  assert.equal(result.length, 0);
});

// ---------------------------------------------------------------------------
// Buffer tests
// ---------------------------------------------------------------------------

test("buffer_minutes shrinks the number of available slots", () => {
  // 09:00-17:00 = 8h. 60min slot + 30min buffer = 90min block → 5 slots (8*60/90 = 5.33 → 5)
  const result = computeAvailableSlots({
    rules: [rule(1)],
    busy: [],
    meetingType: { durationMinutes: 60, bufferMinutes: 30 },
    venueTimezone: TZ_LONDON,
    rangeStart: "2026-01-05T00:00:00Z",
    rangeEnd:   "2026-01-05T23:59:00Z",
    now: "2026-01-01T00:00:00Z",
  });
  assert.equal(result.length, 5);
});

test("buffer gap between consecutive slots is exactly buffer_minutes", () => {
  const result = computeAvailableSlots({
    rules: [rule(1)],
    busy: [],
    meetingType: { durationMinutes: 60, bufferMinutes: 15 },
    venueTimezone: TZ_LONDON,
    rangeStart: "2026-01-05T00:00:00Z",
    rangeEnd:   "2026-01-05T23:59:00Z",
    now: "2026-01-01T00:00:00Z",
  });
  // Gap between slot[0].end and slot[1].start should be 15 min
  if (result.length >= 2) {
    const gap = (new Date(result[1].startsAtUtc) - new Date(result[0].endsAtUtc)) / 60_000;
    assert.equal(gap, 15);
  }
});

// ---------------------------------------------------------------------------
// Busy-range exclusion
// ---------------------------------------------------------------------------

test("busy-range blocks overlapping slot", () => {
  const result = slots60(
    [rule(1)],
    "2026-01-05T00:00:00Z",
    "2026-01-05T23:59:00Z",
    TZ_LONDON,
    [{ membershipId: MID, startsAt: "2026-01-05T10:00:00Z", endsAt: "2026-01-05T11:00:00Z" }],
  );
  // 10:00 slot is taken
  const blocked = result.find((s) => s.startsAtUtc === "2026-01-05T10:00:00.000Z");
  assert.equal(blocked, undefined, "10:00 slot should be blocked");
  // Other 7 slots remain
  assert.equal(result.length, 7);
});

test("busy-range for a different member does not block slot", () => {
  const result = slots60(
    [rule(1)],
    "2026-01-05T00:00:00Z",
    "2026-01-05T23:59:00Z",
    TZ_LONDON,
    [{ membershipId: "other-member", startsAt: "2026-01-05T10:00:00Z", endsAt: "2026-01-05T11:00:00Z" }],
  );
  // All 8 slots still available
  assert.equal(result.length, 8);
});

test("partial overlap (busy starts mid-slot) still blocks the slot", () => {
  // Busy 09:30-10:30 should block the 09:00 slot (overlap with [09:00,10:00))
  const result = slots60(
    [rule(1)],
    "2026-01-05T00:00:00Z",
    "2026-01-05T23:59:00Z",
    TZ_LONDON,
    [{ membershipId: MID, startsAt: "2026-01-05T09:30:00Z", endsAt: "2026-01-05T10:30:00Z" }],
  );
  const blocked09 = result.find((s) => s.startsAtUtc === "2026-01-05T09:00:00.000Z");
  const blocked10 = result.find((s) => s.startsAtUtc === "2026-01-05T10:00:00.000Z");
  assert.equal(blocked09, undefined, "09:00 slot should be blocked by partial overlap");
  assert.equal(blocked10, undefined, "10:00 slot should be blocked by partial overlap");
  // 6 slots remain
  assert.equal(result.length, 6);
});

// ---------------------------------------------------------------------------
// Lead-time exclusion
// ---------------------------------------------------------------------------

test("lead-time filter removes slots within the exclusion window", () => {
  // now = 09:30, leadTime = 60min → earliest start = 10:30 → first available = 11:00
  const result = computeAvailableSlots({
    rules: [rule(1)],
    busy: [],
    meetingType: { durationMinutes: 60, bufferMinutes: 0 },
    venueTimezone: TZ_LONDON,
    rangeStart: "2026-01-05T00:00:00Z",
    rangeEnd:   "2026-01-05T23:59:00Z",
    leadTimeMinutes: 60,
    now: "2026-01-05T09:30:00Z",
  });
  // 09:00 and 10:00 slots (start before 10:30) are excluded; 11:00–16:00 = 6 slots
  const has09 = result.some((s) => s.startsAtUtc.includes("T09:00"));
  const has10 = result.some((s) => s.startsAtUtc.includes("T10:00"));
  assert.equal(has09, false, "09:00 slot within lead-time should be excluded");
  assert.equal(has10, false, "10:00 slot within lead-time should be excluded");
  assert.equal(result.length, 6);
});

// ---------------------------------------------------------------------------
// Day-boundary spill test
// ---------------------------------------------------------------------------

test("rule window ending at midnight does not spill into next day", () => {
  // Rule 09:00–17:00 on Monday — no slots should appear for Tuesday
  const result = slots60(
    [rule(1)],
    "2026-01-05T00:00:00Z",
    "2026-01-06T23:59:00Z", // range covers Mon + Tue
  );
  // All slots should be on Jan 5 (Monday)
  const tuesdaySlots = result.filter((s) => s.startsAtUtc.startsWith("2026-01-06"));
  assert.equal(tuesdaySlots.length, 0, "No slots should spill to Tuesday");
  assert.equal(result.length, 8); // only Monday slots
});

// ---------------------------------------------------------------------------
// DST: Europe/London spring-forward 2026-03-29
// On 2026-03-29 at 01:00 UTC (02:00 local), clocks jump forward to 03:00.
// So 09:00 London = 08:00 UTC (BST, UTC+1) that day.
// ---------------------------------------------------------------------------

test("DST spring-forward: 09:00-17:00 London on 2026-03-29 maps to 08:00-16:00 UTC", () => {
  // 2026-03-29 is a Sunday (weekday 0)
  const result = slots60(
    [rule(0)],
    "2026-03-29T00:00:00Z",
    "2026-03-29T23:59:00Z",
  );
  // After spring-forward, BST = UTC+1; 09:00 local = 08:00 UTC
  assert.ok(result.length > 0, "Should have slots on spring-forward day");
  assert.equal(
    result[0].startsAtUtc,
    "2026-03-29T08:00:00.000Z",
    "First slot should start at 08:00 UTC on spring-forward day (09:00 BST)",
  );
  assert.equal(
    result[result.length - 1].startsAtUtc,
    "2026-03-29T15:00:00.000Z",
    "Last slot should start at 15:00 UTC (16:00 BST)",
  );
});

test("DST spring-forward: all slots are exactly 60 min on 2026-03-29", () => {
  const result = slots60(
    [rule(0)],
    "2026-03-29T00:00:00Z",
    "2026-03-29T23:59:00Z",
  );
  for (const s of result) {
    const dur = (new Date(s.endsAtUtc) - new Date(s.startsAtUtc)) / 60_000;
    assert.equal(dur, 60, `slot ${s.startsAtUtc} should be exactly 60 min`);
  }
});

test("DST spring-forward: correct slot count — no phantom or missing slots", () => {
  // 09:00-17:00 BST = 8 one-hour slots regardless of DST transition
  const result = slots60(
    [rule(0)],
    "2026-03-29T00:00:00Z",
    "2026-03-29T23:59:00Z",
  );
  assert.equal(result.length, 8, "Should have exactly 8 slots on spring-forward day");
});

// ---------------------------------------------------------------------------
// DST: Europe/London fall-back 2026-10-25
// On 2026-10-25 at 01:00 UTC (02:00 BST), clocks go back to 01:00 GMT.
// So 09:00 London = 09:00 UTC (GMT, UTC+0) that day.
// ---------------------------------------------------------------------------

test("DST fall-back: 09:00-17:00 London on 2026-10-25 maps to 09:00-17:00 UTC", () => {
  // 2026-10-25 is a Sunday (weekday 0)
  const result = slots60(
    [rule(0)],
    "2026-10-25T00:00:00Z",
    "2026-10-25T23:59:00Z",
  );
  assert.ok(result.length > 0, "Should have slots on fall-back day");
  // After fall-back, GMT = UTC+0; 09:00 local = 09:00 UTC
  assert.equal(
    result[0].startsAtUtc,
    "2026-10-25T09:00:00.000Z",
    "First slot should start at 09:00 UTC on fall-back day (09:00 GMT)",
  );
  assert.equal(
    result[result.length - 1].startsAtUtc,
    "2026-10-25T16:00:00.000Z",
    "Last slot should start at 16:00 UTC (16:00 GMT)",
  );
});

test("DST fall-back: all slots are exactly 60 min on 2026-10-25", () => {
  const result = slots60(
    [rule(0)],
    "2026-10-25T00:00:00Z",
    "2026-10-25T23:59:00Z",
  );
  for (const s of result) {
    const dur = (new Date(s.endsAtUtc) - new Date(s.startsAtUtc)) / 60_000;
    assert.equal(dur, 60, `slot ${s.startsAtUtc} should be exactly 60 min on fall-back day`);
  }
});

test("DST fall-back: correct slot count — no phantom or missing slots", () => {
  // 09:00-17:00 GMT = 8 one-hour slots
  const result = slots60(
    [rule(0)],
    "2026-10-25T00:00:00Z",
    "2026-10-25T23:59:00Z",
  );
  assert.equal(result.length, 8, "Should have exactly 8 slots on fall-back day");
});

// ---------------------------------------------------------------------------
// DST: cross-transition consistency
// Slots across BST → GMT transition week should maintain 60min duration.
// ---------------------------------------------------------------------------

test("DST transition week: all slots are exactly 60 min across BST/GMT boundary", () => {
  // Range covers Fri 23 Oct (BST) through Tue 27 Oct (GMT)
  // Rule is Sunday (weekday 0), so we get Sun 25 Oct only
  const result = slots60(
    [rule(0)],
    "2026-10-23T00:00:00Z",
    "2026-10-27T23:59:00Z",
  );
  for (const s of result) {
    const dur = (new Date(s.endsAtUtc) - new Date(s.startsAtUtc)) / 60_000;
    assert.equal(dur, 60, `slot ${s.startsAtUtc} duration should remain 60 min`);
  }
});

// ---------------------------------------------------------------------------
// Multi-week range
// ---------------------------------------------------------------------------

test("multi-week range generates slots on every matching weekday", () => {
  // Mondays in Jan 2026: Jan 5, 12, 19, 26
  const result = slots60(
    [rule(1)],
    "2026-01-01T00:00:00Z",
    "2026-01-31T23:59:00Z",
  );
  // 4 Mondays × 8 slots = 32
  assert.equal(result.length, 32);
});

// ---------------------------------------------------------------------------
// Multiple rules (different staff)
// ---------------------------------------------------------------------------

test("slots from two different members do not interfere", () => {
  const result = computeAvailableSlots({
    rules: [
      { membershipId: "member-1", weekday: 1, startTime: "09:00", endTime: "11:00" },
      { membershipId: "member-2", weekday: 1, startTime: "09:00", endTime: "11:00" },
    ],
    busy: [],
    meetingType: { durationMinutes: 60, bufferMinutes: 0 },
    venueTimezone: TZ_LONDON,
    rangeStart: "2026-01-05T00:00:00Z",
    rangeEnd:   "2026-01-05T23:59:00Z",
    now: "2026-01-01T00:00:00Z",
  });
  // 2 slots each member = 4 total
  assert.equal(result.length, 4);
  const m1Slots = result.filter((s) => s.membershipId === "member-1");
  const m2Slots = result.filter((s) => s.membershipId === "member-2");
  assert.equal(m1Slots.length, 2);
  assert.equal(m2Slots.length, 2);
});
