/**
 * computeSetupChecklist — pure gating checklist for venue setup (D5)
 *
 * Takes a snapshot of venue configuration counts/flags and returns an ordered
 * array of setup steps. Each step declares whether it is done and which
 * planning features it unlocks.
 *
 * Gating rules (specs/venue-settings.md §10, BUILD-ROADMAP.md D5):
 *
 *   profile         profileComplete = true          → (informational, no unlock)
 *   spaces          spaces >= 1                     → unlocks floor_templates step
 *   floor_templates spaces >= 1 AND templates >= 1  → unlocks per_wedding_floor_plan
 *   menu_library    menuItems >= 1                  → unlocks per_wedding_menu
 *   packages        packages >= 1                   → unlocks proposal_price_library
 *   team            teamMembers >= 2                → (informational, no unlock)
 *   ghl             ghlConnected = true             → unlocks ghl_features
 *
 * This module has zero imports — it is intentionally DB-free and secret-free.
 */

// ── types ─────────────────────────────────────────────────────────────────────

/** Snapshot of a venue's current configuration state, derived from DB counts. */
export interface ChecklistState {
  /** True when the venue has a name, logo, and timezone filled in. */
  profileComplete: boolean;
  /** Number of non-archived spaces for this venue. */
  spaces: number;
  /** Number of floor templates across all spaces for this venue. */
  floorTemplates: number;
  /** Number of active menu items in the venue's menu library. */
  menuItems: number;
  /** Number of active packages for this venue. */
  packages: number;
  /** Total team members (owner + admins + members). Minimum 1 (the owner). */
  teamMembers: number;
  /** True when the venue has a connected and valid GHL credential. */
  ghlConnected: boolean;
}

/** A single step in the guided setup checklist. */
export interface ChecklistStep {
  /** Stable identifier — used as a key in `venues.setup_completed_steps` jsonb. */
  key: string;
  /** Human-readable label shown in the checklist UI. */
  label: string;
  /** Whether the prerequisite condition for this step is currently satisfied. */
  done: boolean;
  /**
   * Feature keys unlocked when this step's `done` flips to true.
   * Empty array = informational step with no hard gate downstream.
   *
   * Possible values:
   *   "floor_templates"        — the floor_templates checklist step itself becomes reachable
   *   "per_wedding_floor_plan" — floor plan tab in the Wedding Workspace unlocks
   *   "per_wedding_menu"       — menu tab in the Wedding Workspace unlocks
   *   "proposal_price_library" — proposal builder price library populates
   *   "ghl_features"           — GHL-specific UI sections render
   */
  unlocks: string[];
}

// ── implementation ────────────────────────────────────────────────────────────

/**
 * Compute the ordered setup checklist from a venue configuration snapshot.
 *
 * Pure function — no side effects, no I/O, no mutation of the input.
 */
export function computeSetupChecklist(state: ChecklistState): ChecklistStep[] {
  const hasSpace = state.spaces >= 1;
  const hasTemplate = state.floorTemplates >= 1;

  return [
    {
      key: "profile",
      label: "Complete your venue profile",
      done: state.profileComplete,
      unlocks: [],
    },
    {
      key: "spaces",
      label: "Add at least one space",
      done: hasSpace,
      unlocks: ["floor_templates"],
    },
    {
      key: "floor_templates",
      label: "Configure a floor template for each space",
      // Both conditions must hold: a space must exist AND a template must exist.
      done: hasSpace && hasTemplate,
      unlocks: ["per_wedding_floor_plan"],
    },
    {
      key: "menu_library",
      label: "Add dishes to your menu library",
      done: state.menuItems >= 1,
      unlocks: ["per_wedding_menu"],
    },
    {
      key: "packages",
      label: "Set up packages and pricing",
      done: state.packages >= 1,
      unlocks: ["proposal_price_library"],
    },
    {
      key: "team",
      label: "Invite your team",
      done: state.teamMembers >= 2,
      unlocks: [],
    },
    {
      key: "ghl",
      label: "Connect VenueFlow",
      done: state.ghlConnected,
      unlocks: ["ghl_features"],
    },
  ];
}
