# VF2 Build Spec Index

> The map to the VenueFlow v2 (VF2) build spec set. Start at the roadmap, then dive into the
> per-area spec for the slice you're building. This index also holds the **shared glossary**, the
> **locked-decisions log (D1–D8)**, and the **list of decisions still needing human sign-off** —
> the things a builder must NOT guess.
>
> Authority order when two docs disagree:
> 1. **Ground truth** = the June 16 team call + [`../GHL-BACKEND-PLAN.md`](../GHL-BACKEND-PLAN.md) (GHL phases).
> 2. **[`data-model.md`](./data-model.md)** owns all table/column names, types, and RLS (the schema authority).
> 3. **[`ghl-integration.md`](./ghl-integration.md)** owns GHL endpoint shapes, auth, and webhook behaviour (§11 corrects the plan's `/v2` shorthand and event names).
> 4. Feature specs (`staff-workspace`, `venue-settings`, `couple-portal`) own UX + flow; where they sketch a table inline, the schema authority above wins.

---

## The Specs

| Spec | One-liner | Primary slices |
|---|---|---|
| [`../BUILD-ROADMAP.md`](../BUILD-ROADMAP.md) | Master strategy + the slice-by-slice (1–8) build order; the two-system model and the architecture fork (D2). Open this first. | 1–8 |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | **Data architecture & process flow** — where data lives (GHL vs Supabase), the four link keys, the won→wedding bridge, read-through pattern, RLS. The one-page mental model. | 1–8 |
| [`../GHL-BACKEND-PLAN.md`](../GHL-BACKEND-PLAN.md) | Authoritative GHL integration-point + **phase** plan (Phases 1–5) from the call transcript. | 1, 2, 5, 6, 7 |
| [`data-model.md`](./data-model.md) | **Schema authority** — every new table, column, type, index, RLS pattern, and the migration map (M7–M13). | 1–5, 8 |
| [`SCHEMA-DECISIONS.md`](./SCHEMA-DECISIONS.md) | **Resolved-forks authority** — the 8 schema forks settled (SD-1…SD-8); supersedes conflicting inline DDL. Read before writing M7+ SQL. | 1–5, 8 |
| [`ghl-integration.md`](./ghl-integration.md) | The GHL backend layer — `ghlClient`, PIT/OAuth, the webhook handler, the 5 integration points, plan-vs-reality corrections (§11), scopes, the read-mirror contract. | 1, 2, 5, 6, 7 |
| [`staff-workspace.md`](./staff-workspace.md) | The post-booking heart — Weddings index, Wedding Workspace hub, the 5 per-wedding planning tools, tasks/notes, and how the workspace borrows GHL surfaces. | 2, 4, 5, 7 |
| [`venue-settings.md`](./venue-settings.md) | Venue config / libraries — profile, spaces, floor templates, menu library, packages, team, custom fields, GHL connect tile, the gating model + setup checklist. | 3 |
| [`couple-portal.md`](./couple-portal.md) | The couple-facing portal — magic-link auth, couple-only RLS, what couples see/edit, screen-by-screen. | 8 |

### Slice → GHL Phase map (so the two numbering systems never drift)

| Slice (roadmap) | GHL Phase (backend plan) | What |
|---|---|---|
| 1 Foundation | Phase 0 | `ghl_credentials` + `ghlClient` + connect tile + live read |
| 2 Trigger (spine) | **Phase 1** | opp-won → wedding + couple invite (Integration Point 1) |
| 5 Money | **Phase 3** | GHL invoices mirror (Integration Point 4) |
| 6 Messaging | **Phase 2** | conversations mirror (Integration Point 3) |
| 7 Intelligence | **Phase 4** (+ Phase 5 contact-sync polish) | Daily Brief + reports (Integration Point 5) |

> Note the deliberate non-monotonic mapping: Slice 5 (Money) is GHL **Phase 3**, Slice 6 (Messaging) is GHL **Phase 2**. The roadmap orders by build value, not by GHL phase number. Don't "correct" one to match the other.

---

## Glossary / Terminology (use these exact terms)

| Term | Means | Table |
|---|---|---|
| **venue** | the tenant — a wedding venue / VF2 customer | `venues` |
| **wedding** | the post-booking workspace record (one per booked couple) | `weddings` |
| **couple** | the portal end-users (the partners) | `couple_accounts` |
| **contact** | a pre-sales person record; **GHL-owned** in bundled mode (VF2 `contacts` demoted to read-mirror) | `contacts` (+ `ghl_contact_id`) |
| **opportunity** | a pre-sales deal; **GHL-owned** in bundled mode | `opportunities` (+ `ghl_opportunity_id`) |
| **GHL credentials** | per-venue GHL API creds (PIT now, OAuth later) — **NOT** `ghl_venues`/`ghl_connections` | `ghl_credentials` |
| **staff app / internal app** | the `(app)` route group venues' staff use | `src/app/(app)/*` |
| **couple portal** | the `(portal)` route group | `src/app/(portal)/*` |
| **bundled mode** | GHL is the primary pre-sales engine (`venues.ghl_enabled = true` + a creds row) | — |
| **standalone mode** | VF2's native CRM is the pre-sales engine; GHL absent (the D2 fallback) | — |
| **menu library** | venue-level dishes (D4: items first) → menus built from items | `menu_items` → `menu_item_selections` → `menus` |
| **`ghlClient(venueId)`** | the single server-side GHL API helper; abstracts PIT vs OAuth so the swap is backend-only | `src/lib/ghl/client.ts` |

**Naming locks (do not invent alternates):** `ghl_credentials` (not `ghl_venues`); `menu_items` / `menus` / `menu_item_selections` (the D4 trio); `ghl_credentials.auth_type` (not `auth_mode`); couple-RLS helper `current_couple_wedding_ids()` (plural SETOF, matching `current_venue_ids()`); per-wedding custom fields on `weddings.custom` (not `custom_data`).

---

## Locked Decisions Log (D1–D8)

These were decided on the June 16 call. **Do not re-litigate.** Every spec must reflect them.

| # | Decision | Lives in |
|---|---|---|
| **D1** | **Center of gravity = the Wedding Workspace.** New build investment goes post-booking (the real version of `/preview/weddings/[id]`). | staff-workspace §0, roadmap |
| **D2** | **The native pre-sales CRM is NOT deleted.** It's preserved as the **standalone-mode** fallback, gated by a per-venue mode flag. In bundled mode it's a low-priority read-mirror of GHL. | roadmap §"Architecture Decision", data-model M7, ghl-integration §3 |
| **D3** | **The WhatsApp blocker is solved by architecture.** Pre-sales messaging stays entirely in GHL, so VF2 never obtains WhatsApp API access. Post-booking messaging is a lower-priority GHL mirror (read→send→realtime), no message storage in VF2. | roadmap §D3, ghl-integration §7, staff-workspace §10 |
| **D4** | **Menu = food ITEMS first, then MENUS built from items** (`menu_items → menu_item_selections → menus`). Editing one item updates it everywhere. | data-model M10, venue-settings §5, staff-workspace §5 |
| **D5** | **Gating.** A feature stays locked until its prerequisite setup exists (floor plan needs a space+template; per-wedding menu needs library items; calendar needs availability). First-login guided setup checklist replaces Sonas onboarding pain. | venue-settings §10, staff-workspace (per-tool), roadmap |
| **D6** | **GHL is an OPTIONAL plugin layer, not a hard dependency.** Every integration point has a standalone fallback (above all: staff can manually create a wedding). | ghl-integration §3, staff-workspace §1, couple-portal §2.2 |
| **D7** | **Wedding-scoped tabs.** Planning-tool tabs belong to ONE wedding and only appear inside that wedding's Workspace — never in global left nav. | staff-workspace §2, roadmap |
| **D8** | **Build internal/staff side FIRST, couple portal LAST. Page-at-a-time, test each before moving on.** | roadmap, staff-workspace §11, couple-portal §1 |

---

## Decisions Still Needing Human Sign-Off

These are open across the spec set. They are flagged in-spec (as `OQ-*` / `Q*` / `R*`) and consolidated here. **Builders must not guess these** — get a decision first. Grouped by how blocking they are.

### Blocks a migration / schema — ✅ RESOLVED in [`SCHEMA-DECISIONS.md`](./SCHEMA-DECISIONS.md)

> All 8 schema forks below (items 1–8) were **resolved 2026-06-16** in
> [`SCHEMA-DECISIONS.md`](./SCHEMA-DECISIONS.md) (SD-1…SD-8) — that doc is the authority for the M7+
> migrations and supersedes any conflicting inline DDL. Two carry a **CONFIRM** for the team
> (low-risk, defaults chosen so nothing is blocked): the mode-flag default (SD-1 → `'bundled'`) and the
> split day/evening guest count (SD-2). The original fork descriptions are kept below for traceability.

1. **Mode-flag shape + default (D2 / R5 / data-model OQ-3).** → **SD-1.** data-model M7 currently adds **both** `venues.ghl_enabled boolean` **and** `venues.ghl_mode text`. ghl-integration §3.1 + Assumption A-4 say **only** `venues.ghl_enabled boolean` is needed. Pick one (recommend: keep `ghl_enabled`; drop or justify `ghl_mode`) and set the new-venue default. *Two specs currently disagree on whether `ghl_mode` exists.*

2. **`weddings` column names + shape (data-model M8 vs staff-workspace §3).** The two specs that both define `weddings` disagree: `couple_name` vs `couple_display_name`; `coordinator_id` vs `coordinator_membership_id`; single `guest_count` vs split `guest_count_day`/`guest_count_evening`; `total_value_minor int` (pence) vs `total_value numeric(12,2)`; `package_name` (denorm text) vs `package_id` (FK). data-model M8 is the schema authority and should win, but confirm the **design** choices (split guest count? minor-units money?) before the migration. (Linked to OQ-3 money-units below.)

3. **`couple_accounts` schema + invite mechanism (data-model M8 vs couple-portal §2).** Two divergent designs for the same table:
   - **Role values:** ground truth says `partner_a`/`partner_b`; couple-portal §2.1 DDL uses `role IN ('partner')`; data-model M8 has no `role` column at all (uses `display_name`). Decide the canonical role set and whether `couple_accounts` carries `role`.
   - **Invite flow:** data-model uses a custom `invite_token uuid` column + `/portal/activate?token=` + `auth.admin.createUser`. couple-portal uses Supabase-native `auth.admin.inviteUserByEmail` (no custom token column) + `/portal/accept?token=` (and a third path, `/portal/auth/magic-link`). Pick one invite mechanism and one route.
   - **Column drift:** `last_seen_at` (data-model) vs `last_login_at` (couple-portal); data-model has a `status` enum (`invited/active/disabled`) that couple-portal's DDL omits — yet the shared `current_couple_wedding_ids()` helper filters on `status = 'active'`, so the column must exist. Reconcile onto the data-model definition.

4. **Course model + `menus` table shape (data-model M10 vs staff-workspace §5 vs couple-portal §5.1).** Unsettled in three ways:
   - **`menu_items.course` type:** venue-settings §5 uses a **lowercase CHECK enum** (`'starter','main',…`); data-model M10 + staff-workspace use **free-text Title-case** (`'Starter','Main',…`, "not an enum"). Direct contradiction — pick enum-vs-free-text and the casing.
   - **`menus` shape:** data-model M10 = one row per menu (`name, is_active, notes`); staff-workspace §5 = one row **per course slot** (`course, meal_period, sort_order`). Different cardinality.
   - **`courses` table:** couple-portal `couple_menu_selections.course_id` FKs a `courses` table that **no spec defines** (course is a text field elsewhere). Either add a `courses` table or change the selection key. Also `weddings.menu_id` (couple-portal §6.3) is referenced but defined nowhere.

5. **Floor-plan storage model (data-model M11 vs staff-workspace §7 vs venue-settings §4 vs couple-portal).** Per-wedding layout is modelled three ways: `floor_plans.canvas_json` **jsonb blob** (data-model), `floor_plans` + a normalized **`floor_plan_tables`** child (staff-workspace), and a **`floor_plan_seats`** table (couple-portal). Templates have the same split (`floor_templates.canvas_json` vs `floor_templates` + `floor_template_tables`). Choose jsonb-blob vs normalized-rows for both template and per-wedding, then unify the table names.

6. **Documents table name (staff-workspace §8 vs couple-portal §5.2).** Same concept, two names + two column sets: **`wedding_docs`** (staff-workspace: `kind`, `supplier_id`, `expiry_date`, `last_chased_at`, `file_path`) vs **`wedding_documents`** (couple-portal: `storage_path`, `uploaded_by`, `signed_at`, couple RLS). Merge into one table + name.

7. **Money units app-wide (venue-settings OQ-3 + data-model assumption 1).** Integer **minor units (pence)** vs `numeric(10,2)` major units. data-model assumes minor units everywhere; venue-settings §5/§6 uses `numeric(10,2)` for `packages.from_price` / `menu_items.price_per_head`; `weddings.total_value` differs by the same axis. Pick one convention (recommend minor-int to match existing `contacts.budget_minor`) before any pricing migration.

8. **Credential encryption mechanism (R7 / data-model OQ-1 / ghl-integration OQ-6 / venue-settings OQ-4).** App-layer AES-256-GCM (keyed by `GHL_TOKEN_ENCRYPTION_KEY`) vs Supabase `pgsodium`/Vault for `ghl_credentials.access_token`/`refresh_token`. Decide **before** the connect action stores a real token. (Column shape is agnostic, so this gates code, not the migration.)

### Blocks GHL go-live / multi-venue (not the local build)

9. **Win detection model (ghl-integration OQ-2).** Does the test sub-account model "Booked" as opportunity **status=won** or a named **stage**? Sets the webhook filter + the §5.2 confirm logic. (Mando.)
10. **WhatsApp Business approval on the TWM sub-account (R1 / ghl-integration OQ-4 / plan OQ-1).** If unapproved, Slice 6 **send** is SMS/email only (read still works). Confirm status.
11. **OAuth app + scopes timing (R2/R3 / ghl-integration OQ-1).** PIT works for the one test sub-account now; multi-venue production needs the OAuth marketplace app + the §10 scope set + refresh-concurrency handling. Schedule before GA.
12. **Per-location webhook registration (R4 / ghl-integration §4.5, A-2).** In PIT mode ingress is a GHL Workflow + shared-secret header (`x-vf-webhook-secret`); native RSA-signed webhooks only exist in the marketplace app. Confirm the PIT-phase Workflow setup with Mando.

### Product / UX (not blocking the first migrations)

13. **Standalone-mode scope (R6).** How much of the native CRM is supported/sold standalone vs bundled-only read-mirror.
14. **Onboarding wizard vs new setup checklist (venue-settings OQ-1).** Retire the M1-era `/onboarding` 3-step wizard or run it alongside the new gating checklist?
15. **Couple auth project isolation (couple-portal OQ-1 / data-model OQ-2).** Same Supabase project for staff + couples (RLS-isolated) or a separate project.
16. **Per-guest vs per-wedding meal choice (staff-workspace Q5 / couple-portal OQ-2).** `wedding_guests.meal_choice` jsonb vs a normalized `guest_meal_choices` join — affects `chosenBy` reporting.
17. **Smaller flagged items** that can ride along: `weddings.guest_count_finalised` flag (staff-workspace Q3); households denorm vs `households` table (Q4); run-sheet templates (Q7); default task-checklist source (Q8); `weddings.status` auto-advance vs manual (Q9, and the `cancelled` enum value is in data-model but missing from staff-workspace's inline list); `payment_milestones.status` enum-vs-text + a possible `pending_ghl` value (data-model OQ-6); floor-plan `canvas_version` (data-model OQ-4); contract e-sign native vs external link (couple-portal OQ-3); portal custom-domain vs shared path (couple-portal OQ-5); partner equal-write vs primary (couple-portal OQ-6); realtime multi-tab (couple-portal OQ-7).

---

## What Was Reconciled In-Place (for the record)

Small, unambiguous inconsistencies fixed directly during the coherence pass (the **schema/ground-truth authority** decided each):

- `auth_mode` → **`auth_type`** in data-model.md (matched ground truth + roadmap + ghl-integration).
- Couple-RLS helper unified to **`current_couple_wedding_ids()`** (plural `SETOF`) across couple-portal.md, matching data-model.md and the existing `current_venue_ids()` convention; all couple policies switched from `= …()` to `IN (SELECT …())`.
- venue-settings.md migration collision fixed: was `20260617000001_m7_venue_settings.sql` (collided with M8's timestamp + mislabeled `m7`); now points at the authoritative **`m9_venue_config`** (`20260618000001`) + **`m10_menu`** (`20260619000001`) per data-model.md. data-model.md's m9 row updated to list `floor_template_tables`, `custom_fields`, `invite_tokens`.
- venue-settings.md `ghl_credentials` DDL de-duplicated → points to the authoritative definition; its RLS corrected from "owner-only read+write" to **SERVICE-ROLE-ONLY**; stale "ghl-integration.md (to be written)" + "to be written" cross-refs updated to live spec sections.
- `weddings.custom_data` → **`weddings.custom`** in venue-settings.md (matched data-model M8).
- Staff-workspace Messages tab re-labeled GHL Phase 3 → **GHL Phase 2** (messaging is Phase 2; invoices are Phase 3).
- Broken `specs/venue-config.md` reference → **`specs/venue-settings.md`**.
- Proposal-builder demo path corrected to `preview/money/proposals/[id]/build/page.tsx` in data-model.md.
- `scopes` type aligned to `text[]` in ghl-integration §13.1 (matched data-model M7).
- Normative pointers added where feature specs sketch tables (staff-workspace `weddings`, couple-portal menu/floor refs) directing readers to the schema authority + this index for unresolved items. The `/v2/` GHL endpoint shorthand in staff-workspace/couple-portal now carries a note that ghl-integration §11 holds the real shapes.
