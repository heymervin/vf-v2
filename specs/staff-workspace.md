# Staff Workspace Spec — Wedding Workspace + Per-Wedding Planning Tools

**Status:** Draft for build. **Owner:** Mervin (builder) · advisors Kai + Trey.
**Scope:** The post-booking heart of VF2 — the real Weddings index, the Wedding Workspace hub, and the five per-wedding planning tools (Guests, Menu, Run sheet, Floor plan, Suppliers), plus the staff tasks/notes model and how the workspace borrows GHL surfaces without owning that data.

This is the largest spec. It is organised so **each planning tool is independently buildable and testable** (one page at a time — the D8 working model). Slices map to `BUILD-ROADMAP.md` Slice 2 (hub + trigger) and Slice 4 (planning tools).

**Reads from / depends on:**
- `specs/data-model.md` — all new table column lists + RLS live there; this spec references them and names them, but the migrations are specified there. Where a table is *introduced primarily by this feature*, the column list is given inline below and should be mirrored into the data-model spec.
- `specs/ghl-integration.md` — the opp-won trigger that creates a `weddings` row, and the Messages/Payments GHL surfaces.
- `specs/venue-settings.md` (Slice 3) — the venue libraries the planning tools draw from: `spaces`, floor templates, `menu_items`/`menus`, `suppliers` directory, packages.

> Convention note (`AGENTS.md`): this is Next.js 16 / React 19. `params` is a Promise (`await params`). Read `node_modules/next/dist/docs/` before writing route code. All Supabase reads/writes that touch GHL go server-side only.

---

## 0. Locked decisions this spec encodes

| # | Decision | Where it shows up |
|---|----------|-------------------|
| **D1** | Center of gravity = the Wedding Workspace | This whole spec; new build investment is here |
| **D5** | Gating — a tool stays locked until its prerequisite setup exists | Every tool subsection has a "Gating prerequisite" row |
| **D6** | GHL is optional — manual fallback everywhere | Weddings index has **Create wedding** (manual); no GHL needed to use any planning tool |
| **D7** | Planning-tool tabs are **scoped to one wedding** — they only appear inside a wedding context, never in the global left nav | Section 2 (hub nav) + Section 3 (every tool route nests under `/weddings/[id]`) |
| **D8** | Build internal/staff first, page-at-a-time, test each before moving on | Section 9 build order + per-tool test checklists |

---

## 1. Weddings index — `/(app)/weddings`

**Ports demo:** `src/app/(demo)/preview/weddings/page.tsx` + `weddings/weddings-client.tsx` (filter/search/sort + card list) and the `WeddingsClient` summary tiles (this month, awaiting numbers, balance due).

**Route:** `src/app/(app)/weddings/page.tsx` (server) → `weddings-client.tsx` (client list).

### What it shows
A live list of every booked wedding **scoped to the current venue** via RLS (`weddings.venue_id IN (select current_venue_ids())`). One card per wedding: couple name, date + days-to-go, space, guest count, payment progress bar, status badge, next-action one-liner.

### Data read
- `weddings` (filtered by `venue_id` through RLS) — the index does not need the heavy children; it reads the row + a derived payment summary.
- `payment_milestones` aggregated per wedding for the progress bar / "balance due" filter (or a `report_wedding_payments` view — see Open Question Q5).

### Filters (port the demo's saved lists)
| List id | Definition |
|---------|-----------|
| `all` | every non-archived wedding |
| `this_month` | `date` within the current calendar month |
| `awaiting_numbers` | guest count not finalised (see Q3) |
| `balance_due` | has any `payment_milestone` with status `due` or `overdue` |
Plus free-text search (couple name / space) and sort (date asc/desc, balance, paid %). All client-side over the venue-scoped result set — same as demo.

### Create-wedding fallback (D6)
A **Create wedding** button (top-right of `PageHeader`). Opens a sheet that creates a `weddings` row directly — no GHL required. Minimum fields: couple display name, date, space (`space_id` from `spaces`), guest count estimate, package (optional). On submit it inserts `weddings` (+ optionally a `couple_accounts` invite, reusing the same path the opp-won Inngest function uses). This is the standalone-mode path and the manual escape hatch when a booking happened off-platform.

### Empty state
Ported from demo: "No booked weddings yet." In **bundled mode** copy points at GHL ("when an opportunity is marked Won in GHL it appears here"); in **standalone mode** copy points at **Create wedding**. Mode comes from the venue flag (Q1).

