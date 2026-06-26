// Pure iCalendar builder — no secrets, no DB; safe to unit-test. Token helpers
// (which read the HMAC secret) live in ./ical-token (server-only).

export interface IcsEvent {
  /** Globally-unique id (e.g. `${appointmentId}@venueflow`). */
  uid: string;
  /** ISO start timestamp. */
  start: string;
  /** ISO end timestamp, or null. */
  end: string | null;
  summary: string;
  /** Raw appointment status (cancelled → CANCELLED, else CONFIRMED). */
  status?: string;
}

/** ISO → iCalendar UTC stamp (`20270612T140000Z`). */
function toIcsUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Escape iCalendar text per RFC 5545 (backslash, semicolon, comma, newline). */
function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Build a VCALENDAR string (CRLF-joined) from a list of events. */
export function buildIcs(calName: string, events: IcsEvent[], now = new Date()): string {
  const stamp = toIcsUtc(now.toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VenueFlow//Appointments//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(calName)}`,
  ];
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp}`, `DTSTART:${toIcsUtc(e.start)}`);
    if (e.end) lines.push(`DTEND:${toIcsUtc(e.end)}`);
    lines.push(`SUMMARY:${icsEscape(e.summary)}`);
    if (e.status) lines.push(`STATUS:${e.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
