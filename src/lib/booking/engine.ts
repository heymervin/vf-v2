/**
 * Pure availability engine — no database, no side effects.
 *
 * All internal math is UTC. Availability rules are expressed as weekday +
 * local-time window (e.g. "Monday 09:00–17:00 Europe/London"); each concrete
 * date in the requested range is projected to UTC using the venue timezone.
 * This is where DST lives: a 09:00 local start on a day _after_ UK spring-
 * forward emits a different UTC instant than the same rule on a day _before_.
 *
 * Output: an array of BookableSlot — each slot carries both the raw UTC ISO
 * string (what the DB stores) and a display string in the venue timezone (what
 * the UI shows).
 */

import { toZonedTime, fromZonedTime, format as formatTZ } from "date-fns-tz";
import { addMinutes } from "date-fns";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AvailabilityRule {
  membershipId: string;
  /** 0 = Sunday … 6 = Saturday (same as JS Date.getDay()) */
  weekday: number;
  /** "HH:mm" in venue local time */
  startTime: string;
  /** "HH:mm" in venue local time */
  endTime: string;
}

export interface BusyRange {
  membershipId: string;
  /** UTC ISO string */
  startsAt: string;
  /** UTC ISO string */
  endsAt: string;
}

export interface MeetingTypeTiming {
  durationMinutes: number;
  bufferMinutes: number;
}

export interface EngineInput {
  rules: AvailabilityRule[];
  busy: BusyRange[];
  meetingType: MeetingTypeTiming;
  venueTimezone: string;
  /** Inclusive, UTC ISO */
  rangeStart: string;
  /** Inclusive, UTC ISO */
  rangeEnd: string;
  /**
   * Minimum minutes from now before a slot may be offered.
   * Defaults to 0 (no lead-time filter).
   */
  leadTimeMinutes?: number;
  /**
   * The "now" reference instant (UTC ISO). Defaults to new Date().
   * Injectable for deterministic tests.
   */
  now?: string;
}

export interface BookableSlot {
  membershipId: string;
  /** UTC ISO — what goes in appointments.starts_at */
  startsAtUtc: string;
  /** UTC ISO — what goes in appointments.ends_at */
  endsAtUtc: string;
  /** Formatted for display in the venue timezone, e.g. "Mon 13 Jan · 09:00" */
  displayLabel: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse "HH:mm" → { hours, minutes }.
 */
function parseTime(hhmm: string): { hours: number; minutes: number } {
  const [h, m] = hhmm.split(":").map(Number);
  return { hours: h ?? 0, minutes: m ?? 0 };
}

/**
 * Given a concrete local date (year/month/day) in the venue timezone and a
 * "HH:mm" local time string, return the corresponding UTC Date.
 *
 * fromZonedTime interprets the wall-clock datetime as being in venueTimezone
 * and converts it to UTC, handling DST transitions correctly.
 */
function localToUtc(
  year: number,
  month: number, // 1-based
  day: number,
  hhmm: string,
  venueTimezone: string,
): Date {
  const { hours, minutes } = parseTime(hhmm);
  // Construct a local-time string that fromZonedTime can interpret.
  const localStr = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  return fromZonedTime(localStr, venueTimezone);
}

/**
 * Returns true if the candidate slot [slotStart, slotEnd) overlaps with any
 * busy range for the same membership. Uses half-open interval semantics:
 * [busyStart, busyEnd) — a slot ending exactly when another starts is fine.
 */
function overlapsAnyBusy(
  membershipId: string,
  slotStart: Date,
  slotEnd: Date,
  busy: BusyRange[],
): boolean {
  for (const b of busy) {
    if (b.membershipId !== membershipId) continue;
    const busyStart = new Date(b.startsAt);
    const busyEnd = new Date(b.endsAt);
    // Overlap: slot starts before busy ends AND slot ends after busy starts
    if (slotStart < busyEnd && slotEnd > busyStart) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

export function computeAvailableSlots(input: EngineInput): BookableSlot[] {
  const {
    rules,
    busy,
    meetingType,
    venueTimezone,
    rangeStart,
    rangeEnd,
    leadTimeMinutes = 0,
    now,
  } = input;

  const slotDuration = meetingType.durationMinutes;
  const buffer = meetingType.bufferMinutes;
  // Effective block per slot = duration + buffer (buffer is dead time after)
  const blockMinutes = slotDuration + buffer;

  const nowUtc = now ? new Date(now) : new Date();
  const earliestStart = addMinutes(nowUtc, leadTimeMinutes);

  const rangeStartUtc = new Date(rangeStart);
  const rangeEndUtc = new Date(rangeEnd);

  const slots: BookableSlot[] = [];

  // Iterate each rule
  for (const rule of rules) {
    // Walk each concrete date in the UTC range
    // We iterate in venue-local days to correctly handle day boundaries.
    // Start: the first venue-local day that falls on or after rangeStartUtc.
    const localRangeStart = toZonedTime(rangeStartUtc, venueTimezone);
    const localRangeEnd = toZonedTime(rangeEndUtc, venueTimezone);

    // Build a date cursor at midnight of the venue-local rangeStart day
    const cursorDate = new Date(
      localRangeStart.getFullYear(),
      localRangeStart.getMonth(),
      localRangeStart.getDate(),
    );
    const endDate = new Date(
      localRangeEnd.getFullYear(),
      localRangeEnd.getMonth(),
      localRangeEnd.getDate(),
    );

    while (cursorDate <= endDate) {
      const year = cursorDate.getFullYear();
      const month = cursorDate.getMonth() + 1; // 1-based for localToUtc
      const day = cursorDate.getDate();

      // JS getDay(): 0=Sun, 6=Sat — matches our weekday convention
      const localWeekday = cursorDate.getDay();

      if (localWeekday === rule.weekday) {
        // Convert rule window to UTC for this concrete date
        const windowStartUtc = localToUtc(year, month, day, rule.startTime, venueTimezone);
        const windowEndUtc = localToUtc(year, month, day, rule.endTime, venueTimezone);

        // Generate slots within the window
        let slotStart = new Date(windowStartUtc);

        while (true) {
          const slotEnd = addMinutes(slotStart, slotDuration);
          const blockEnd = addMinutes(slotStart, blockMinutes);

          // Stop if the slot (including buffer) would exceed the window
          if (blockEnd > windowEndUtc) break;

          // Skip if outside the requested range
          if (slotStart >= rangeStartUtc && slotEnd <= rangeEndUtc) {
            // Lead-time filter
            if (slotStart >= earliestStart) {
              // Busy-range exclusion
              if (!overlapsAnyBusy(rule.membershipId, slotStart, slotEnd, busy)) {
                // Format for display in venue timezone
                const localSlotStart = toZonedTime(slotStart, venueTimezone);
                const displayLabel = formatTZ(
                  localSlotStart,
                  "EEE d MMM · HH:mm",
                  { timeZone: venueTimezone },
                );

                slots.push({
                  membershipId: rule.membershipId,
                  startsAtUtc: slotStart.toISOString(),
                  endsAtUtc: slotEnd.toISOString(),
                  displayLabel,
                });
              }
            }
          }

          // Advance by block (slot + buffer)
          slotStart = new Date(blockEnd);
        }
      }

      // Advance cursor by 1 local day
      cursorDate.setDate(cursorDate.getDate() + 1);
    }
  }

  // Sort chronologically
  slots.sort((a, b) => a.startsAtUtc.localeCompare(b.startsAtUtc));

  return slots;
}