---

## 2. Wedding Workspace hub — `/(app)/weddings/[id]`

**Ports demo:** `src/app/(demo)/preview/weddings/[id]/page.tsx` (652-line reference — status strip, next-action callout, planning rail, key facts, tasks, payments mini-summary) + `weddings/[id]/task-list.tsx`.

**Route:** `src/app/(app)/weddings/[id]/page.tsx`. `params` is a Promise → `const { id } = await params`.

This is the single most important screen. It is the **only place** the planning-tool nav appears (D7).

### Layout (top to bottom — keep the demo's order)
1. **Header** — couple name + `WeddingStatusBadge` (`src/components/status-badges.tsx`). Actions: link to the linked GHL contact (bundled mode), link to couple portal if `portal_active`.
2. **Couple meta strip** — days-to-go (big number), date, space, guest count, package, coordinator. Reuses derivation already in the demo.
3. **Next-action callout** — `NextActionCallout` (`src/components/next-action-callout.tsx`). Derived server-side by porting `deriveNextAction()` from the demo: priority order is **overdue payment → payment due → overdue task → task due ≤30d → upcoming payment ≤90d → all-clear**. This is the workspace's brain; keep the exact priority ladder.
4. **Status strip** — 4 cells: days-to-go, paid %, balance, tasks done + docs needed. Port `StatusStrip`.
5. **Planning rail** — the **scoped tool nav** (see below).
6. **Key facts + Tasks** two-column. Key facts = `weddings.key_facts` (jsonb label/value list). Tasks = interactive checklist (Section 7).
7. **Payments mini-summary** — progress bar + milestone list, "View all payments" → Money section. Read-only mirror of `payment_milestones` (and, in bundled mode, GHL invoice status — Section 8).

### The scoped planning-tool nav (D7)
The demo renders a horizontal **PlanningRail** of 5 tiles (Run-sheet, Floor plan, Guests, Menu, Suppliers), each with a live count. In the real app these become links to nested routes under the wedding, **not** global nav entries:

| Tile | Route | Count shown | Gated when… (D5) |
|------|-------|-------------|------------------|
| Guests | `/weddings/[id]/guests` | confirmed / invited | never (always available; empty list is fine) |
| Menu | `/weddings/[id]/menu` | courses selected | venue `menus`/`menu_items` library is empty |
| Run sheet | `/weddings/[id]/runsheet` | timeline items | never (starts blank or from template) |
| Floor plan | `/weddings/[id]/floorplan` | seated / total | the wedding's `space` has no floor template |
| Suppliers | `/weddings/[id]/suppliers` | suppliers attached | never (venue directory may be empty; can still add ad-hoc) |

A gated tile renders disabled with a short reason + a deep link to the setup it needs ("Add menu items in Settings → Menu"). Gating state is computed server-side in the hub loader so the rail reflects reality on first paint.

> **D7 enforcement:** these routes live under `(app)/weddings/[id]/*`. The global left nav (sidebar) must **not** list Guests/Menu/Runsheet/Floorplan/Suppliers as top-level items. They are reachable only from inside a wedding. The demo's standalone `/preview/guests` etc. (which use `primaryWedding()`) are the visual source but the real routes are wedding-scoped.

### Data the hub loads (one server query fan-out)
`weddings` row + `couple_accounts` (portal status) + counts from `wedding_guests`, `menu_item_selections`/`menus`, `timeline_events`, `floor_plans` (template presence), `wedding_suppliers`, `wedding_tasks`, `payment_milestones`. Counts only — the tool pages load their own detail.

---

## 3. New tables introduced primarily by this feature

These are the core workspace tables. **Column lists belong in `specs/data-model.md`**; given inline here because this feature owns them. All follow the standard tenant template unless noted.

### RLS template (from existing migrations — match exactly)
Helpers already exist in `supabase/migrations/20260611100000_tenancy_layer.sql`:
- `public.current_venue_ids()` → venues the user is a member of.
- `public.current_owner_or_admin_venue_ids()` → venues where role ∈ (owner, admin).

**Operational-data template** (staff need CRUD, like `contacts`/`opportunities` in M2 — this is what the planning tables use): every table has `venue_id uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE`; `created_at`/`updated_at timestamptz` with the shared updated-at trigger; RLS:
- SELECT: `venue_id IN (SELECT current_venue_ids())`
- INSERT/UPDATE/DELETE: `venue_id IN (SELECT current_venue_ids())` (members can write operational planning data).

