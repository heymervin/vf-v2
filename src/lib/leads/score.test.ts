import { describe, it, expect } from "vitest";
import { scoreLead, type ScorableLead } from "./score";

const NOW = new Date("2026-06-26T12:00:00.000Z");

const base: ScorableLead = {
  email: null,
  phone: null,
  wedding_date: null,
  guest_count: null,
  budget_minor: null,
  created_at: NOW.toISOString(),
  status: "lead",
};

describe("scoreLead", () => {
  it("scores a booked contact 100", () => {
    expect(scoreLead({ ...base, status: "booked" }, NOW)).toBe(100);
  });

  it("scores an empty fresh lead only on freshness", () => {
    // created now → freshness 15, nothing else
    expect(scoreLead(base, NOW)).toBe(15);
  });

  it("rewards a hot, complete, imminent lead", () => {
    const hot: ScorableLead = {
      email: "a@x.com",
      phone: "0207",
      wedding_date: "2026-12-01", // within a year
      guest_count: 120,
      budget_minor: 2_500_000, // > £20k → capped at 30
      created_at: NOW.toISOString(),
      status: "lead",
    };
    // 30 (budget cap) + 15 + 10 (date) + 15 (guests) + 8 + 7 + 15 (fresh) = 100
    expect(scoreLead(hot, NOW)).toBe(100);
  });

  it("decays with age and ignores past wedding dates for proximity", () => {
    const stale: ScorableLead = {
      ...base,
      created_at: "2026-01-01T00:00:00.000Z", // >90 days → 0 freshness
      wedding_date: "2020-01-01", // past → no proximity bonus, still +15 for being set
    };
    expect(scoreLead(stale, NOW)).toBe(15);
  });

  it("clamps to 0–100", () => {
    const s = scoreLead({ ...base, budget_minor: 99_999_999, guest_count: 9999, email: "a", phone: "b", wedding_date: "2026-07-01" }, NOW);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});
