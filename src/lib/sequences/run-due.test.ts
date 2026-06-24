/**
 * Unit tests for src/lib/sequences/run-due.ts (the nurture-sequence cron).
 *
 * Covers the cron model:
 *   1. A due enrollment (created_at far enough in the past) sends its next step
 *      and advances current_step.
 *   2. A not-yet-due enrollment (created recently) is skipped — no email sent.
 *
 * DB-free / secret-free:
 *   - "server-only" mocked to a no-op.
 *   - @/lib/supabase/admin mocked (chainable builder per table).
 *   - @/lib/email/send mocked (sendEmail spy).
 *   - @/lib/email/templates/nurture-email mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── constants ──────────────────────────────────────────────────────────────────

const VENUE_ID = "venue-seq-001";
const CONTACT_ID = "contact-seq-001";
const OPP_ID = "opp-seq-001";
const HOUR_MS = 3_600_000;

// ── mock state ─────────────────────────────────────────────────────────────────

interface EnrollmentRow {
  id: string;
  venue_id: string;
  contact_id: string;
  opportunity_id: string;
  current_step: number;
  created_at: string;
  status: string;
}

let mockActiveEnrollments: EnrollmentRow[] = [];

// All three steps enabled, each with a 24h delay between them.
const mockSteps = [
  { step_number: 1, delay_hours: 24, subject: "Step 1 — {{first_name}}", body: "Body 1", enabled: true },
  { step_number: 2, delay_hours: 24, subject: "Step 2", body: "Body 2", enabled: true },
  { step_number: 3, delay_hours: 24, subject: "Step 3", body: "Body 3", enabled: true },
];

// Mutable per-test so hard-stop transitions can be exercised.
let mockSequence = { enabled: true };
let mockOpportunity = { stage: "inbound_enquiry" };
let mockContact = {
  email: "couple@example.com",
  first_name: "Sam",
  partner_first_name: "Alex",
  email_status: "ok",
};
let mockSuppression: { id: string } | null = null;
const mockVenue = { name: "The Grand Hall" };
const mockEmailSettings = { from_name: "Grand Hall", reply_to: null };

// Spies referenced inside hoisted vi.mock factories must themselves be hoisted.
const { enrollmentUpdateSpy, sendEmailSpy } = vi.hoisted(() => ({
  enrollmentUpdateSpy: vi.fn(),
  sendEmailSpy: vi.fn(),
}));

// ── mocks ──────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: sendEmailSpy,
}));

vi.mock("@/lib/email/templates/nurture-email", () => ({
  NurtureEmail: (props: unknown) => props,
}));

vi.mock("@/lib/email/merge-tags", () => ({
  applyMergeTags: (template: string) => template,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "sequence_enrollments") {
        return {
          // List query: .select().eq("status","active")
          select: () => ({
            eq: (col: string, val: string) => {
              if (col === "status") {
                // batch list
                return Promise.resolve({
                  data: mockActiveEnrollments.filter((e) => e.status === val),
                  error: null,
                });
              }
              // single re-read: .eq("id", x).maybeSingle()
              return {
                maybeSingle: async () => ({
                  data: mockActiveEnrollments.find((e) => e.id === val) ?? null,
                  error: null,
                }),
              };
            },
          }),
          update: (payload: Record<string, unknown>) => {
            enrollmentUpdateSpy(payload);
            return {
              eq: () => ({
                eq: () => Promise.resolve({ data: null, error: null }),
              }),
              // single-eq variant resolves directly when awaited
              then: (resolve: (v: unknown) => unknown) =>
                resolve({ data: null, error: null }),
            };
          },
        };
      }

      if (table === "sequence_steps") {
        return {
          select: () => ({
            eq: (_col: string, _val: string) => ({
              // list: .order()
              order: () => Promise.resolve({ data: mockSteps, error: null }),
              // single: .eq("step_number", n).maybeSingle()
              eq: (_c2: string, stepNum: number) => ({
                maybeSingle: async () => ({
                  data: mockSteps.find((s) => s.step_number === stepNum) ?? null,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "sequences") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mockSequence, error: null }) }),
          }),
        };
      }

      if (table === "opportunities") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mockOpportunity, error: null }) }),
          }),
        };
      }

      if (table === "contacts") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mockContact, error: null }) }),
          }),
        };
      }

      if (table === "email_suppressions") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mockSuppression, error: null }) }),
          }),
        };
      }

      if (table === "venues") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mockVenue, error: null }) }),
          }),
        };
      }

      if (table === "venue_email_settings") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mockEmailSettings, error: null }) }),
          }),
        };
      }

      if (table === "email_messages") {
        return {
          insert: () => ({
            select: () => ({
              maybeSingle: async () => ({ data: { id: "msg-row-1" }, error: null }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

// ── import under test ──────────────────────────────────────────────────────────

import { runDueSequenceSteps } from "./run-due";

// ── setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockActiveEnrollments = [];
  mockSequence = { enabled: true };
  mockOpportunity = { stage: "inbound_enquiry" };
  mockContact = {
    email: "couple@example.com",
    first_name: "Sam",
    partner_first_name: "Alex",
    email_status: "ok",
  };
  mockSuppression = null;
  enrollmentUpdateSpy.mockClear();
  sendEmailSpy.mockClear();
  sendEmailSpy.mockResolvedValue({ ok: true, id: "email-seq-1" });
});

/** A due enrollment at current_step 0 (created 25h ago; step-1 delay is 24h). */
function dueEnrollment(overrides: Partial<EnrollmentRow> = {}): EnrollmentRow {
  return {
    id: "enr-due",
    venue_id: VENUE_ID,
    contact_id: CONTACT_ID,
    opportunity_id: OPP_ID,
    current_step: 0,
    created_at: new Date(Date.now() - 25 * HOUR_MS).toISOString(),
    status: "active",
    ...overrides,
  };
}

