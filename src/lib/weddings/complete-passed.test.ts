/**
 * Unit tests for src/lib/weddings/complete-passed.ts
 *
 * Covers the post-wedding lifecycle hook:
 *   1. A passed planning wedding is tagged in GHL AND flipped to completed.
 *   2. No passed weddings → no-op.
 *   3. A wedding with no ghl_contact_id is completed but NOT tagged.
 *   4. Tag-first ordering: a failed tag PUT leaves the wedding un-flipped
 *      (so tomorrow's run retries — the contact is never silently lost).
 *   5. One GHL client per venue (the cache), shared across that venue's weddings.
 *
 * DB-free / secret-free: server-only, admin client, and ghlClient are mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

type PassedRow = { id: string; venue_id: string; ghl_contact_id: string | null };

let mockPassed: PassedRow[] = [];
let mockUpdateError: { message: string } | null = null;
let mockGhlClientNull = false;

const { ghlRequestSpy, updateSpy, ghlClientSpy } = vi.hoisted(() => ({
  ghlRequestSpy: vi.fn(),
  updateSpy: vi.fn(),
  ghlClientSpy: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/ghl/client", () => ({
  ghlClient: async (venueId: string) => {
    ghlClientSpy(venueId);
    if (mockGhlClientNull) return null;
    return { request: ghlRequestSpy };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (_table: string) => ({
      select: (_cols: string) => ({
        lt: (_c: string, _v: string) => ({
          in: async (_c2: string, _vals: string[]) => ({ data: mockPassed, error: null }),
        }),
      }),
      update: (vals: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          updateSpy(id, vals);
          return { error: mockUpdateError };
        },
      }),
    }),
  }),
}));

import { completePassedWeddings, COMPLETED_TAG } from "./complete-passed";

beforeEach(() => {
  mockPassed = [];
  mockUpdateError = null;
  mockGhlClientNull = false;
  ghlRequestSpy.mockReset();
  ghlRequestSpy.mockResolvedValue({});
  updateSpy.mockReset();
  ghlClientSpy.mockReset();
});

describe("completePassedWeddings", () => {
  it("tags the GHL contact then flips the wedding to completed", async () => {
    mockPassed = [{ id: "w1", venue_id: "v1", ghl_contact_id: "c1" }];

    const result = await completePassedWeddings();

    expect(result).toEqual({ completed: 1, tagged: 1 });
    const [path, init] = ghlRequestSpy.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/contacts/c1/tags");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string).tags).toContain(COMPLETED_TAG);
    expect(updateSpy).toHaveBeenCalledWith("w1", { status: "completed" });
  });

  it("is a no-op when nothing has passed", async () => {
    const result = await completePassedWeddings();
    expect(result).toEqual({ completed: 0, tagged: 0 });
    expect(ghlRequestSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("completes a wedding with no GHL contact without tagging", async () => {
    mockPassed = [{ id: "w1", venue_id: "v1", ghl_contact_id: null }];

    const result = await completePassedWeddings();

    expect(result).toEqual({ completed: 1, tagged: 0 });
    expect(ghlRequestSpy).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith("w1", { status: "completed" });
  });

  it("does NOT flip status when the tag PUT fails (retries next run)", async () => {
    mockPassed = [{ id: "w1", venue_id: "v1", ghl_contact_id: "c1" }];
    ghlRequestSpy.mockRejectedValueOnce(new Error("GHL 500"));

    const result = await completePassedWeddings();

    expect(result).toEqual({ completed: 0, tagged: 0 });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("builds one GHL client per venue, shared across its weddings", async () => {
    mockPassed = [
      { id: "w1", venue_id: "v1", ghl_contact_id: "c1" },
      { id: "w2", venue_id: "v1", ghl_contact_id: "c2" },
      { id: "w3", venue_id: "v2", ghl_contact_id: "c3" },
    ];

    const result = await completePassedWeddings();

    expect(result).toEqual({ completed: 3, tagged: 3 });
    // v1 reused across w1 + w2, v2 once → 2 client builds, not 3.
    expect(ghlClientSpy).toHaveBeenCalledTimes(2);
  });
});
