/**
 * Unit tests for src/lib/gating/checklist.ts
 *
 * computeSetupChecklist(state) is a pure function — no DB, no env vars, no side effects.
 * It maps a snapshot of venue configuration counts/flags to an ordered checklist where
 * each step declares whether it is done and which planning features it unlocks (D5).
 *
 * Gating rules tested (from specs/venue-settings.md §10 and BUILD-ROADMAP.md D5):
 *
 *   step key          done when                              unlocks
 *   ──────────────────────────────────────────────────────────────────────────────
 *   profile           profileComplete = true                 (none — informational)
 *   spaces            spaces >= 1                            floor_templates step
 *   floor_templates   spaces >= 1 AND floorTemplates >= 1   per-wedding floor plan
 *   menu_library      menuItems >= 1                         per-wedding menu
 *   packages          packages >= 1                          proposal price library
 *   team              teamMembers >= 2 (owner + 1 more)      (informational)
 *   ghl               ghlConnected = true                    ghl_features
 */

import { describe, it, expect } from "vitest";
import {
  computeSetupChecklist,
  type ChecklistState,
  type ChecklistStep,
} from "./checklist";

// ── helpers ───────────────────────────────────────────────────────────────────

/** Returns the step with the given key, throws if not found. */
function step(steps: ChecklistStep[], key: string): ChecklistStep {
  const found = steps.find((s) => s.key === key);
  if (!found) throw new Error(`Step "${key}" not found in checklist`);
  return found;
}

/** A baseline state where nothing has been configured. */
const EMPTY_STATE: ChecklistState = {
  profileComplete: false,
  spaces: 0,
  floorTemplates: 0,
  menuItems: 0,
  packages: 0,
  teamMembers: 1, // just the owner
  ghlConnected: false,
};

/** A fully configured state where everything is done. */
const FULL_STATE: ChecklistState = {
  profileComplete: true,
  spaces: 2,
  floorTemplates: 3,
  menuItems: 10,
  packages: 4,
  teamMembers: 3,
  ghlConnected: true,
};

// ── shape & ordering ──────────────────────────────────────────────────────────

describe("computeSetupChecklist — shape", () => {
  it("returns an array of steps", () => {
    const result = computeSetupChecklist(EMPTY_STATE);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("every step has key, label, done, and unlocks fields", () => {
    const result = computeSetupChecklist(EMPTY_STATE);
    for (const s of result) {
      expect(typeof s.key).toBe("string");
      expect(typeof s.label).toBe("string");
      expect(typeof s.done).toBe("boolean");
      expect(Array.isArray(s.unlocks)).toBe(true);
    }
  });

  it("includes exactly the expected step keys in the right order", () => {
    const result = computeSetupChecklist(EMPTY_STATE);
    const keys = result.map((s) => s.key);
    expect(keys).toEqual([
      "profile",
      "spaces",
      "floor_templates",
      "menu_library",
      "packages",
      "team",
      "ghl",
    ]);
  });

  it("labels are non-empty strings", () => {
    const result = computeSetupChecklist(FULL_STATE);
    for (const s of result) {
      expect(s.label.length).toBeGreaterThan(0);
    }
  });
});

// ── profile step ──────────────────────────────────────────────────────────────

describe("profile step", () => {
  it("is not done when profileComplete = false", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, profileComplete: false });
    expect(step(result, "profile").done).toBe(false);
  });

  it("is done when profileComplete = true", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, profileComplete: true });
    expect(step(result, "profile").done).toBe(true);
  });

  it("unlocks nothing (informational step)", () => {
    const result = computeSetupChecklist(FULL_STATE);
    expect(step(result, "profile").unlocks).toEqual([]);
  });
});

// ── spaces step ───────────────────────────────────────────────────────────────

describe("spaces step", () => {
  it("is not done when spaces = 0", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, spaces: 0 });
    expect(step(result, "spaces").done).toBe(false);
  });

  it("is done when spaces >= 1", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, spaces: 1 });
    expect(step(result, "spaces").done).toBe(true);
  });

  it("is done when spaces > 1", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, spaces: 5 });
    expect(step(result, "spaces").done).toBe(true);
  });

  it("unlocks floor_templates step", () => {
    const result = computeSetupChecklist(FULL_STATE);
    expect(step(result, "spaces").unlocks).toContain("floor_templates");
  });
});

