import { describe, it, expect } from "vitest";
import { buildIcs, type IcsEvent } from "./ical";

const NOW = new Date("2026-06-26T09:00:00.000Z");

describe("buildIcs", () => {
  it("wraps events in a VCALENDAR with CRLF lines", () => {
    const ics = buildIcs("Old Barn — Appointments", [], NOW);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("X-WR-CALNAME:Old Barn — Appointments");
  });

  it("renders a VEVENT with UTC stamps and confirmed status", () => {
    const events: IcsEvent[] = [
      {
        uid: "a1@venueflow",
        start: "2027-06-12T14:00:00.000Z",
        end: "2027-06-12T15:00:00.000Z",
        summary: "Olivia Bennett (viewing)",
        status: "booked",
      },
    ];
    const ics = buildIcs("Cal", events, NOW);
    expect(ics).toContain("UID:a1@venueflow");
    expect(ics).toContain("DTSTART:20270612T140000Z");
    expect(ics).toContain("DTEND:20270612T150000Z");
    expect(ics).toContain("DTSTAMP:20260626T090000Z");
    expect(ics).toContain("SUMMARY:Olivia Bennett (viewing)");
    expect(ics).toContain("STATUS:CONFIRMED");
  });

  it("maps cancelled status, omits DTEND when null, and escapes text", () => {
    const ics = buildIcs(
      "Cal",
      [{ uid: "x", start: "2027-01-01T10:00:00.000Z", end: null, summary: "Smith, Anna; tasting", status: "cancelled" }],
      NOW,
    );
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("SUMMARY:Smith\\, Anna\\; tasting");
    expect(ics).not.toContain("DTEND:");
  });
});