**Admin-write template** (config/libraries — owners/admins only): writes gated on `current_owner_or_admin_venue_ids()`. Used by the venue libraries in Slice 3, referenced here.

Every child of a wedding also carries `wedding_id uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE` and is venue-scoped through `weddings`. FK-backing index on every FK (matches `idx_*_venue_id` convention).

### `weddings`
The hub record (one per booked couple). Ports the `Wedding` interface (`src/lib/mock/index.ts` L221).

> **Canonical column names live in [`specs/data-model.md`](./data-model.md) M8 — that spec is authoritative where the two disagree.** The inline list below is a feature-level sketch; data-model M8 currently uses `couple_name` (not `couple_display_name`), `coordinator_id` (not `coordinator_membership_id`), `custom` (not a separate column), and splits guest count into `guest_count_day`/`guest_count_evening`. Reconcile the open naming/shape diffs there before writing the migration (see SPECS-INDEX "decisions needing sign-off").

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `venue_id` | uuid FK venues | |
| `contact_id` | uuid FK contacts, null | links to the VF2 contact; `contacts.ghl_contact_id` carries the GHL link |
| `opportunity_id` | uuid FK opportunities, null | the won opportunity (bundled mode) |
| `couple_display_name` | text NOT NULL | e.g. "Henderson & Carter" |
| `wedding_date` | date | null until set |
| `space_id` | uuid FK spaces, null | drives floor-plan gating |
| `guest_count` | int | planning estimate; finalised flag — see Q3 |
| `status` | enum | `planning` \| `final_details` \| `this_week` \| `completed` (mock `Wedding.status`) |
| `package_id` | uuid FK packages, null | from venue library |
| `total_value` | numeric(12,2) | contract value (GBP) |
| `coordinator_membership_id` | uuid FK memberships, null | the `coordinatorId` in mock |
| `key_facts` | jsonb | `[{label,value}]` — ported from `Wedding.keyFacts` |
| `portal_active` | bool default false | |
| `portal_last_seen_at` | timestamptz null | |
| `created_at`/`updated_at` | timestamptz | |
| `ghl_opportunity_id` | text null | denormalised for the webhook idempotency check (also on `opportunities`) |

**`paid`** is NOT stored — it is derived from `payment_milestones`. `proposal`, `payments`, `docs`, `runsheet`, `guests`, `menu`, `suppliers` from the mock become their own tables below (the mock flattened them into one object for the prototype).
RLS: operational template. **Plus** a service-role INSERT path for the Inngest opp-won function (it runs as service role, bypasses RLS).

### `couple_accounts`
Portal end-users. Detailed in `specs/data-model.md` (also used by Slice 8 portal). Minimal here: `id`, `venue_id`, `wedding_id`, `email`, `display_name`, `role` (`partner_a`/`partner_b` — see ground-truth terminology), `invited_at`, `activated_at`, `magic-link auth` fields. The hub reads `portal_active`/`portal_last_seen_at` from the wedding (mirrored) or joins this table.

### `wedding_tasks`
Ports `WeddingTask` (mock L213). See Section 7.

### `wedding_notes`
Free-form staff notes. See Section 7. (New — not in mock; mock had no notes model. Flagged as an addition.)

### Planning-tool tables (one per tool, detailed in their sections)
`wedding_guests`, `menus` + `menu_items` + `menu_item_selections`, `timeline_events`, `floor_plans` (+ table/seat data), `suppliers` (venue directory) + `wedding_suppliers`. Plus `payment_milestones` (Money slice, summarised on the hub).

---

## 4. Guests — `/(app)/weddings/[id]/guests`

**Ports demo:** `src/app/(demo)/preview/guests/page.tsx` + `guests/GuestTable.tsx` (searchable/filterable/sortable/selectable table) and the stat cards + dietary breakdown.

**Gating prerequisite (D5):** none. Always available. An empty guest list is a valid starting state ("Add your first guest").

### Reads / writes
**Table: `wedding_guests`** — ports `Guest` (mock L149).

