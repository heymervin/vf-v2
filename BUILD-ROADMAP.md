# VenueFlow v2 — Master Build Roadmap

> **The single source of truth for how VF2 goes from mockup to a real, GHL-backed product.**
> Open this first. It explains the strategy, the two-system model, the architecture fork and how it
> resolves, and the slice-by-slice build order. Detail lives in the per-area specs (see the
> [Spec Pointer Table](#spec-pointer-table)); this doc links to them, it does not duplicate them.
>
> **Audience:** Kai + Trey (skim the prose, the tables, and the "Testable when done" rows) and
> Mervin (build from the file paths, table names, and RLS notes).
>
> Source decisions: June 16 team call. Authoritative integration detail: [`GHL-BACKEND-PLAN.md`](./GHL-BACKEND-PLAN.md).

---

## Build Status (as of 2026-06-19)

**All 8 slices implemented and green.** Migrations m7–m14 applied; full suite passing:
typecheck ✓ · 348 unit tests ✓ · lint 0 errors ✓ · **99 Playwright e2e ✓** · RLS cross-tenant 149/149 ✓.

| Slice | State | Notes |
|---|---|---|
| 1 Foundation | ✅ Done | `ghl_credentials`, `ghlClient`, connect tile, live read. m14 added the missing `ghl_webhook_events` table + `location_id` NOT NULL/unique + partial-unique GHL link indexes. |
| 2 Trigger (spine) | ✅ Done | opp-won → wedding + couple invite; manual-create fallback. m14/code added the **confirm-opportunity double-gate** (`getOpportunity`) and the **magic-link invite** (`inviteUserByEmail`). |
| 3 Config / libraries | ✅ Done | spaces, floor templates, menu library, packages, team, custom fields; gating checklist. |
| 4 Planning tools | ✅ Done | guests, menu, run sheet, floor plan, suppliers. Fixed a real edit bug (`updateEvent` validation + `HH:MM:SS` time). |
| 5 Money | ✅ Done | proposals, milestones, GHL invoice mirror. Fixed `discount_type` CHECK (`pct`→`percentage`). |
| 6 Messaging mirror | ✅ Done | GHL conversations read/send + realtime broadcast; no message storage in VF2. |
| 7 Intelligence | ✅ Done | Daily Brief Inngest fn + email template; real `(app)/copilot` over live data; Reports gains live GHL pipeline counts. |
| 8 Couple portal | ✅ Done | magic-link auth (`/portal/auth/magic-link` + `/portal/login`), couple-only RLS, real data, couple write actions (guests/menu), RLS-isolation e2e. |

> ⚠️ **DB note:** the canonical Supabase project `kcnsywedplpliqfryejg` was behind at M6; m7–m14 were applied to bring it current (42 tables). Migrations are applied via direct `psql` to the pooler (`aws-1-ap-southeast-1`), not `db push` (the `schema_migrations` ledger is stale). External prerequisites for full production behaviour remain venue-side: real GHL PIT/OAuth, Resend domain verification, Stripe keys.

---

## Executive Summary

VF2 used to be trying to **replace** GoHighLevel (GHL) — rebuilding lead capture, nurture
sequences, the sales pipeline, and WhatsApp messaging from scratch. That fight is over. As of the
June 16 call, **VF2 stops replacing GHL and starts using GHL as its backend.** GHL keeps doing what
it already does well — pre-sales: capturing leads, nurturing them, running the pipeline, booking
viewings, and handling WhatsApp/SMS/email and invoicing. VF2 becomes the clean, purpose-built
**post-booking product** on top: the Wedding Workspace, planning tools (guests, menu, run sheet,
floor plan, suppliers), the couple portal, and venue configuration. The bridge between the two is a
single event: when an opportunity is marked **Won** in GHL, a webhook fires, and VF2 creates a real
**wedding** and invites the couple. Everything below sequences the work to get there safely, one
testable slice at a time.

---

## The Two-System Model

GHL owns everything before the booking. VF2 owns everything after. They meet at exactly one trigger.

```
        PRE-SALES  (GHL / VenueFlow CRM)                POST-BOOKING  (VF2 — native)
   ────────────────────────────────────────       ────────────────────────────────────────
   Lead capture → nurture sequences                Wedding Workspace  (the hub record)
   Sales pipeline (stages, win/loss)               Guests · Menu · Run sheet · Floor plan
   WhatsApp / SMS / email threads                  Suppliers · Staff tasks & notes
   Viewings / appointments (pre-booking)           Proposals & payment milestones
   Invoicing + payment collection                  Couple portal (magic-link self-service)
   ────────────────────────────────────────       ────────────────────────────────────────
                       │
                       │   TRIGGER  ──  opportunity marked WON / "Booked" stage
                       ▼
        GHL webhook (opportunity.updated, HMAC-signed)
                       │
                       ▼
        VF2  src/app/api/webhooks/ghl/route.ts
                       │
                       ▼
        Inngest  ghl/opportunity-won
          ├─ GET /v2/contacts/{id}            (fetch couple details)
          ├─ INSERT weddings                   (the new hub record)
          ├─ INSERT couple_accounts            (portal end-users)
          └─ Resend portal invite email
```

**Rule of thumb:** cold or warm lead → GHL. Booked couple planning their day → VF2. VF2 *surfaces*
GHL data via server-side API calls (contacts, conversations, invoices, pipeline counts); it never
re-implements what GHL already does, and it never bulk-mirrors GHL data into Supabase.

**Auth boundary:** every GHL call is server-side, through one helper — `ghlClient(venueId)` in
`src/lib/ghl/client.ts` — which reads credentials from the `ghl_credentials` table. A **Private
Integration Token (PIT)** for the single test sub-account powers this *now*; the same helper swaps to
an **OAuth marketplace app** for multi-venue production *later*. The swap is backend-only: no caller
changes. Header on every request: `Version: 2021-07-28`, base `services.leadconnectorhq.com`.

---

## Current State: Built vs Mockup vs Discarded

### Already built — real staff routes (wired to Supabase, `(app)` group)

These are live against the M1–M6 migrations and stay. In bundled mode some get demoted (see [D2](#the-architecture-decision-d2--fate-of-the-native-crm)).

| Route | What it is | Fate in GHL-bundled mode |
|---|---|---|
| `src/app/(app)/dashboard/page.tsx` | Data-light landing | Kept; evolves toward Daily Brief (Slice 7) |
| `src/app/(app)/pipeline/page.tsx` | Native kanban over `opportunities` | **Demoted** to read-mirror of GHL pipeline |
| `src/app/(app)/contacts/page.tsx` + `contacts/[id]/page.tsx` | Native CRM over `contacts` | **Demoted** to read-mirror; GHL is primary |
| `src/app/(app)/appointments/page.tsx` | Calendar over `appointments` / `availability_rules` | Kept (native; pre-booking viewings can still live here in standalone) |
| `src/app/(app)/reports/page.tsx` | Reports from `report_leads_by_stage` / `report_leads_by_source` views | Kept; gains live GHL data (Slice 7) |
| `src/app/(app)/settings/page.tsx` + `forms` / `brochure` / `sequences` / `availability` / `billing` | Venue settings | Kept; **GHL connect tile added** here (Slice 1) |
| `/login` `/signup` `/callback` | Supabase auth | Kept |

> Note: the brief references `/onboarding` as a built 3-step wizard; it is **not** present in
> `src/app/(app)` today. Treat the onboarding/setup-checklist experience as **net-new** work in
> Slice 3 (the gating checklist, D5), not a port. *(Assumption — flag if a hidden onboarding route exists.)*

### Mockup — the visual reference to port (`(demo)/preview/*`, seeded from `src/lib/mock/*`)

These are fully designed and seeded but fake. Each is the **design source** for a real feature. Keep
them until the real feature replaces them.

| Demo screen (file) | Becomes (real feature) | Slice |
|---|---|---|
| `preview/page.tsx` | Staff overview / home | 2 |
| `preview/weddings/page.tsx` | Real Weddings index | 2 |
| `preview/weddings/[id]/page.tsx` | **Wedding Workspace hub** (center of gravity, D1) | 2 |
| `preview/admin/page.tsx` (+ `spaces`, `spaces/[id]/floor`, `team`, `menu`, `packages`, `custom-fields`) | Real venue config / libraries | 3 |
| `preview/guests/page.tsx` | Per-wedding guest list | 4 |
| `preview/menu/page.tsx` | Per-wedding menu (pulls from library) | 4 |
| `preview/runsheet/page.tsx` | Run sheet / timeline | 4 |
| `preview/floorplan/page.tsx` | Floor plan tool | 4 |
| `preview/suppliers/page.tsx` | Suppliers (directory + per-wedding) | 4 |
| `preview/money/page.tsx` + `money/proposals/[id]/build/page.tsx` | Proposal builder + payment milestones | 5 |
| `preview/copilot/page.tsx` | Copilot insights | 7 |
| `preview/reports/page.tsx` | Reports refresh over live data | 7 |
| `(portal)/portal/page.tsx` | Couple portal | 8 |

Mock data files that back these: `src/lib/mock/{index,admin,crm,planning,proposals,reports-data,suppliers}.ts`.

### Discarded — delegated to GHL or demo-only

Do not build real versions; these are GHL's job or were demo scaffolding:

- `preview/contacts/page.tsx` + `contacts/[id]/page.tsx` — GHL owns contacts (read-mirror only; native CRM at `(app)/contacts` is the standalone fallback)
- `preview/pipeline/page.tsx` — GHL owns the sales pipeline
- `preview/inbox/page.tsx` + `preview/admin/messaging/page.tsx` — GHL owns messaging; VF2 mirrors via Slice 6, no native inbox
- the public `/` landing demo — marketing, out of scope for the product build

---

## The Architecture Decision (D2) — Fate of the Native CRM

**This is the one fork that needs explicit sign-off.** VF2 already has a working native pre-sales CRM
(`(app)/pipeline`, `(app)/contacts`, `(app)/reports`) over real Supabase tables (`contacts`,
`opportunities`, `stage_events`). The GHL-as-backend model makes GHL the primary pre-sales engine —
so what happens to the native CRM?

**Decided (D2): do NOT delete it. Keep it as the standalone-mode fallback, gated by a per-venue mode flag.**

| Mode | Pre-sales lives in | Native CRM routes behave as | Selected by |
|---|---|---|---|
| **Bundled** (TWM venues with a GHL sub-account) | GHL | Low-priority **read-mirror** of GHL (contacts/pipeline shown but GHL is source of truth) | mode flag = bundled |
| **Standalone** (VF2 sold without GHL) | VF2 native tables | Full CRUD CRM as built today | mode flag = standalone |

**The flag.** A per-venue setting selects behavior. **Open decision: exact shape.**
Two candidates:
- `venues.ghl_enabled boolean` (simplest), or
- a `venues.mode text CHECK (mode IN ('bundled','standalone'))` column (more explicit, room to grow).

> **DECISION NEEDED (sign-off):** name + shape of the mode flag, and **the default for a new venue.**
> Recommendation: add `venues.mode text NOT NULL DEFAULT 'bundled'` — explicit, future-proof, and
> defaults to the path we're actually building (GHL-backed). Standalone is the fallback, not the default.
> Detail and the read-mirror contract live in [`specs/ghl-integration.md`](./specs/ghl-integration.md).

**Why this matters for the build:** the mode flag is read in Slice 1 (does the GHL connect tile even
show?) and gates the opp-won trigger vs. manual-create fallback in Slice 2 ([D6](#cross-cutting-principles)).
It must exist before Slice 2 ships.

---

## How the WhatsApp Blocker Is Resolved (D3)

WhatsApp was the project's biggest technical blocker: replacing GHL meant VF2 would have to obtain
its own **WhatsApp Business API** access — a slow, gated, expensive approval process per venue.

**D3 — solved by architecture, not by paperwork.** Because pre-sales messaging stays **entirely in
GHL**, VF2 never has to obtain WhatsApp API access at all. GHL already holds the venues' WhatsApp/SMS
channels. Post-booking messaging is a **read-first mirror** of GHL conversations surfaced inside the
Wedding Workspace (Slice 6): VF2 is the UI, GHL does the delivery. Implementation order within that
slice is deliberately **read → send → realtime**, and *no messages are ever stored in VF2* — GHL is
the record of truth, VF2 just renders it.

Net effect: the blocker is removed from the critical path. It does **not** block Slices 1–5.
(Residual risk — WhatsApp *send* still depends on the venue's GHL WhatsApp approval; see [Risks](#risks--open-questions).)

---

## The Unified Build Sequence (Slices 1–8)

Build **internal/staff first, couple portal last** (D8). Work **page-at-a-time, test each before
moving on**. Each slice below states its goal, what gets built (with real file paths + table names),
what becomes **testable/demoable** when done, dependencies, and the spec that holds the detail.

New tables follow the existing **RLS template** (verified against `20260611100000_tenancy_layer.sql`
and `20260611140000_m2_contacts_pipeline.sql`): every table has `venue_id uuid NOT NULL REFERENCES
venues(id) ON DELETE CASCADE`, `created_at` / `updated_at` with the `set_updated_at()` trigger, and
policies built from the `current_venue_ids()` / `current_owner_or_admin_venue_ids()` /
`current_owner_venue_ids()` helpers. "Member CRUD" = the operational template (`contacts` pattern);
"admin-write" = owners/admins write, members read (`spaces` pattern); "service-role only" = no
authenticated INSERT, written by webhook/Inngest via the service role.

---

### Slice 1 — Foundation + first visible win

**Goal:** prove GHL auth + API end-to-end with the smallest real feature.

**Built:**
- Migration: **`ghl_credentials`** table (new). Columns:
  `id uuid PK`, `venue_id uuid NOT NULL FK→venues`, `location_id text` (GHL sub-account),
  `auth_type text CHECK (auth_type IN ('pit','oauth'))`, `access_token text` (encrypted at rest),
  `refresh_token text` (encrypted, null for PIT), `token_expires_at timestamptz`,
  `created_at`/`updated_at`. **RLS: admin-write** (owners/admins read+write their venue's row;
  members no read — tokens are secret). Unique on `(venue_id)`.
- `src/lib/ghl/client.ts` — `ghlClient(venueId)`: resolves the token source (PIT vs OAuth) behind one
  interface, sets `Version: 2021-07-28`, base `services.leadconnectorhq.com`. `src/lib/ghl/types.ts`,
  `src/lib/ghl/webhooks.ts` (HMAC helper — used Slice 2).
- **GHL connect tile** in `src/app/(app)/settings/page.tsx` — paste/store PIT now; OAuth button stubbed.
- **Live READ** of GHL contacts + pipeline counts into the staff app (proves the call path).
- Add the **mode flag** decided in [D2](#the-architecture-decision-d2--fate-of-the-native-crm) to `venues`.

**Testable when done:** a staff user connects the test GHL sub-account in Settings and sees **real GHL
contacts and live pipeline counts** rendered in VF2. Auth + API round-trip proven.

**Dependencies:** none (first slice). **Spec:** [`specs/ghl-integration.md`](./specs/ghl-integration.md) · [`specs/data-model.md`](./specs/data-model.md).

---

### Slice 2 — The trigger (the spine)

**Goal:** a booking in GHL creates a real wedding in VF2 and invites the couple.

**Built:**
- Migration columns: **`contacts.ghl_contact_id text`**, **`opportunities.ghl_opportunity_id text`**
  (link keys, indexed; nullable). Optional venue-level GHL link already covered by `ghl_credentials.location_id`.
- Migration: **`weddings`** table (new — the hub record). Suggested columns:
  `id uuid PK`, `venue_id FK`, `contact_id uuid FK→contacts (nullable in standalone)`,
  `ghl_opportunity_id text`, `couple_names text`, `wedding_date date`, `space_id uuid FK→spaces`,
  `guest_count int`, `status text CHECK (...) DEFAULT 'planning'`, `created_at`/`updated_at`.
  **RLS: member CRUD** (staff operational record).
- Migration: **`couple_accounts`** table (new — portal end-users). Columns:
  `id uuid PK`, `venue_id FK`, `wedding_id uuid NOT NULL FK→weddings`, `email citext`, `first_name text`,
  `role text CHECK (role IN ('partner_a','partner_b'))`, `invited_at`, `activated_at`, `created_at`/`updated_at`.
  **RLS:** staff (member) read/write; couple-only RLS added in Slice 8. Unique `(wedding_id, email)`.
- `src/app/api/webhooks/ghl/route.ts` — inbound GHL webhook handler, **HMAC-validated** via `webhooks.ts`.
- Inngest `src/inngest/functions/opportunity-won.ts` — listens `ghl/opportunity-won`:
  `GET /v2/contacts/{id}` → insert `weddings` → insert `couple_accounts` → Resend portal invite.
- Real **Weddings index** (ports `preview/weddings/page.tsx`) + real **Wedding Workspace hub** (ports
  `preview/weddings/[id]/page.tsx`) — planning-tool tabs are **stubbed** and scoped to the open
  wedding only (D7), not in global nav.
- **Manual-create fallback (D6):** staff "Create wedding" button that does the same inserts without GHL.

**Testable when done:** mark an opportunity **Won** in the test GHL sub-account → a **real wedding
appears** in VF2's Weddings index, the Workspace hub opens for it, and a **portal invite email
sends**. Plus: staff can create a wedding **manually** with no GHL involved.

**Dependencies:** Slice 1 (client + creds + mode flag). **Spec:** [`specs/ghl-integration.md`](./specs/ghl-integration.md) · [`specs/staff-workspace.md`](./specs/staff-workspace.md) · [`specs/data-model.md`](./specs/data-model.md).

---

### Slice 3 — Venue config / libraries (admin)

**Goal:** make venue settings real — these are the configuration the planning tools depend on. Apply gating (D5).

**Built (ports `preview/admin/*`):**
- Profile/brand, **spaces** (extend existing `spaces`), **floor templates per space** (new
  **`floor_plans`** table: `id`, `venue_id FK`, `space_id FK`, `name`, `layout jsonb`, timestamps —
  admin-write).
- **Menu library** (D4 — items first, then menus):
  **`menu_items`** (`id`, `venue_id FK`, `name`, `description`, `category text`, `price_minor int`,
  `dietary_tags text[]`, timestamps — admin-write);
  **`menus`** (`id`, `venue_id FK`, `name`, `course_structure jsonb`, timestamps — admin-write);
  **`menu_item_selections`** join (`id`, `venue_id FK`, `menu_id FK`, `menu_item_id FK`, `course text`,
  `sort_index numeric` — admin-write). Editing one item updates everywhere it is used.
- **Packages/pricing**, **team & roles** (extend `memberships`), **custom fields**.
- **Gating (D5):** floor-plan tool locked until a space + floor template exists; per-wedding menu
  locked until the menu library has items; calendar locked until availability set. First-login
  **guided setup checklist / take-a-tour** lives here.

**Testable when done:** an admin builds out their venue — adds spaces, a floor template, menu items
→ menus, packages, team. The **gating checklist** lights up green as prerequisites are met, and
downstream planning tools unlock.

**Dependencies:** Slice 1 (auth/tenant). **Spec:** [`specs/venue-settings.md`](./specs/venue-settings.md) · [`specs/data-model.md`](./specs/data-model.md).

---

### Slice 4 — Per-wedding planning tools

**Goal:** the planning toolset, each scoped to a real `wedding_id`, built and tested one at a time.

**Built (each tab ports its demo screen; all scoped to the open wedding, D7):**
- **Guests** (ports `preview/guests`) — **`wedding_guests`** (`id`, `venue_id FK`, `wedding_id FK`,
  `name`, `email`, `rsvp_status text`, `dietary text`, `table_assignment text`, timestamps — member CRUD).
- **Menu (per wedding)** (ports `preview/menu`) — pulls from the Slice 3 library;
  **`menu_item_selections`** scoped to the wedding (or a `wedding_menu` link — settle in spec). Locked until library has items (D5).
- **Run sheet / timeline** (ports `preview/runsheet`) — **`timeline_events`** (`id`, `venue_id FK`,
  `wedding_id FK`, `title`, `starts_at timestamptz`, `duration_min int`, `owner text`, `sort_index numeric`, timestamps — member CRUD).
- **Floor plan** (ports `preview/floorplan`) — per-wedding instance of a Slice 3 floor template. Locked until template exists (D5).
- **Suppliers** (ports `preview/suppliers`) — venue directory **`suppliers`** (`id`, `venue_id FK`,
  `name`, `category`, `contact_email`, `contact_phone`, timestamps — admin-write) + per-wedding join
  **`wedding_suppliers`** (`id`, `venue_id FK`, `wedding_id FK`, `supplier_id FK`, `status`, `notes`, timestamps — member CRUD).

**Testable when done:** open a real wedding → add guests, select a menu from the library, build a run
sheet, lay out the floor plan, attach suppliers. Each tool persists and is scoped to that wedding only.

**Dependencies:** Slice 2 (weddings exist) + Slice 3 (libraries to pull from). **Spec:** [`specs/staff-workspace.md`](./specs/staff-workspace.md) · [`specs/data-model.md`](./specs/data-model.md).

---

### Slice 5 — Money

**Goal:** real proposal builder + payment milestones; GHL invoices mirror.

**Built (ports `preview/money` + `money/proposals/[id]/build`):**
- **`proposals`** (`id`, `venue_id FK`, `wedding_id FK`, `status text`, `line_items jsonb`,
  `total_minor int`, `sent_at`, timestamps — member CRUD).
- **`payment_milestones`** (`id`, `venue_id FK`, `wedding_id FK`, `label text`, `amount_minor int`,
  `due_date date`, `status text CHECK (...)`, `ghl_invoice_id text`, timestamps — member CRUD).
- GHL invoices mirror via `ghlClient`: `POST /v2/invoices`, `GET /v2/invoices/{id}`,
  `POST /v2/invoices/{id}/send`. Status surfaced as Awaiting Deposit / Deposit Paid / Balance Due /
  Paid in Full. **No couple-facing Stripe** here (bank transfer is the norm; Stripe is VF2 SaaS billing only).

**Testable when done:** build a proposal for a real wedding, define milestones, **create + send a GHL
invoice** from VF2, and see its status reflected back.

**Dependencies:** Slice 2 (weddings) + Slice 1 (`ghlClient`). **Spec:** [`specs/staff-workspace.md`](./specs/staff-workspace.md) · [`specs/ghl-integration.md`](./specs/ghl-integration.md).

---

### Slice 6 — Messaging mirror

**Goal:** surface GHL conversations inside the Wedding Workspace (D3). Read → send → realtime.

**Built:**
- "Messages" tab in the Wedding Workspace: `GET /v2/conversations?contactId=`,
  `GET /v2/conversations/{id}/messages` (**read first**).
- Reply: `POST /v2/conversations/{id}/messages` (**send second**) — VF2 is UI, GHL delivers.
- Inbound `conversation.message.received` webhook → `route.ts` → **Supabase Realtime** channel → live
  UI (**realtime third**). **No message storage in VF2.**

**Testable when done:** open a wedding whose contact has GHL threads → see the conversation history,
reply from VF2 (delivered via GHL), and watch an inbound message appear live without refresh.

**Dependencies:** Slice 2 (`contacts.ghl_contact_id` link) + Slice 1. **Spec:** [`specs/ghl-integration.md`](./specs/ghl-integration.md).

---

### Slice 7 — Intelligence

**Goal:** real Reports, real Copilot, Daily Brief email.

**Built:**
- **Reports** refresh (ports `preview/reports`, extends `(app)/reports`) over live data —
  `report_leads_by_stage` / `report_leads_by_source` views + GHL pipeline counts + VF2 wedding/payment data.
- **Copilot** (ports `preview/copilot`) — insights over live records.
- **Daily Brief** — Inngest `src/inngest/functions/daily-brief.ts` at 7am venue-local:
  `GET /v2/opportunities?pipelineId=` (counts + revenue) + recent contacts/conversations + VF2 portal/
  payment activity → Resend digest.

**Testable when done:** Reports render from live data; Copilot answers over real records; a Daily Brief
email arrives at the scheduled time with real numbers.

**Dependencies:** Slices 2–5 (data to report on) + Slice 1. **Spec:** [`specs/ghl-integration.md`](./specs/ghl-integration.md) · [`specs/staff-workspace.md`](./specs/staff-workspace.md).

---

### Slice 8 — Couple portal (last)

**Goal:** the couple-facing interactive portal (D8 — portal last).

**Built (ports `(portal)/portal/page.tsx`):**
- Magic-link auth for `couple_accounts`; **couple-only RLS** (a couple sees only their own
  `wedding_id`'s data — new policy helpers, distinct from staff `current_venue_ids()`).
- Read summaries + interactive guest list / menu choices / documents.

**Testable when done:** a couple clicks the invite email, lands in their portal via magic link, sees
their wedding, and edits their guest list / menu choices — with RLS proving they cannot see any other
wedding.

**Dependencies:** Slices 2 + 4 (weddings + planning data) + Slice 3 (libraries). **Spec:** [`specs/couple-portal.md`](./specs/couple-portal.md).

---

### Slice dependency map

```
S1 Foundation ─┬─> S2 Trigger ─┬─> S4 Planning ─┬─> S8 Portal
               │               │                │
               ├─> S3 Config ──┘                │
               │      (libraries)               │
               ├─> S5 Money ────────────────────┤
               ├─> S6 Messaging ────────────────┤
               └─> S7 Intelligence ─────────────┘
```

---

## Cross-Cutting Principles

- **Gating (D5).** A feature stays locked/grayed until its prerequisite setup is done — floor plan
  locked until a space + floor template exists; per-wedding menu locked until the venue menu library
  has items; calendar locked until availability is set. A guided **setup checklist / take-a-tour**
  surfaces on first login (replaces the Sonas onboarding pain). Built in Slice 3, consumed by Slice 4.
- **GHL is an optional plugin layer, not a hard dependency (D6).** Every integration point — above all
  the opp-won trigger — has a **standalone fallback** (staff can manually create a wedding, Slice 2).
  The mode flag (D2) decides which path is live per venue.
- **Wedding-scoped tabs (D7).** Planning-tool tabs belong to **one** wedding and only appear inside
  that wedding's Workspace — never in the global left nav when no wedding is open.
- **Page-at-a-time, test-as-you-go (D8).** Build one screen, verify it works against real data, then
  move on. No slice is "done" until its **Testable when done** row passes in a browser, not just typechecks.
- **Advisor / operator working model (from the call).** Kai + Trey **plan and log** to a Forge-style
  board (advisors); Mervin **builds** (operator). This roadmap is the shared contract between those roles.

---

## Risks & Open Questions

| # | Risk / Question | Impact | Status |
|---|---|---|---|
| R1 | **WhatsApp Business API approval** on the TWM GHL sub-account | If not approved, Slice 6 **send** is SMS-only until it is (read still works) | OPEN — confirm approval status |
| R2 | **OAuth vs PIT timing** | PIT works for one test sub-account now; multi-venue production needs the OAuth marketplace app. `ghlClient` abstracts the source, so swap is backend-only — but OAuth app + scopes must be ready before multi-venue | OPEN — schedule OAuth app build before GA |
| R3 | **GHL OAuth scopes** | Minimum: `contacts.readonly/write`, `conversations.readonly/write`, `opportunities.readonly`, `invoices.write` | OPEN — confirm against marketplace app |
| R4 | **Webhook registration per location** | Each venue onboarding must auto-register VF2's webhook URL against its GHL location | OPEN — design in Slice 1/2 |
| R5 | **Mode-flag shape + default (D2)** | Drives whether GHL tile shows + whether trigger or manual-create is primary | **NEEDS SIGN-OFF** — recommend `venues.mode` default `'bundled'` |
| R6 | **Standalone-mode scope** | How much of the native CRM (`(app)/pipeline`, `contacts`, `reports`) is supported/sold standalone vs. bundled-only read-mirror | OPEN — product call |
| R7 | **Token encryption at rest** | `ghl_credentials.access_token`/`refresh_token` must be encrypted; mechanism (pgsodium / app-layer) undecided | OPEN — decide before storing real tokens |
| R8 | **Per-wedding menu link shape** | Whether per-wedding menu reuses `menu_item_selections` scoped by `wedding_id` or needs a `wedding_menu` table | OPEN — settle in data-model spec |

---

## Spec Pointer Table

This roadmap links to the specs; the depth lives in them. (Some may not exist yet — create under
`specs/` as each slice begins.)

| Spec | Covers | Primary slices |
|---|---|---|
| [`specs/data-model.md`](./specs/data-model.md) | All new tables + columns, RLS templates, indexes, the mode flag | 1–5, 8 |
| [`specs/ghl-integration.md`](./specs/ghl-integration.md) | `ghlClient`, PIT/OAuth, webhook handler + HMAC, the 5 integration points, read-mirror contract, bundled-vs-standalone | 1, 2, 5, 6, 7 |
| [`specs/staff-workspace.md`](./specs/staff-workspace.md) | Wedding Workspace hub + planning tools, proposals/milestones, intelligence | 2, 4, 5, 7 |
| [`specs/venue-settings.md`](./specs/venue-settings.md) | Venue config / libraries (spaces, floor templates, menu library, packages, team, custom fields), gating | 3 |
| [`specs/couple-portal.md`](./specs/couple-portal.md) | Couple portal, magic-link auth, couple-only RLS | 8 |
| [`GHL-BACKEND-PLAN.md`](./GHL-BACKEND-PLAN.md) | Authoritative integration-point detail + GHL phases | 1, 2, 5, 6, 7 |
