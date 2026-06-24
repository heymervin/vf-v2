/**
 * Unit tests for src/lib/reports/daily-brief.ts
 *
 * Covers:
 *   1. Happy path — all data present, GHL connected → brief assembled and sent.
 *   2. GHL null (not connected) → brief still sent with pipeline = null (graceful degrade).
 *   3. GHL getPipelineAggregate throws → brief still sent (error caught, pipeline = null).
 *   4. No owner membership → step skips gracefully, no email sent.
 *   5. Owner auth user has no email → step skips gracefully.
 *   6. Multiple venues → one brief sent per venue.
 *   7. Email payload — correct subject, pipeline null passed through, portalActivity count correct.
 *
 * All tests are DB-free and secret-free:
 *   - "server-only" is mocked to a no-op.
 *   - @/lib/supabase/admin is mocked (admin client).
 *   - @/lib/ghl/reports is mocked (getPipelineAggregate).
 *   - @/lib/email/send is mocked (sendEmail).
 *   - @/lib/email/templates/daily-brief-email is mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── constants ──────────────────────────────────────────────────────────────────

const VENUE_A_ID = "venue-aaa-001";
const VENUE_B_ID = "venue-bbb-002";
const USER_ID_OWNER = "user-owner-xyz";
const OWNER_EMAIL = "owner@thegrandhall.com";

// ── mock state ─────────────────────────────────────────────────────────────────

// Controls getPipelineAggregate behaviour
type MockPipelineMode = "connected" | "null" | "throw";
let mockPipelineMode: MockPipelineMode = "connected";

const MOCK_PIPELINE = {
  stages: [
    { pipelineStageId: "stage-001", stageName: "stage-001", count: 3, valueMinor: 30000 },
    { pipelineStageId: "stage-002", stageName: "stage-002", count: 1, valueMinor: 10000 },
  ],
  totalCount: 4,
  totalValueMinor: 40000,
};

// Supabase mock state
let mockVenues: { id: string; name: string; timezone: string }[] = [
  { id: VENUE_A_ID, name: "The Grand Hall", timezone: "Europe/London" },
];

let mockPortalActivity: { last_login_at: string; wedding_id: string }[] = [
  { last_login_at: new Date(Date.now() - 3600_000).toISOString(), wedding_id: "wedding-001" },
];

let mockUpcomingEvents: {
  title: string;
  starts_at_time: string;
  wedding_id: string;
  weddings: { wedding_date: string | null };
}[] = [
  {
    title: "Ceremony run-through",
    starts_at_time: "14:00",
    wedding_id: "wedding-001",
    weddings: { wedding_date: "2026-06-20" },
  },
];

let mockOverduePayments: { label: string; amount_minor: number; due_date: string; wedding_id: string }[] = [];

let mockOwnerMembership: { user_id: string } | null = { user_id: USER_ID_OWNER };
let mockAuthUser: { user: { email: string } } | null = { user: { email: OWNER_EMAIL } };
let mockAuthError: { message: string } | null = null;

// Spy to capture sendEmail calls (hoisted — referenced in vi.mock factory).
const { sendEmailSpy } = vi.hoisted(() => ({
  sendEmailSpy: vi.fn(),
}));

// ── mocks ──────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/ghl/reports", () => ({
  getPipelineAggregate: async (_venueId: string) => {
    if (mockPipelineMode === "null") return null;
    if (mockPipelineMode === "throw") throw new Error("GHL API error 500");
    return MOCK_PIPELINE;
  },
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: sendEmailSpy,
}));

vi.mock("@/lib/email/templates/daily-brief-email", () => ({
  // Return props as the "element" — sufficient for asserting what gets passed.
  DailyBriefEmail: (props: unknown) => props,
}));

// Admin client mock — builds a minimal chainable Supabase mock
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    return {
      from: (table: string) => {
        if (table === "venues") {
          return {
            select: () => Promise.resolve({ data: mockVenues, error: null }),
          };
        }

        if (table === "couple_accounts") {
          // Chain: .select().eq("venue_id").gte("last_login_at")
          return {
            select: () => ({
              eq: () => ({
                gte: () => Promise.resolve({ data: mockPortalActivity, error: null }),
              }),
            }),
          };
        }

        if (table === "timeline_events") {
          // Chain: .select().eq("venue_id").gte().lte().order().limit()
          return {
            select: () => ({
              eq: () => ({
                gte: () => ({
                  lte: () => ({
                    order: () => ({
                      limit: () => Promise.resolve({ data: mockUpcomingEvents, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }

        if (table === "payment_milestones") {
          // Chain: .select().eq("venue_id").in("status", [...]).lt("due_date")
          return {
            select: () => ({
              eq: () => ({
                in: () => ({
                  lt: () => Promise.resolve({ data: mockOverduePayments, error: null }),
                }),
              }),
            }),
          };
        }

        if (table === "memberships") {
          // Chain: .select().eq("venue_id").eq("role").maybeSingle()
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: mockOwnerMembership, error: null }),
                }),
              }),
            }),
          };
        }

        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        };
      },

      auth: {
        admin: {
          getUserById: (_userId: string) =>
            Promise.resolve({
              data: mockAuthUser,
              error: mockAuthError,
            }),
        },
      },
    };
  },
}));

// ── import under test ──────────────────────────────────────────────────────────

import { runDailyBrief } from "./daily-brief";

function runHandler() {
  return runDailyBrief();
}

// ── setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset all state to defaults
  mockPipelineMode = "connected";
  mockVenues = [
    { id: VENUE_A_ID, name: "The Grand Hall", timezone: "Europe/London" },
  ];
  mockPortalActivity = [
    {
      last_login_at: new Date(Date.now() - 3_600_000).toISOString(),
      wedding_id: "wedding-001",
    },
  ];
  mockUpcomingEvents = [
    {
      title: "Ceremony run-through",
      starts_at_time: "14:00",
      wedding_id: "wedding-001",
      weddings: { wedding_date: "2026-06-20" },
    },
  ];
  mockOverduePayments = [];
  mockOwnerMembership = { user_id: USER_ID_OWNER };
  mockAuthUser = { user: { email: OWNER_EMAIL } };
  mockAuthError = null;

  sendEmailSpy.mockClear();
  sendEmailSpy.mockResolvedValue({ ok: true, id: "email-abc" });
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("runDailyBrief", () => {
  // ── happy path ──────────────────────────────────────────────────────────────

  it("sends an email to the venue owner on the happy path", async () => {
    await runHandler();

    expect(sendEmailSpy).toHaveBeenCalledOnce();
    const args = sendEmailSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(args.to).toBe(OWNER_EMAIL);
    expect(args.subject).toBe(`Daily brief — The Grand Hall`);
  });

  it("returns venuesBriefed = 1 for a single-venue setup", async () => {
    const result = (await runHandler()) as Record<string, unknown>;
    expect(result.venuesBriefed).toBe(1);
  });

  it("passes non-null pipeline to the email template when GHL is connected", async () => {
    await runHandler();

    const args = sendEmailSpy.mock.calls[0][0] as Record<string, unknown>;
    const react = args.react as Record<string, unknown>;
    expect(react.pipeline).not.toBeNull();
    expect(react.pipeline).toEqual(MOCK_PIPELINE);
  });

  it("includes portal activity count in the email template props", async () => {
    await runHandler();

    const args = sendEmailSpy.mock.calls[0][0] as Record<string, unknown>;
    const react = args.react as Record<string, unknown>;
    const activity = react.portalActivity as unknown[];
    expect(activity).toHaveLength(1);
  });

  it("includes upcoming events in the email template props", async () => {
    await runHandler();

    const args = sendEmailSpy.mock.calls[0][0] as Record<string, unknown>;
    const react = args.react as Record<string, unknown>;
    const events = react.upcomingEvents as unknown[];
    expect(events).toHaveLength(1);
    expect((events[0] as Record<string, unknown>).title).toBe("Ceremony run-through");
  });

  it("passes empty overduePayments array when there are none", async () => {
    await runHandler();

    const args = sendEmailSpy.mock.calls[0][0] as Record<string, unknown>;
    const react = args.react as Record<string, unknown>;
    expect(react.overduePayments).toEqual([]);
  });

  // ── GHL null → graceful degrade ─────────────────────────────────────────────

  it("sends the brief with pipeline=null when GHL is not connected (graceful degrade)", async () => {
    mockPipelineMode = "null";

    await runHandler();

    expect(sendEmailSpy).toHaveBeenCalledOnce();
    const args = sendEmailSpy.mock.calls[0][0] as Record<string, unknown>;
    const react = args.react as Record<string, unknown>;

    expect(react.pipeline).toBeNull();
    expect(args.subject).toBe("Daily brief — The Grand Hall");
  });

  // ── GHL throws → graceful degrade ──────────────────────────────────────────

  it("sends the brief with pipeline=null when getPipelineAggregate throws", async () => {
    mockPipelineMode = "throw";

    await runHandler();

    expect(sendEmailSpy).toHaveBeenCalledOnce();
    const args = sendEmailSpy.mock.calls[0][0] as Record<string, unknown>;
    const react = args.react as Record<string, unknown>;
    expect(react.pipeline).toBeNull();
  });

  // ── no owner membership ─────────────────────────────────────────────────────

  it("skips email when there is no owner membership for the venue", async () => {
    mockOwnerMembership = null;

    const result = (await runHandler()) as Record<string, unknown>;

    expect(sendEmailSpy).not.toHaveBeenCalled();

    const results = result.results as Record<string, unknown>[];
    expect(results[0].skipped).toBe(true);
    expect(results[0].reason).toBe("no-owner-membership");
  });

  // ── owner auth user unresolvable ────────────────────────────────────────────

  it("skips email when the owner user has no email address", async () => {
    mockAuthUser = null;
    mockAuthError = { message: "User not found" };

    const result = (await runHandler()) as Record<string, unknown>;

    expect(sendEmailSpy).not.toHaveBeenCalled();
    const results = result.results as Record<string, unknown>[];
    expect(results[0].skipped).toBe(true);
    expect(results[0].reason).toBe("owner-email-unresolvable");
  });

  // ── multiple venues ─────────────────────────────────────────────────────────

  it("sends one brief per venue when there are multiple venues", async () => {
    mockVenues = [
      { id: VENUE_A_ID, name: "The Grand Hall", timezone: "Europe/London" },
      { id: VENUE_B_ID, name: "Rose Garden Estate", timezone: "Europe/London" },
    ];

    const result = (await runHandler()) as Record<string, unknown>;

    expect(sendEmailSpy).toHaveBeenCalledTimes(2);
    expect(result.venuesBriefed).toBe(2);
  });

  // ── zero venues ─────────────────────────────────────────────────────────────

  it("sends no emails and returns venuesBriefed=0 when there are no venues", async () => {
    mockVenues = [];

    const result = (await runHandler()) as Record<string, unknown>;

    expect(sendEmailSpy).not.toHaveBeenCalled();
    expect(result.venuesBriefed).toBe(0);
  });

  // ── overdue payments populated ──────────────────────────────────────────────

  it("includes overdue payments in the email when they exist", async () => {
    mockOverduePayments = [
      {
        label: "Final balance",
        amount_minor: 500000,
        due_date: "2026-06-10",
        wedding_id: "wedding-001",
      },
    ];

    await runHandler();

    const args = sendEmailSpy.mock.calls[0][0] as Record<string, unknown>;
    const react = args.react as Record<string, unknown>;
    const payments = react.overduePayments as Array<Record<string, unknown>>;
    expect(payments).toHaveLength(1);
    expect(payments[0].label).toBe("Final balance");
    expect(payments[0].amount_minor).toBe(500000);
  });

  // ── upcomingEvents payload shape ────────────────────────────────────────────

  it("upcomingEvents payload has title, starts_at_time, and wedding_date fields", async () => {
    await runHandler();

    const args = sendEmailSpy.mock.calls[0][0] as Record<string, unknown>;
    const react = args.react as Record<string, unknown>;
    const events = react.upcomingEvents as Array<Record<string, unknown>>;

    expect(events).toHaveLength(1);
    expect(events[0]).toHaveProperty("title");
    expect(events[0]).toHaveProperty("starts_at_time");
    expect(events[0]).toHaveProperty("wedding_date");

    expect(events[0].title).toBe("Ceremony run-through");
    expect(events[0].starts_at_time).toBe("14:00");
    expect(events[0].wedding_date).toBe("2026-06-20");
  });

  it("upcomingEvents payload wedding_id is preserved", async () => {
    await runHandler();

    const args = sendEmailSpy.mock.calls[0][0] as Record<string, unknown>;
    const react = args.react as Record<string, unknown>;
    const events = react.upcomingEvents as Array<Record<string, unknown>>;

    expect(events[0]).toHaveProperty("wedding_id");
    expect(events[0].wedding_id).toBe("wedding-001");
  });

  // ── GHL-null degrade: all VF2 sections still populated ─────────────────────

  it("GHL-null degrade: upcomingEvents still populated when pipeline is null", async () => {
    mockPipelineMode = "null";

    await runHandler();

    const args = sendEmailSpy.mock.calls[0][0] as Record<string, unknown>;
    const react = args.react as Record<string, unknown>;

    expect(react.pipeline).toBeNull();
    expect((react.upcomingEvents as unknown[]).length).toBeGreaterThan(0);
    expect((react.portalActivity as unknown[]).length).toBeGreaterThan(0);
    expect(Array.isArray(react.overduePayments)).toBe(true);
  });

  it("GHL-null degrade: venueName and correct subject still sent when pipeline is null", async () => {
    mockPipelineMode = "null";

    await runHandler();

    const args = sendEmailSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(args.to).toBe(OWNER_EMAIL);
    expect(args.subject).toBe("Daily brief — The Grand Hall");
    const react = args.react as Record<string, unknown>;
    expect(react.venueName).toBe("The Grand Hall");
  });

  it("GHL-throw degrade: upcomingEvents still populated when getPipelineAggregate throws", async () => {
    mockPipelineMode = "throw";

    await runHandler();

    const args = sendEmailSpy.mock.calls[0][0] as Record<string, unknown>;
    const react = args.react as Record<string, unknown>;

    expect(react.pipeline).toBeNull();
    expect((react.upcomingEvents as unknown[]).length).toBeGreaterThan(0);
  });
});