| Column | Type | From mock |
|--------|------|-----------|
| `id` | uuid PK | |
| `venue_id`/`wedding_id` | uuid FK | |
| `name` | text NOT NULL | `name` |
| `side` | enum `partner1`/`partner2`/`both` | `side` |
| `rsvp` | enum `yes`/`no`/`pending` default `pending` | `rsvp` |
| `dietary` | text[] | `dietary` (e.g. `{Vegetarian}`, `{Nut allergy}`) |
| `plus_one` | bool default false | `plusOne` |
| `plus_one_name` | text null | `plusOneName` |
| `tags` | text[] | `tags` |
| `household_id` | uuid null (self-ref or `households` table — Q4) | `householdId` |
| `household_name` | text null | `householdName` |
| `session_type` | enum `day`/`evening`/`ceremony_only` default `day` | `sessionType` |
| `rsvp_chased_at` | timestamptz null | `rsvpChasedAt` |
| `table_number` | int null | `table` — links to floor plan (Section 6) |
| `seat_index` | int null | `seatIndex` |
| `meal_choice` | jsonb null `{starter,main,dessert}` | `mealChoice` — links to menu (Section 5) |

### Interactions (port from `GuestTable`)
Add/edit/delete guest (inline sheet); search by name; filter by side/rsvp/session; sort; bulk-select for bulk actions (assign table, mark RSVP, chase). **Stat cards:** total invited, RSVP yes, pending, **needs table** (confirmed but `table_number IS NULL`). **Dietary breakdown:** computed from `dietary[]` counts — same `buildDietaryBreakdown` logic.

### Cross-tool links (load-bearing)
- `table_number` / `seat_index` → **Floor plan** seating (Section 6).
- `dietary[]` → **Menu** allergen rollup (Section 5).
- `meal_choice` → **Menu** per-guest selections.
This is why Guests is built **first** among the tools — Menu and Floor plan both read from it.

### Test checklist
- [ ] Only this venue's + this wedding's guests appear (RLS + `wedding_id` filter).
- [ ] Add/edit/delete persists; optimistic UI then server confirm.
- [ ] "Needs table" count = confirmed guests with null `table_number`.
- [ ] Dietary breakdown matches a hand-count of `dietary[]`.
- [ ] Assigning a table in Floor plan updates the guest's "needs table" state here.

---

## 5. Menu — `/(app)/weddings/[id]/menu`

**Ports demo:** `src/app/(demo)/preview/menu/page.tsx` + `menu/menu-client.tsx` (course breakdown, dish rows, `chosenBy` mini-bars, allergen rollup, guest drill-down).

**Gating prerequisite (D5):** **locked until the venue `menu_items` library has at least one active item.** Per-wedding menus are *built from* the library; with no items there is nothing to choose. Gated tile deep-links to Settings → Menu.

### Items → Menus architecture (D4 — endorsed on the call, Sonas pattern)
Two-level model. Editing one **item** updates it everywhere it is used.

```
menu_items (venue library)  ──< menu_item_selections (join, per wedding) >──  menus (per wedding, grouped by course)
        ▲ ports MenuLibraryItem (admin.ts L57)                                    ▲ ports MenuCourse (index.ts L184)
```

**Table: `menu_items`** (venue library, admin-write template — built in Slice 3 venue-config, *read* here). Ports `MenuLibraryItem`:
`id, venue_id, course (text — Starter/Main/Dessert/Children/Evening), name, description, allergens text[], dietary text[], price_per_head numeric, photo_path text null, is_active bool, sort_order`.

**Table: `menus`** (per wedding) — ports the `MenuCourse` grouping. Either a thin row per (wedding, course, meal_period) or a single `menus` row per wedding with course structure. Recommended: one `menus` row per **course slot** the couple is filling:
`id, venue_id, wedding_id, course text, meal_period enum (wedding_breakfast/evening/canapés), sort_order, is_active`.

**Table: `menu_item_selections`** (the join — what this wedding actually serves, and who chose what). Ports `MenuOption.chosenBy` / `guestIds`:
`id, venue_id, wedding_id, menu_id (FK menus), menu_item_id (FK menu_items), price_per_head_override numeric null, sort_order`.
Per-guest choice lives on `wedding_guests.meal_choice` (jsonb) **or** an optional `guest_meal_choices(guest_id, selection_id)` join if we need normalised per-guest counts — see Q6. `chosenBy` in the demo = count of guests whose `meal_choice` points at this selection.

### Allergen rollup (auto-computed — keep the demo's exact semantics)
Port `buildAllergenRollup()` from `menu-client.tsx`:
- For each selected item, sum `chosenBy` (guests who picked it) per allergen in `menu_items.allergens`.
- **Denominator is total guest count (unique guests), not total selections** (a guest picking two allergen dishes counts once per allergen, not inflated). The demo's comment L78–80 is the rule of record.
- Output: `{allergen, count, pct}` sorted desc. Surfaced as amber chips. This is what the kitchen reads.