/** Find the enrollment update whose payload matches the given fields. */
function findUpdate(match: Record<string, unknown>) {
  return enrollmentUpdateSpy.mock.calls.find((c) => {
    const payload = c[0] as Record<string, unknown>;
    return Object.entries(match).every(([k, v]) => payload[k] === v);
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("runDueSequenceSteps", () => {
  it("sends step 1 for a due enrollment and advances current_step", async () => {
    // current_step 0 → nextStep 1; dueAt = created_at + 24h. Created 25h ago → due.
    mockActiveEnrollments = [
      {
        id: "enr-due",
        venue_id: VENUE_ID,
        contact_id: CONTACT_ID,
        opportunity_id: OPP_ID,
        current_step: 0,
        created_at: new Date(Date.now() - 25 * HOUR_MS).toISOString(),
        status: "active",
      },
    ];

    const result = await runDueSequenceSteps();

    expect(sendEmailSpy).toHaveBeenCalledOnce();
    expect(result.processed).toBe(1);

    // current_step advanced to 1.
    const advance = enrollmentUpdateSpy.mock.calls.find(
      (c) => (c[0] as Record<string, unknown>).current_step === 1,
    );
    expect(advance).toBeDefined();
  });

  it("skips a not-yet-due enrollment and sends no email", async () => {
    // Created 1h ago; step 1 delay is 24h → dueAt is in the future → skip.
    mockActiveEnrollments = [
      {
        id: "enr-early",
        venue_id: VENUE_ID,
        contact_id: CONTACT_ID,
        opportunity_id: OPP_ID,
        current_step: 0,
        created_at: new Date(Date.now() - 1 * HOUR_MS).toISOString(),
        status: "active",
      },
    ];

    const result = await runDueSequenceSteps();

    expect(sendEmailSpy).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
  });

  it("stops (stage_moved) without advancing when the opportunity left inbound_enquiry", async () => {
    mockOpportunity = { stage: "responded" };
    mockActiveEnrollments = [dueEnrollment()];

    const result = await runDueSequenceSteps();

    expect(sendEmailSpy).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
    expect(findUpdate({ status: "stopped", stopped_reason: "stage_moved" })).toBeDefined();
    expect(findUpdate({ current_step: 1 })).toBeUndefined();
  });

  it("stops (disabled) when the sequence was turned off mid-run", async () => {
    mockSequence = { enabled: false };
    mockActiveEnrollments = [dueEnrollment()];

    const result = await runDueSequenceSteps();

    expect(sendEmailSpy).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
    expect(findUpdate({ status: "stopped", stopped_reason: "disabled" })).toBeDefined();
  });

  it("stops (bounced) when the contact email is suppressed", async () => {
    mockSuppression = { id: "supp-1" };
    mockActiveEnrollments = [dueEnrollment()];

    const result = await runDueSequenceSteps();

    expect(sendEmailSpy).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
    expect(findUpdate({ status: "stopped", stopped_reason: "bounced" })).toBeDefined();
  });

  it("marks an enrollment completed once past the last step (no send)", async () => {
    // current_step 3 → nextStep 4 > STEP_COUNT → completed sweep.
    mockActiveEnrollments = [dueEnrollment({ id: "enr-done", current_step: 3 })];

    const result = await runDueSequenceSteps();

    expect(sendEmailSpy).not.toHaveBeenCalled();
    expect(result.processed).toBe(0);
    expect(findUpdate({ status: "completed", current_step: 3 })).toBeDefined();
  });

  it("completes the enrollment when it sends the final step", async () => {
    // current_step 2 → nextStep 3 (= STEP_COUNT). created_at + 72h cumulative delay.
    mockActiveEnrollments = [
      dueEnrollment({
        id: "enr-final",
        current_step: 2,
        created_at: new Date(Date.now() - 73 * HOUR_MS).toISOString(),
      }),
    ];

    const result = await runDueSequenceSteps();

    expect(sendEmailSpy).toHaveBeenCalledOnce();
    expect(result.processed).toBe(1);
    expect(findUpdate({ status: "completed", current_step: 3 })).toBeDefined();
  });
});