// ── floor_templates step ──────────────────────────────────────────────────────

describe("floor_templates step", () => {
  it("is not done when no spaces exist (even if floorTemplates > 0)", () => {
    // Defensive: a floor template without a space is an impossible DB state,
    // but the function should still guard against inconsistent input.
    const result = computeSetupChecklist({
      ...EMPTY_STATE,
      spaces: 0,
      floorTemplates: 2,
    });
    expect(step(result, "floor_templates").done).toBe(false);
  });

  it("is not done when spaces exist but floorTemplates = 0", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, spaces: 1, floorTemplates: 0 });
    expect(step(result, "floor_templates").done).toBe(false);
  });

  it("is done when spaces >= 1 AND floorTemplates >= 1", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, spaces: 1, floorTemplates: 1 });
    expect(step(result, "floor_templates").done).toBe(true);
  });

  it("is done when multiple spaces and multiple templates exist", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, spaces: 3, floorTemplates: 5 });
    expect(step(result, "floor_templates").done).toBe(true);
  });

  it("unlocks per-wedding floor plan feature", () => {
    const result = computeSetupChecklist(FULL_STATE);
    expect(step(result, "floor_templates").unlocks).toContain("per_wedding_floor_plan");
  });
});

// ── menu_library step ─────────────────────────────────────────────────────────

describe("menu_library step", () => {
  it("is not done when menuItems = 0", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, menuItems: 0 });
    expect(step(result, "menu_library").done).toBe(false);
  });

  it("is done when menuItems >= 1", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, menuItems: 1 });
    expect(step(result, "menu_library").done).toBe(true);
  });

  it("is done when menuItems is large", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, menuItems: 40 });
    expect(step(result, "menu_library").done).toBe(true);
  });

  it("unlocks per-wedding menu builder", () => {
    const result = computeSetupChecklist(FULL_STATE);
    expect(step(result, "menu_library").unlocks).toContain("per_wedding_menu");
  });
});

// ── packages step ─────────────────────────────────────────────────────────────

describe("packages step", () => {
  it("is not done when packages = 0", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, packages: 0 });
    expect(step(result, "packages").done).toBe(false);
  });

  it("is done when packages >= 1", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, packages: 1 });
    expect(step(result, "packages").done).toBe(true);
  });

  it("unlocks proposal price library", () => {
    const result = computeSetupChecklist(FULL_STATE);
    expect(step(result, "packages").unlocks).toContain("proposal_price_library");
  });
});

// ── team step ─────────────────────────────────────────────────────────────────

describe("team step", () => {
  it("is not done when teamMembers = 1 (owner only)", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, teamMembers: 1 });
    expect(step(result, "team").done).toBe(false);
  });

  it("is done when teamMembers >= 2", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, teamMembers: 2 });
    expect(step(result, "team").done).toBe(true);
  });

  it("is done when teamMembers is large", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, teamMembers: 10 });
    expect(step(result, "team").done).toBe(true);
  });

  it("unlocks nothing (informational step)", () => {
    const result = computeSetupChecklist(FULL_STATE);
    expect(step(result, "team").unlocks).toEqual([]);
  });
});

// ── ghl step ──────────────────────────────────────────────────────────────────

describe("ghl step", () => {
  it("is not done when ghlConnected = false", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, ghlConnected: false });
    expect(step(result, "ghl").done).toBe(false);
  });

  it("is done when ghlConnected = true", () => {
    const result = computeSetupChecklist({ ...EMPTY_STATE, ghlConnected: true });
    expect(step(result, "ghl").done).toBe(true);
  });

  it("unlocks ghl_features", () => {
    const result = computeSetupChecklist(FULL_STATE);
    expect(step(result, "ghl").unlocks).toContain("ghl_features");
  });
});

// ── all done / all pending ────────────────────────────────────────────────────