Cross-check against `wedding_guests.dietary[]` (declared needs) so staff see **declared dietary vs. what the chosen dishes actually contain** — the gap is the risk.

### Interactions
- Pick items from the library into each course (the join inserts).
- Editing a library item (price, allergens) reflects in every wedding using it (D4) — because selections reference `menu_item_id`, not copies.
- `chosenBy` populates from guests' `meal_choice`; live mini-bars per option.
- Guest drill-down: click an option → list guests who chose it.

### Test checklist
- [ ] Tool is locked with zero library items; unlocks when one active item exists.
- [ ] Selecting a library item creates a `menu_item_selections` row scoped to this wedding.
- [ ] Editing a library item's allergens updates the rollup in an existing wedding (no copy drift).
- [ ] Allergen rollup denominator = unique guest count, not selection count.
- [ ] Declared `dietary[]` vs dish allergens gap is visible.

---

## 6. Run sheet / Timeline — `/(app)/weddings/[id]/runsheet`

**Ports demo:** `src/app/(demo)/preview/runsheet/page.tsx` + `runsheet/runsheet-client.tsx` (planning mode + **Event-Day mode** with live clock, now/next strip, check-off rows, supplier-checked-in board).

**Gating prerequisite (D5):** none. Starts blank or seeded from a venue run-sheet template (Q7). Tablet-first in Event-Day mode, 44px+ touch targets (per the demo's DESIGN note).

### Reads / writes
**Table: `timeline_events`** — ports `RunsheetItem` (mock L134).

| Column | Type | From mock |
|--------|------|-----------|
| `id` | uuid PK | |
| `venue_id`/`wedding_id` | uuid FK | |
| `event_time` | time | `time` ("14:00") |
| `title` | text NOT NULL | `title` |
| `owner` | text | `owner` (who runs it) |
| `duration_min` | int | `durationMin` |
| `category` | enum | `ceremony`/`reception`/`catering`/`supplier`/`logistics` |
| `done` | bool default false | `done` (Event-Day check-off) |
| `supplier_id` | uuid FK wedding_suppliers null | `supplierId` |
| `notes` | text null | `notes` |
| `sort_order` | numeric | fractional sort for reorder |

### Interactions
- Planning mode: add/edit/reorder/delete items; assign owner + supplier; set durations.
- Event-Day mode: live clock drives **now / next**; tap a row to mark `done`; supplier check-in board (reads `wedding_suppliers.checked_in_at`).
- Filter by category.

### Test checklist
- [ ] Items persist + reorder via `sort_order`.
- [ ] Event-Day now/next reflects current time vs `event_time`.
- [ ] Marking done persists and updates the done-count board.
- [ ] Supplier-linked rows reflect check-in state from Suppliers.

---

## 7. Floor plan — `/(app)/weddings/[id]/floorplan`

**Ports demo:** `src/app/(demo)/preview/floorplan/page.tsx` + `floorplan/FloorplanClient.tsx` (spatial canvas, shaped tables, assign-from-unassigned-pool, dietary overlay, list view) using `src/lib/mock/planning.ts` (`FloorplanTable`, `RoomElement`) and `src/components/floorplan/shaped-table.tsx` (reusable, keep).

**Gating prerequisite (D5):** **locked until the wedding's `space` has a saved floor template.** The floor plan *starts from* the template set in **Settings → Spaces → [space] → Floor** (demo `admin/spaces/[id]/floor`). No template → nothing to seat onto. Gated tile deep-links there.

### From template to per-wedding plan
1. Venue config (Slice 3) defines **floor templates** per space — ports `FloorTemplate` (admin.ts L37) + the placed-table layout (`FloorplanTable` shape/capacity/x/y, `RoomElement` fixed stage/bar/dancefloor/entrance).
2. On first open, this wedding **instantiates a `floor_plans` row from the chosen template** (copies tables + room elements as the starting layout). Staff then tweak per-wedding without touching the template.

**Table: `floor_plans`** (per wedding) + **`floor_plan_tables`** (placed tables):
- `floor_plans`: `id, venue_id, wedding_id, space_id, template_id (FK), name, created_at`.
- `floor_plan_tables`: ports `FloorplanTable` — `id, floor_plan_id, table_number int, shape enum (round/banquet/square/top), capacity int, x numeric, y numeric (0–100 %), label text null`.
- **Room elements** (stage/dancefloor/bar/entrance) are fixed properties of the **template** (space-level), not per-wedding — read from the template. Ports `RoomElement`.

### Seating links to guests (load-bearing)
Guest seating writes back to **`wedding_guests.table_number`** (and `seat_index`). The floor plan does not own guest identity — it assigns existing `wedding_guests` to `floor_plan_tables.table_number`. The "unassigned pool" = `wedding_guests` with `rsvp != 'no'` and `table_number IS NULL` (port `isUnassigned`). Assign flow: select unassigned guest → click table → set `table_number` (optimistic + toast).

**Dietary overlay** tints seats whose guest has non-empty `dietary[]` — reads `wedding_guests.dietary`.

### Test checklist
- [ ] Tool locked until the space has a floor template; unlocks after.
- [ ] First open clones the template into a `floor_plans` row (tables copied).
- [ ] Assigning a guest sets `wedding_guests.table_number`; Guests "needs table" count drops.
- [ ] Over-capacity table is flagged (seated > `capacity`).
- [ ] Dietary overlay matches `dietary[]`.

---

## 8. Suppliers — `/(app)/weddings/[id]/suppliers`

**Ports demo:** `src/app/(demo)/preview/suppliers/page.tsx` + `suppliers/suppliers-client.tsx`, using `src/lib/mock/suppliers.ts` (`PREFERRED_SUPPLIERS` — venue directory) and `Supplier` (mock L196 — per-wedding attached supplier) and `WeddingDoc` for the docs tab.

**Gating prerequisite (D5):** none. The venue **suppliers directory** may be empty; staff can still attach an ad-hoc supplier to a wedding. (The directory is a convenience, not a hard prerequisite.)

### Two tables — directory vs per-wedding
**Table: `suppliers`** (venue directory — admin-write template, built in Slice 3, *read* here). Ports `PreferredSupplier` (suppliers.ts):
`id, venue_id, name, category, contact_name, email, phone, website, notes, venue_approved bool, tags text[], avg_rating numeric null`.

**Table: `wedding_suppliers`** (this wedding's actual suppliers — operational template). Ports `Supplier` (index.ts L196):
`id, venue_id, wedding_id, directory_supplier_id (FK suppliers null — null = ad-hoc), name, category, contact_name, phone, email null, website null, status enum (confirmed/pending/enquired/declined), arrival_time time null, checked_in_at timestamptz null, notes null, tags text[], doc_count int (or derive)`.

Attaching from the directory copies snapshot fields into `wedding_suppliers` but keeps `directory_supplier_id` for traceability.

### Docs
`wedding_docs` (ports `WeddingDoc`, mock L122): `id, venue_id, wedding_id, name, kind enum (contract/insurance/invoice/supplier/other), status enum (signed/sent/draft/received/missing), supplier_id (FK wedding_suppliers null), expiry_date date null, last_chased_at timestamptz null, file_path, updated_at`. The Suppliers screen's docs tab filters `wedding_docs` where `kind='supplier'`; the hub's "docs needed" count uses status `missing`/`draft`.

### Interactions
Add supplier (from directory or ad-hoc); set status, arrival time; mark checked-in (feeds run sheet); attach/track docs (e.g. supplier PLI insurance with `expiry_date`).

### Test checklist
- [ ] Directory list scoped to venue (RLS).
- [ ] Attaching a directory supplier creates a `wedding_suppliers` row with `directory_supplier_id`.
- [ ] Ad-hoc supplier (no directory link) works.
- [ ] `checked_in_at` shows on the run sheet supplier board.
- [ ] Missing/expiring docs surface in the hub status strip.

---

## 9. Staff tasks & notes

### Tasks — `wedding_tasks`
Ports `WeddingTask` (mock L213) + the interactive `task-list.tsx`.
`id, venue_id, wedding_id, label text, done bool default false, due_date date null, category enum (money/planning/suppliers/admin), assignee_membership_id uuid null, sort_order, created_at`.

- Rendered on the hub (Section 2) and toggled via the ported `TaskList` client component (optimistic check-off, then server write).
- **Auto-seeded on wedding creation:** the demo's empty-state copy says "tasks are created automatically when you move a couple to Wedding booked." Real behaviour: the opp-won Inngest function (or the manual create-wedding path) seeds a **default task checklist** for the venue. Default set is a venue-config concern (Q8) — start with a hardcoded sensible list (deposit chase, send portal invite, collect final numbers, menu tasting, final payment).
- Tasks feed the **next-action** ladder (overdue task / task due ≤30d).

### Notes — `wedding_notes`
**New (not in mock).** Free-form staff notes pinned to a wedding (and optionally to a tool context).
`id, venue_id, wedding_id, author_membership_id, body text, pinned bool default false, context text null (e.g. 'guests'/'menu'/'general'), created_at`.
- Internal-only — **never** shown to the couple (separate from portal content, separate from GHL messages).
- Surfaced in a hub side panel / per-tool note affordance. Operational RLS template; `author_membership_id` for attribution.

> **Tasks vs Notes:** tasks are actionable + dated + completable; notes are context. Keep them separate tables.

---

## 10. Relationship to GHL surfaces (workspace borrows, never owns)

The workspace **renders** two GHL-owned data surfaces but stores none of that data locally (per `GHL-BACKEND-PLAN.md` and CLAUDE decisions D3). Both are *tabs/links from the hub*, built in later slices.

> **Endpoint shapes are normative in [`specs/ghl-integration.md`](./ghl-integration.md) §11**, not here. The `/v2/...` paths and dotted event names below are the ground-truth *shorthand*; the real GHL base has no `/v2` segment, the send endpoint is `POST /conversations/messages` with `contactId` in the body, and event types are PascalCase (`InboundMessage`, not `conversation.message.received`). Do not copy these strings verbatim — follow §11.

### Messages tab (Slice 6 — GHL Phase 2)
- Reachable from the hub ("Inbox thread" / Messages). Pulls `GET /v2/conversations?contactId={ghl_contact_id}` and `.../messages` server-side via `ghlClient(venueId)`.
- **Read first, send second, realtime third.** Sending posts to GHL; inbound `conversation.message.received` webhook → Supabase Realtime → live UI.
- **No message rows in VF2.** The wedding only stores `contacts.ghl_contact_id` (the link). In standalone mode (no GHL) the tab is hidden/disabled.

### Payments tab (Slice 5 — GHL Phase 3 invoices)
- The hub's payments mini-summary reads VF2 **`payment_milestones`** (the planning/schedule of money — VF2-owned) for the schedule + status badges.
- The **invoice send + paid status** is GHL: `POST /v2/invoices`, `GET /v2/invoices/{id}`, `.../send`. Statuses map to Awaiting Deposit / Deposit Paid / Balance Due / Paid in Full.
- So: **VF2 owns the milestone schedule; GHL owns the invoice + payment collection.** The hub shows both — milestone (local) annotated with GHL invoice status (fetched). No couple-facing Stripe here (bank transfer norm).
- In standalone mode `payment_milestones` stand alone (manually marked paid).

> **The rule:** anything the workspace *needs to plan* (milestones, tasks, the schedule) is a VF2 table. Anything that is *a conversation or a payment transaction* stays in GHL and is fetched live. The wedding row is the join point via `contact_id` → `ghl_contact_id`.

---

## 11. Build order within this area (D8 — page at a time, test each)

Maps to roadmap Slice 2 (hub) then Slice 4 (tools). Each step ships behind real data and is tested before the next.

| Order | Build | Depends on | Why this order |
|-------|-------|-----------|----------------|
| 1 | `weddings` table + Weddings index + manual **Create wedding** (D6) | venues, spaces, packages | Need a real wedding to open before any tool exists |
| 2 | Wedding Workspace **hub** (status strip, next-action, key facts) with tools **stubbed/gated** | `weddings`, `wedding_tasks` | The shell + the scoped nav (D7); proves gating |
| 3 | `wedding_tasks` + `TaskList` (interactive) + auto-seed on create | hub | Feeds next-action; small + self-contained |
| 4 | **Guests** (`wedding_guests`) | hub | First tool; Menu + Floor plan both read it |
| 5 | **Menu** (`menu_items` read, `menus`, `menu_item_selections`, allergen rollup) | Guests (for `chosenBy`), venue menu library (Slice 3) | Gated on library; reads guest meal choices |
| 6 | **Run sheet** (`timeline_events`, Event-Day mode) | hub | Independent; reads `wedding_suppliers` for check-in |
| 7 | **Floor plan** (`floor_plans`/`floor_plan_tables` from template) | Guests (seating), floor templates (Slice 3) | Gated on template; writes `wedding_guests.table_number` |
| 8 | **Suppliers** (`suppliers` read, `wedding_suppliers`, `wedding_docs`) | venue directory (Slice 3) | Feeds run sheet check-in + hub docs count |
| 9 | `wedding_notes` | hub | Lightweight; can slot in anytime after the hub |
| 10 | GHL Messages tab (Slice 6) / Payments invoice status (Slice 5) | `ghlClient`, `ghl_credentials` | Later slices; workspace already useful without them |

**Global test gate per tool:** (a) venue isolation (RLS — another venue's data never appears), (b) wedding isolation (`wedding_id` filter), (c) gating shows/clears correctly, (d) cross-tool writes propagate (guest table → floor plan → run sheet supplier), (e) works in standalone mode with no GHL connected.

---

## 12. Open decisions (flagged, not guessed)

- **Q1 — Mode flag.** What exactly is the per-venue bundled/standalone switch? CLAUDE.md names `venues.ghl_enabled` *or* a mode setting. This spec assumes a single boolean/enum on `venues`; the index empty-state + Messages/Payments visibility key off it. **Resolve in `specs/data-model.md`.**
- **Q2 — `paid` derivation vs cache.** `paid` is derived from `payment_milestones` for correctness, but the index + hub need it cheaply across many weddings. Decide: a `report_wedding_payments` view (preferred, matches existing `report_*` view pattern) vs a maintained `weddings.paid_cached`. Spec assumes the **view**.
- **Q3 — "Awaiting numbers" / final guest count.** The index filter and `guest_count` need a "numbers finalised" flag. Add `weddings.guest_count_finalised bool` or derive from RSVP completeness? Unresolved.
- **Q4 — Households.** Mock has `householdId`/`householdName` on guests. Keep as denormalised columns on `wedding_guests` (simplest, assumed) or a `households` table? Assumed denormalised for now.
- **Q5 — Per-guest meal choice normalisation.** `wedding_guests.meal_choice` jsonb (assumed, matches mock) vs a normalised `guest_meal_choices` join. The jsonb is simpler but `chosenBy` counts require a per-selection rollup query. Revisit if menu reporting gets heavy.
- **Q6 — Floor template instancing.** Clone template → `floor_plans` on first open (assumed) vs reference the template live. Cloning lets staff tweak per-wedding without breaking the template — assumed correct; confirm with Kai/Trey.
- **Q7 — Run-sheet templates.** Should venues save reusable run-sheet templates (like floor templates) to seed `timeline_events`? Not in scope for Slice 4; flag for venue-config (Slice 3) follow-up.
- **Q8 — Default task checklist source.** Auto-seeded tasks: hardcoded list (assumed for v1) vs a venue-configurable task-template library. Start hardcoded; promote to config later.
- **Q9 — Status auto-advance.** `weddings.status` (planning → final_details → this_week → completed): auto-derived from `wedding_date` proximity, or manual? Assumed **auto from date** for `this_week`/`completed`, manual for `final_details`. Confirm.

---

## 13. Assumptions made

1. The `specs/data-model.md` and `specs/ghl-integration.md` companion specs exist (or will) and own the full migrations + the opp-won trigger; this spec names tables/columns and the RLS template but defers migration authorship there.
2. All planning tables use the **operational RLS template** (members CRUD), matching `contacts`/`opportunities` in M2 — staff need to edit planning data, not just owners/admins. Venue **libraries** (`menu_items`, `suppliers` directory, floor templates, packages) use the **admin-write template** and are built in Slice 3.
3. `params` is awaited (Next 16). All routes nest under `(app)/weddings/[id]/*` to enforce D7. Demo standalone routes (`/preview/guests` etc.) are visual reference only and are retired per-feature as the real version ships.
4. The demo's `primaryWedding()` single-wedding assumption is replaced by real `wedding_id`-scoped loaders everywhere.
5. Reusable components survive the port: `PageHeader`, `NextActionCallout`, `WeddingStatusBadge`/`status-badges`, `floorplan/shaped-table`, `sortable-table`, `Progress`, `Card`. No need to rebuild them.
6. GBP currency + UK conventions (`gbp()` helper) carry over.
7. `paid` and the payment progress are read-only on the hub; the Money slice (Slice 5) owns milestone editing + GHL invoice integration.
