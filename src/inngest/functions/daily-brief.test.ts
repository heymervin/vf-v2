/**
 * Unit tests for src/inngest/functions/daily-brief.ts
 *
 * Covers:
 *   1. Happy path — fetches all venues with email settings, aggregates data
 *      per venue, and calls sendEmail once per eligible venue.
 *   2. No GHL credentials for a venue → skips GHL data, still sends brief
 *      with VF2-only data.
 *   3. Venue with no email settings is skipped entirely.
 *   4. GHL failure for one venue does not abort the others.
 *   5. sendEmail failure for one venue does not abort the others.
 *
 * All tests are DB-free and secret-free:
 *   - "server-only" is mocked to a no-op.
 *   - @/lib/supabase/admin is mocked.
 *   - @/lib/ghl/client is mocked (ghlClient factory).
 *   - @/lib/email/send is mocked.
 *   - @/lib/email/templates/daily-brief-email is mocked.
 *   - @/inngest/client is mocked with a factory helper.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── constants ───────────────────────────────────────────────────────────────────

const VENUE_A_ID = "venue-uuid-a001";
const VENUE_B_ID = "venue-uuid-b002";

// ── mock state ──────────────────────────────────────────────────────────────────

// Which venues exist (with email settings)
let mockVenues: Array<{
  id: string;
  name: string;
  timezone: string;
}> = [
  { id: VENUE_A_ID, name: "The Grand Hall", timezone: "Europe/London" },
  { id: VENUE_B_ID, name: "Sunny Barn", timezone: "America/New_York" },
];

// email settings keyed by venue_id — null means no row (skip venue)
let mockEmailSettings: Record<
  string,
  { from_name: string | null; reply_to: string | null } | null
> = {
  [VENUE_A_ID]: { from_name: "The Grand Hall", reply_to: "venue@grand.com" },
  [VENUE_B_ID]: { from_name: "Sunny Barn", reply_to: "hello@sunny.com" },
};

// GHL pipeline counts per venue (null means ghlClient returns null)
let mockGhlNull: Record<string, boolean> = {
  [VENUE_A_ID]: false,
  [VENUE_B_ID]: false,
};

let mockPipelineCounts: Record<
  string,
  Array<{ pipelineStageId: string; count: number; totalValue: number }>
> = {
  [VENUE_A_ID]: [
    { pipelineStageId: "stage-1", count: 5, totalValue: 50000 },
  ],
  [VENUE_B_ID]: [
    { pipelineStageId: "stage-2", count: 3, totalValue: 30000 },
  ],
};

// Controls if getPipelineCounts throws
let mockGhlThrows: Record<string, boolean> = {
  [VENUE_A_ID]: false,
  [VENUE_B_ID]: false,
};

// Recent contacts count per venue
let mockContactCounts: Record<string, number> = {
  [VENUE_A_ID]: 7,
  [VENUE_B_ID]: 2,
};

// Upcoming tasks per venue
let mockUpcomingTasks: Record<
  string,
  Array<{ id: string; title: string; due_date: string | null }>
> = {
  [VENUE_A_ID]: [{ id: "task-1", title: "Send menu", due_date: "2026-06-20" }],
  [VENUE_B_ID]: [],
};

// Portal logins per venue (couple_accounts with recent last_login_at)
let mockRecentLogins: Record<string, number> = {
  [VENUE_A_ID]: 3,
  [VENUE_B_ID]: 0,
};

// Upcoming payment milestones per venue
let mockUpcomingPayments: Record<
  string,
  Array<{ id: string; label: string; due_date: string; amount_minor: number }>
> = {
  [VENUE_A_ID]: [
    { id: "pm-1", label: "Deposit", due_date: "2026-06-25", amount_minor: 100000 },
  ],
  [VENUE_B_ID]: [],
};

// sendEmail spy
const sendEmailSpy = vi.fn().mockResolvedValue({ ok: true, id: "email-id-001" });

// ── mocks ───────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/ghl/client", () => ({
  ghlClient: async (venueId: string) => {
    if (mockGhlNull[venueId]) return null;
    return {
      getPipelineCounts: async () => {
        if (mockGhlThrows[venueId]) throw new Error("GHL API error 500");
        return mockPipelineCounts[venueId] ?? [];
      },
    };
  },
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: sendEmailSpy,
}));

vi.mock("@/lib/email/templates/daily-brief-email", () => ({
  DailyBriefEmail: (props: unknown) => props,
}));

// ── Supabase admin mock ─────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "venues") {
        return {
          select: (_cols: string) => ({
            data: mockVenues,
            error: null,
          }),
        };
      }

      if (table === "venue_email_settings") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, venueId: string) => ({
              maybeSingle: async () => ({
                data: mockEmailSettings[venueId] ?? null,
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "contacts") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, venueId: string) => ({
              gte: (_col2: string, _val: string) => ({
                data: Array.from({ length: mockContactCounts[venueId] ?? 0 }, (_, i) => ({
                  id: `contact-${i}`,
                })),
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "wedding_tasks") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, venueId: string) => ({
              eq: (_col2: string, _val: boolean) => ({
                lte: (_col3: string, _val: string) => ({
                  data: mockUpcomingTasks[venueId] ?? [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "couple_accounts") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, venueId: string) => ({
              gte: (_col2: string, _val: string) => ({
                data: Array.from({ length: mockRecentLogins[venueId] ?? 0 }, (_, i) => ({
                  id: `ca-${i}`,
                  last_login_at: "2026-06-18T10:00:00Z",
                })),
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === "payment_milestones") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, venueId: string) => ({
              in: (_col2: string, _vals: string[]) => ({
                lte: (_col3: string, _val: string) => ({
                  data: mockUpcomingPayments[venueId] ?? [],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      // Default
      return {
        select: () => ({
          eq: () => ({
            data: [],
            error: null,
          }),
        }),
      };
    },
  }),
}));

// ── Inngest test harness ────────────────────────────────────────────────────────

function makeStepHarness() {
  return {
    run: async <T>(_name: string, fn: () => Promise<T>): Promise<T> => fn(),
  };
}

let capturedHandler:
  | ((ctx: {
      step: ReturnType<typeof makeStepHarness>;
    }) => Promise<unknown>)
  | null = null;

vi.mock("@/inngest/client", () => ({
  inngest: {
    createFunction: (
      _config: unknown,
      handler: (ctx: {
        step: ReturnType<typeof makeStepHarness>;
      }) => Promise<unknown>,
    ) => {
      capturedHandler = handler;
      return { id: "daily-brief" };
    },
  },
}));

// ── import (triggers createFunction + handler capture) ──────────────────────────

beforeEach(async () => {
  // Reset all mock state
  mockVenues = [
    { id: VENUE_A_ID, name: "The Grand Hall", timezone: "Europe/London" },
    { id: VENUE_B_ID, name: "Sunny Barn", timezone: "America/New_York" },
  ];
  mockEmailSettings = {
    [VENUE_A_ID]: { from_name: "The Grand Hall", reply_to: "venue@grand.com" },
    [VENUE_B_ID]: { from_name: "Sunny Barn", reply_to: "hello@sunny.com" },
  };
  mockGhlNull = { [VENUE_A_ID]: false, [VENUE_B_ID]: false };
  mockPipelineCounts = {
    [VENUE_A_ID]: [{ pipelineStageId: "stage-1", count: 5, totalValue: 50000 }],
    [VENUE_B_ID]: [{ pipelineStageId: "stage-2", count: 3, totalValue: 30000 }],
  };
  mockGhlThrows = { [VENUE_A_ID]: false, [VENUE_B_ID]: false };
  mockContactCounts = { [VENUE_A_ID]: 7, [VENUE_B_ID]: 2 };
  mockUpcomingTasks = {
    [VENUE_A_ID]: [{ id: "task-1", title: "Send menu", due_date: "2026-06-20" }],
    [VENUE_B_ID]: [],
  };
  mockRecentLogins = { [VENUE_A_ID]: 3, [VENUE_B_ID]: 0 };
  mockUpcomingPayments = {
    [VENUE_A_ID]: [
      {
        id: "pm-1",
        label: "Deposit",
        due_date: "2026-06-25",
        amount_minor: 100000,
      },
    ],
    [VENUE_B_ID]: [],
  };

  sendEmailSpy.mockClear();
  sendEmailSpy.mockResolvedValue({ ok: true, id: "email-id-001" });

  vi.resetModules();
  capturedHandler = null;
  await import("./daily-brief");
});

// ── helper to invoke the handler ────────────────────────────────────────────────

async function runHandler() {
  if (!capturedHandler) throw new Error("handler not captured — check mock order");
  return capturedHandler({ step: makeStepHarness() });
}

// ── tests ───────────────────────────────────────────────────────────────────────

describe("dailyBrief Inngest function", () => {
  // ── happy path ───────────────────────────────────────────────────────────────

  it("calls sendEmail once per eligible venue (2 venues → 2 sends)", async () => {
    await runHandler();
    expect(sendEmailSpy).toHaveBeenCalledTimes(2);
  });

  it("sends the brief to the venue reply_to address when available", async () => {
    await runHandler();

    const calls = sendEmailSpy.mock.calls as Array<
      [{ to: string; subject: string; fromName?: string | null; replyTo?: string | null }]
    >;

    // Verify that both venues got their email — addresses are from_name reply_to
    const recipients = calls.map((c) => c[0].to);
    expect(recipients).toContain("venue@grand.com");
    expect(recipients).toContain("hello@sunny.com");
  });

  it("returns a summary with sentCount equal to the number of eligible venues", async () => {
    const result = await runHandler() as { sentCount: number; skippedCount: number };
    expect(result.sentCount).toBe(2);
    expect(result.skippedCount).toBe(0);
  });

  // ── no GHL credentials ───────────────────────────────────────────────────────

  it("still sends brief when a venue has no GHL credentials (pipeline section omitted)", async () => {
    mockGhlNull[VENUE_A_ID] = true;

    await runHandler();

    // Email should still be sent for venue A (just without GHL data)
    expect(sendEmailSpy).toHaveBeenCalledTimes(2);
  });

  // ── venue without email settings is skipped ───────────────────────────────────

  it("skips a venue that has no email settings row", async () => {
    // Remove email settings for venue B
    mockEmailSettings[VENUE_B_ID] = null;

    const result = await runHandler() as { sentCount: number; skippedCount: number };

    // Only venue A should get an email
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    const call = sendEmailSpy.mock.calls[0][0] as { to: string };
    expect(call.to).toBe("venue@grand.com");

    expect(result.sentCount).toBe(1);
    expect(result.skippedCount).toBe(1);
  });

  // ── GHL failure for one venue does not abort others ───────────────────────────

  it("continues sending to other venues when GHL throws for one venue", async () => {
    mockGhlThrows[VENUE_A_ID] = true;

    const result = await runHandler() as { sentCount: number; skippedCount: number };

    // Both emails should still be sent (GHL error caught gracefully)
    expect(sendEmailSpy).toHaveBeenCalledTimes(2);
    expect(result.sentCount).toBe(2);
  });

  // ── sendEmail failure for one venue does not abort others ─────────────────────

  it("continues processing remaining venues when sendEmail fails for one", async () => {
    // Make email fail for the first call (venue A) but succeed for venue B
    sendEmailSpy
      .mockResolvedValueOnce({ ok: false, error: "Send failed." })
      .mockResolvedValueOnce({ ok: true, id: "email-id-002" });

    const result = await runHandler() as { sentCount: number; skippedCount: number };

    expect(sendEmailSpy).toHaveBeenCalledTimes(2);
    // Both counted as "sent" attempts — the function runs for both venues
    // (failure doesn't throw, just logs)
    expect(result.sentCount + result.skippedCount).toBe(2);
  });

  // ── no venues at all ─────────────────────────────────────────────────────────

  it("returns sentCount=0 when there are no venues", async () => {
    mockVenues = [];

    const result = await runHandler() as { sentCount: number; skippedCount: number };

    expect(sendEmailSpy).not.toHaveBeenCalled();
    expect(result.sentCount).toBe(0);
    expect(result.skippedCount).toBe(0);
  });
});