describe("computeSetupChecklist — aggregate done states", () => {
  it("all steps are done when state is fully configured", () => {
    const result = computeSetupChecklist(FULL_STATE);
    const notDone = result.filter((s) => !s.done).map((s) => s.key);
    expect(notDone).toEqual([]);
  });

  it("no steps are done when state is completely empty", () => {
    const result = computeSetupChecklist(EMPTY_STATE);
    const done = result.filter((s) => s.done).map((s) => s.key);
    expect(done).toEqual([]);
  });

  it("partial config marks only the completed steps as done", () => {
    const partial: ChecklistState = {
      profileComplete: true,
      spaces: 1,
      floorTemplates: 0, // space exists but no template yet
      menuItems: 5,
      packages: 0,
      teamMembers: 1,
      ghlConnected: false,
    };
    const result = computeSetupChecklist(partial);

    expect(step(result, "profile").done).toBe(true);
    expect(step(result, "spaces").done).toBe(true);
    expect(step(result, "floor_templates").done).toBe(false); // template missing
    expect(step(result, "menu_library").done).toBe(true);
    expect(step(result, "packages").done).toBe(false);
    expect(step(result, "team").done).toBe(false);
    expect(step(result, "ghl").done).toBe(false);
  });
});

// ── unlock dependency chain ───────────────────────────────────────────────────

describe("unlock dependency chain (D5)", () => {
  it("spaces unlocks floor_templates — which in turn unlocks per_wedding_floor_plan", () => {
    const result = computeSetupChecklist(FULL_STATE);

    // spaces → floor_templates
    const spacesStep = step(result, "spaces");
    expect(spacesStep.unlocks).toContain("floor_templates");

    // floor_templates → per_wedding_floor_plan
    const floorStep = step(result, "floor_templates");
    expect(floorStep.unlocks).toContain("per_wedding_floor_plan");
  });

  it("menu_library → per_wedding_menu is the sole unlock path for the menu builder", () => {
    const result = computeSetupChecklist(FULL_STATE);
    const menuStep = step(result, "menu_library");
    expect(menuStep.unlocks).toContain("per_wedding_menu");
    // Confirm no other step claims to unlock per_wedding_menu
    const othersUnlockMenu = result
      .filter((s) => s.key !== "menu_library")
      .some((s) => s.unlocks.includes("per_wedding_menu"));
    expect(othersUnlockMenu).toBe(false);
  });

  it("packages → proposal_price_library is the sole unlock path for proposals", () => {
    const result = computeSetupChecklist(FULL_STATE);
    const pkgStep = step(result, "packages");
    expect(pkgStep.unlocks).toContain("proposal_price_library");
    const othersUnlockProposal = result
      .filter((s) => s.key !== "packages")
      .some((s) => s.unlocks.includes("proposal_price_library"));
    expect(othersUnlockProposal).toBe(false);
  });

  it("ghl → ghl_features is the sole unlock path for GHL-specific features", () => {
    const result = computeSetupChecklist(FULL_STATE);
    const ghlStep = step(result, "ghl");
    expect(ghlStep.unlocks).toContain("ghl_features");
    const othersUnlockGhl = result
      .filter((s) => s.key !== "ghl")
      .some((s) => s.unlocks.includes("ghl_features"));
    expect(othersUnlockGhl).toBe(false);
  });
});

// ── purity / idempotency ──────────────────────────────────────────────────────

describe("computeSetupChecklist — purity", () => {
  it("does not mutate the input state object", () => {
    const state: ChecklistState = { ...EMPTY_STATE };
    const frozen = Object.freeze({ ...state });
    // Should not throw despite frozen input
    expect(() => computeSetupChecklist(frozen)).not.toThrow();
  });

  it("returns the same result when called twice with identical state", () => {
    const result1 = computeSetupChecklist(FULL_STATE);
    const result2 = computeSetupChecklist(FULL_STATE);
    expect(result1).toEqual(result2);
  });

  it("returns a new array reference on each call (no shared mutable state)", () => {
    const result1 = computeSetupChecklist(EMPTY_STATE);
    const result2 = computeSetupChecklist(EMPTY_STATE);
    expect(result1).not.toBe(result2);
  });
});
