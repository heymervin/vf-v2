# VenueFlow v2 — Data Model Spec

**Status:** Build-ready  
**Audience:** Emilio/Andres (migrations), Mervin (app code), Kai/Trey (decisions)  
**Ground truth for existing schema:** `supabase/migrations/20260611*` – `20260614*`  
**Ground truth for RLS helpers:** `public.current_venue_ids()`, `public.current_owner_or_admin_venue_ids()`, `public.current_owner_venue_ids()` — all defined in `20260611100000_tenancy_layer.sql`

> ⚠️ **Resolved forks override this doc.** Where this spec's inline DDL conflicts with
> [`SCHEMA-DECISIONS.md`](./SCHEMA-DECISIONS.md) (SD-1…SD-8 — `venues.mode`, `weddings` columns,
> `couple_accounts` + Supabase-native invite, the menu/course model, jsonb floor plans,
> `wedding_documents`, minor-unit money, app-layer token encryption), **SCHEMA-DECISIONS.md wins.**
> Read it before writing the M7+ migrations.

---

## Migration Plan Overview

All new migrations follow the existing naming convention: `YYYYMMDDHHMMSS_<slug>.sql`. The date prefix determines execution order. Timestamps below use the June 2026 schedule; adjust the MMDD prefix as work progresses but keep the slot ordering.

| File | Slug | Covers | Build Slice |
|------|------|---------|-------------|
| `20260616000001_m7_ghl_credentials.sql` | m7_ghl_credentials | `ghl_credentials` table; `venues.ghl_enabled` + `venues.ghl_mode` flags; `contacts.ghl_contact_id`; `opportunities.ghl_opportunity_id` + `opportunities.ghl_location_id` | Slice 1 |
| `20260617000001_m8_weddings.sql` | m8_weddings | `weddings` table; `couple_accounts` table; new `wedding_status` enum; new `couple_account_status` enum; new `payment_status_cache` enum | Slice 2 |
| `20260618000001_m9_venue_config.sql` | m9_venue_config | `floor_templates` table; `floor_template_tables` table; `packages` table; `package_lines` table; `custom_fields` table; `invite_tokens` table; `venues`/`spaces` profile column additions (see `specs/venue-settings.md`) | Slice 3 |
| `20260619000001_m10_menu.sql` | m10_menu | `menu_items` table (venue library); `menus` table; `menu_item_selections` join table (D4 architecture) | Slice 3/4 |
| `20260620000001_m11_planning.sql` | m11_planning | `wedding_guests`; `timeline_events`; `floor_plans` | Slice 4 |
| `20260621000001_m12_suppliers.sql` | m12_suppliers | `suppliers` (venue directory); `wedding_suppliers` (per-wedding) | Slice 4 |
| `20260622000001_m13_money.sql` | m13_money | `proposals`; `proposal_line_items`; `payment_milestones` | Slice 5 |

> **Idempotency:** Every migration must follow the existing pattern — `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` before recreating, `DROP TRIGGER IF EXISTS` before recreating, `DO $$ IF NOT EXISTS` guards on enums. All helper functions `CREATE OR REPLACE`.

---

## RLS Patterns Reference

The codebase uses exactly four named patterns. New tables pick the right one.

| Pattern name | SELECT | INSERT | UPDATE | DELETE | Used by |
|---|---|---|---|---|---|
| **MEMBER-CRUD** | any member | any member | any member | any member | `contacts`, `opportunities` — operational staff data |
| **OWNER-ADMIN-WRITE** | any member | owner/admin only | owner/admin only | owner/admin only | `spaces`, `venue_hours`, `brochures`, `sequences` — config data |
| **SELECT-ONLY / ADMIN-WRITE** | any member | blocked (service role or trigger only) | blocked | blocked | `stage_events`, `sequence_enrollments`, `billing_subscriptions` — system-written |
| **SERVICE-ROLE-ONLY** | no policy | no policy | no policy | no policy | `email_suppressions`, `stripe_events` — zero client access |

New pattern for couple portal (Slice 8 only):

| Pattern name | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| **COUPLE-SCOPED** | `wedding_id IN (SELECT wedding_id FROM couple_accounts WHERE auth_user_id = auth.uid())` | same | same | blocked |

The `COUPLE-SCOPED` pattern requires a new SECURITY DEFINER helper — `public.current_couple_wedding_ids()` — that queries `couple_accounts`. This prevents direct recursion analogous to the existing `current_venue_ids()` approach.

---

## M7 — GHL Credentials + Venue Mode Flags

### venues table — new columns

Two columns added to the existing `venues` table via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `ghl_enabled` | `boolean` | NOT NULL | `false` | Per-venue GHL plugin on/off switch (D2) |
| `ghl_mode` | `text` | NULL | NULL | `'bundled'` = GHL is primary pre-sales; `'standalone'` = native CRM only. NULL same as standalone. |

**Constraint:** `CHECK (ghl_mode IN ('bundled', 'standalone') OR ghl_mode IS NULL)`.

**Behaviour (D2):** When `ghl_enabled = false OR ghl_mode = 'standalone' OR ghl_mode IS NULL`, the native `/pipeline`, `/contacts`, `/reports` routes operate normally. When `ghl_enabled = true AND ghl_mode = 'bundled'`, those routes become read mirrors and the GHL integration is active.

### ghl_credentials

Purpose: Stores per-venue GHL API credentials. Abstracts PIT tokens (current) from OAuth tokens (future) so `ghlClient(venueId)` in `src/lib/ghl/client.ts` can swap auth backends without changing callers.

RLS pattern: **SERVICE-ROLE-ONLY** — no authenticated client should ever read raw tokens. The `ghlClient()` server helper uses the service-role Supabase client.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE` |
| `location_id` | `text` | NOT NULL | — | GHL sub-account location ID |
| `auth_type` | `text` | NOT NULL | `'pit'` | `'pit'` = Private Integration Token; `'oauth'` = OAuth 2.0 marketplace |
| `access_token` | `text` | NULL | NULL | Encrypted at rest (Supabase `pgsodium` or app-layer AES). PIT or OAuth access token. |
| `refresh_token` | `text` | NULL | NULL | OAuth only. NULL for PIT mode. |
| `token_expires_at` | `timestamptz` | NULL | NULL | OAuth only. NULL for PIT mode (PITs do not expire). |
| `webhook_secret` | `text` | NULL | NULL | HMAC secret registered in GHL for this venue's location. Used by `src/lib/ghl/webhooks.ts` to validate inbound payloads. |
| `scopes` | `text[]` | NULL | NULL | OAuth scopes granted. NULL for PIT mode. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger: `trg_ghl_credentials_updated_at` |

**Constraints/Indexes:**
- `CONSTRAINT ghl_credentials_venue_unique UNIQUE (venue_id)` — one credential row per venue.
- `CHECK (auth_type IN ('pit', 'oauth'))`.
- `CREATE INDEX IF NOT EXISTS idx_ghl_credentials_venue_id ON public.ghl_credentials (venue_id)`.
- `updated_at` trigger follows `trg_*_updated_at` naming.

**RLS:** No policies. `ALTER TABLE public.ghl_credentials ENABLE ROW LEVEL SECURITY` with zero policies = deny all authenticated access. Reads and writes happen only via the service-role client in `src/lib/ghl/client.ts`.

**Open question OQ-1:** Encryption mechanism — app-layer AES-256-GCM (store ciphertext in `access_token`) vs Supabase `pgsodium` transparent column encryption? Decision gates M7 implementation. Recommend app-layer so the value is never decryptable via SQL console.

### contacts table — new column

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `ghl_contact_id` | `text` | NULL | GHL contact ID from the sub-account. Set when the contact originates from GHL or is matched during the opp-won flow. |

```sql
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS ghl_contact_id text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_ghl_contact_id
  ON public.contacts (venue_id, ghl_contact_id)
  WHERE ghl_contact_id IS NOT NULL;
```

**Index:** Partial unique on `(venue_id, ghl_contact_id) WHERE ghl_contact_id IS NOT NULL` — one VF2 contact per GHL contact per venue.

### opportunities table — new columns

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `ghl_opportunity_id` | `text` | NULL | GHL opportunity ID. Set when matched to a GHL opp. |
| `ghl_location_id` | `text` | NULL | GHL location (sub-account) ID. Redundant with `ghl_credentials.location_id` but stored here to survive future multi-location edge cases and for fast lookup without a join. |

```sql
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS ghl_opportunity_id text,
  ADD COLUMN IF NOT EXISTS ghl_location_id    text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_opportunities_ghl_opportunity_id
  ON public.opportunities (venue_id, ghl_opportunity_id)
  WHERE ghl_opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_ghl_opportunity_id
  ON public.opportunities (ghl_opportunity_id)
  WHERE ghl_opportunity_id IS NOT NULL;
```

---

## M8 — Weddings + Couple Accounts

### New Enums

```sql
-- wedding_status — lifecycle of a booked wedding
CREATE TYPE public.wedding_status AS ENUM (
  'planning',       -- active planning underway
  'final_details',  -- within ~3 months, final numbers locked
  'this_week',      -- within 7 days
  'completed',      -- event day passed
  'cancelled'       -- booking cancelled after creation
);

-- couple_account_status
CREATE TYPE public.couple_account_status AS ENUM (
  'invited',   -- invite email sent, portal not yet activated
  'active',    -- at least one portal login
  'disabled'   -- revoked by venue
);

-- payment_status_cache — cached read from GHL invoices; updated by Inngest poll
CREATE TYPE public.payment_status_cache AS ENUM (
  'awaiting_deposit',
  'deposit_paid',
  'balance_due',
  'paid_in_full',
  'unknown'     -- GHL not connected or data not yet fetched
);
```

### weddings

Purpose: The post-booking workspace record. One row per booked couple, per venue. Spawned by the Inngest `ghl/opportunity-won` function (GHL bundled mode) or manually via staff action (standalone mode, D6). This is the real-world counterpart to the demo screen `src/app/(demo)/preview/weddings/[id]/page.tsx`.

RLS pattern: **MEMBER-CRUD** — all venue staff read/write weddings for their venue. Couple access to specific wedding-child tables is handled by the separate `COUPLE-SCOPED` pattern on those tables; `weddings` itself is staff-only.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE` |
| `contact_id` | `uuid` | NULL | NULL | FK → `contacts(id) ON DELETE SET NULL`. NULL if contact was GHL-only and not mirrored. |
| `opportunity_id` | `uuid` | NULL | NULL | FK → `opportunities(id) ON DELETE SET NULL`. NULL in standalone mode. |
| `ghl_opportunity_id` | `text` | NULL | NULL | Direct GHL opportunity ID for GHL API calls without requiring a join through `opportunities`. |
| `ghl_contact_id` | `text` | NULL | NULL | Direct GHL contact ID. Set from GHL webhook payload. |
| `space_id` | `uuid` | NULL | NULL | FK → `spaces(id) ON DELETE SET NULL`. The space booked. |
| `coordinator_id` | `uuid` | NULL | NULL | FK → `memberships(id) ON DELETE SET NULL`. Assigned coordinator. |
| `couple_name` | `text` | NOT NULL | — | Display name, e.g. `'Henderson & Carter'`. |
| `partner1_name` | `text` | NULL | NULL | First partner full name. |
| `partner2_name` | `text` | NULL | NULL | Second partner full name. |
| `partner1_email` | `citext` | NULL | NULL | Used for couple portal invite. |
| `partner2_email` | `citext` | NULL | NULL | Used for couple portal invite (optional). |
| `wedding_date` | `date` | NULL | NULL | The booked wedding date. |
| `guest_count_day` | `int` | NULL | NULL | Expected day guests. |
| `guest_count_evening` | `int` | NULL | NULL | Expected evening guests. |
| `status` | `public.wedding_status` | NOT NULL | `'planning'` | Lifecycle state. |
| `payment_status` | `public.payment_status_cache` | NOT NULL | `'unknown'` | Cached from GHL. Updated by Inngest poll. |
| `total_value_minor` | `int` | NULL | NULL | Total contract value in minor currency units (pence). Mirrors proposal total or GHL invoice sum. |
| `package_name` | `text` | NULL | NULL | Denormalised from accepted proposal or GHL opportunity name, for display. |
| `contract_status` | `text` | NOT NULL | `'missing'` | `'missing' \| 'sent' \| 'signed'`. Simple text; not an enum (low-cardinality, subject to change). |
| `portal_active` | `boolean` | NOT NULL | `false` | True once at least one couple_account has logged in. |
| `portal_last_seen_at` | `timestamptz` | NULL | NULL | Updated on couple portal login. |
| `notes` | `text` | NULL | NULL | Free-text internal notes. |
| `custom` | `jsonb` | NOT NULL | `'{}'` | Escape hatch for venue-defined custom fields (mirrors `contacts.custom` pattern). |
| `source` | `text` | NOT NULL | `'ghl_webhook'` | `'ghl_webhook' \| 'manual'`. Set at creation time (D6). |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger: `trg_weddings_updated_at` |

**Constraints/Indexes:**
```sql
CREATE INDEX IF NOT EXISTS idx_weddings_venue_id       ON public.weddings (venue_id);
CREATE INDEX IF NOT EXISTS idx_weddings_contact_id     ON public.weddings (contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weddings_opportunity_id ON public.weddings (opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weddings_wedding_date   ON public.weddings (venue_id, wedding_date);
CREATE INDEX IF NOT EXISTS idx_weddings_coordinator    ON public.weddings (coordinator_id) WHERE coordinator_id IS NOT NULL;
-- GHL lookup without join
CREATE INDEX IF NOT EXISTS idx_weddings_ghl_opportunity_id
  ON public.weddings (ghl_opportunity_id) WHERE ghl_opportunity_id IS NOT NULL;
-- Natural key dedup: one active wedding per opportunity
CREATE UNIQUE INDEX IF NOT EXISTS uq_weddings_opportunity
  ON public.weddings (opportunity_id)
  WHERE opportunity_id IS NOT NULL AND status != 'cancelled';
```

**RLS:** MEMBER-CRUD pattern.

```sql
-- SELECT: any member of the venue
CREATE POLICY "weddings_select_members" ON public.weddings
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- INSERT: any member (staff can manually create — D6)
CREATE POLICY "weddings_insert_members" ON public.weddings
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

-- UPDATE: any member
CREATE POLICY "weddings_update_members" ON public.weddings
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

-- DELETE: owner/admin only (soft cancellation preferred; hard delete owner only)
CREATE POLICY "weddings_delete_owners_admins" ON public.weddings
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));
```

### couple_accounts

Purpose: Auth identity for the couple portal. Each `wedding` can have up to two `couple_accounts` (one per partner). Portal login is magic-link via Supabase Auth (separate flow from staff Supabase Auth). The `auth_user_id` is the Supabase `auth.users.id` for the couple's portal session.

RLS pattern: Couple accounts are **SERVICE-ROLE-ONLY** for writes (created by Inngest `ghl/opportunity-won`). Staff can read them via MEMBER-SELECT. Couples cannot modify their own account rows.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE`. Denormalised for easy RLS scoping. |
| `wedding_id` | `uuid` | NOT NULL | — | FK → `weddings(id) ON DELETE CASCADE` |
| `auth_user_id` | `uuid` | NULL | NULL | FK → `auth.users(id) ON DELETE SET NULL`. Set once the couple activates their invite. NULL = invite sent but not accepted. |
| `email` | `citext` | NOT NULL | — | The email invite was sent to. |
| `display_name` | `text` | NULL | NULL | Partner's name for portal display. |
| `status` | `public.couple_account_status` | NOT NULL | `'invited'` | Lifecycle. |
| `invite_token` | `uuid` | NOT NULL | `gen_random_uuid()` | Magic-link token in invite email URL. Single-use; cleared on first login. |
| `invite_sent_at` | `timestamptz` | NULL | NULL | When the invite email was sent. |
| `last_seen_at` | `timestamptz` | NULL | NULL | Updated on each portal page load. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger: `trg_couple_accounts_updated_at` |

**Constraints/Indexes:**
```sql
CREATE INDEX IF NOT EXISTS idx_couple_accounts_venue_id   ON public.couple_accounts (venue_id);
CREATE INDEX IF NOT EXISTS idx_couple_accounts_wedding_id ON public.couple_accounts (wedding_id);
-- Auth lookup (portal login check)
CREATE UNIQUE INDEX IF NOT EXISTS uq_couple_accounts_auth_user_id
  ON public.couple_accounts (auth_user_id) WHERE auth_user_id IS NOT NULL;
-- Invite token lookup
CREATE UNIQUE INDEX IF NOT EXISTS uq_couple_accounts_invite_token
  ON public.couple_accounts (invite_token);
-- Dedupe: one account per email per wedding
CREATE UNIQUE INDEX IF NOT EXISTS uq_couple_accounts_wedding_email
  ON public.couple_accounts (wedding_id, email);
```

**RLS:**
```sql
-- Staff: member SELECT on their venue's couple accounts
CREATE POLICY "couple_accounts_select_members" ON public.couple_accounts
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- No INSERT/UPDATE/DELETE for authenticated staff or couples.
-- All writes via service-role client (Inngest creates; last_seen_at updated server-side).
```

**Couple portal auth flow (not a migration, but documents the design):**
1. Inngest creates `couple_accounts` row with `status = 'invited'`, `invite_token = gen_random_uuid()`.
2. Resend sends invite email with URL: `/portal/activate?token={invite_token}`.
3. `/portal/activate` route (server action, service-role client) validates token, calls `auth.admin.createUser` or `auth.admin.inviteUserByEmail`, sets `auth_user_id`, clears `invite_token`, sets `status = 'active'`.
4. Subsequent couple portal requests check `auth.uid()` against `couple_accounts.auth_user_id`.

**New SECURITY DEFINER helper (added in M8):**
```sql
-- Returns wedding_ids the currently authenticated couple can access.
-- Used in COUPLE-SCOPED RLS policies on child planning tables.
CREATE OR REPLACE FUNCTION public.current_couple_wedding_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT wedding_id
  FROM public.couple_accounts
  WHERE auth_user_id = auth.uid()
    AND status = 'active';
$$;
```

---

## M9 — Venue Config Libraries

### floor_templates

Purpose: Saved table-layout blueprints per space. Staff pick a template when setting up a wedding's floor plan (D5 gating: floor plan tool locked until a space + floor template exists). Demo reference: `src/app/(demo)/preview/admin/spaces/[id]/floor/page.tsx` and `src/lib/mock/admin.ts` (`FLOOR_TEMPLATES`).

RLS pattern: **OWNER-ADMIN-WRITE** (config data).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE` |
| `space_id` | `uuid` | NOT NULL | — | FK → `spaces(id) ON DELETE CASCADE` |
| `name` | `text` | NOT NULL | — | E.g. `'Long Barn — 12 rounds + head'` |
| `is_default` | `boolean` | NOT NULL | `false` | One default per space (partial unique). |
| `canvas_json` | `jsonb` | NULL | NULL | Serialised table and room-element positions (percentages, matching `FloorplanTable` and `RoomElement` shapes from `src/lib/mock/planning.ts`). NULL = empty canvas template. |
| `table_count` | `int` | NULL | NULL | Denormalised count for display; re-derived from `canvas_json.tables.length` on save. |
| `capacity` | `int` | NULL | NULL | Denormalised seated capacity from canvas. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger: `trg_floor_templates_updated_at` |

```sql
CREATE INDEX IF NOT EXISTS idx_floor_templates_venue_id  ON public.floor_templates (venue_id);
CREATE INDEX IF NOT EXISTS idx_floor_templates_space_id  ON public.floor_templates (space_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_floor_templates_default_space
  ON public.floor_templates (space_id) WHERE is_default;
```

### packages

Purpose: Venue-level price packages (the building blocks for proposals). Demo reference: `src/app/(demo)/preview/admin/packages/page.tsx` and `src/lib/mock/admin.ts` (`PACKAGES`).

RLS pattern: **OWNER-ADMIN-WRITE**.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE` |
| `name` | `text` | NOT NULL | — | E.g. `'The Full Day — Summer'` |
| `season` | `text` | NULL | NULL | `'Summer' \| 'Autumn' \| 'All year'` etc. Display only. |
| `description` | `text` | NULL | NULL | Short summary for proposal builder dropdown. |
| `from_price_minor` | `int` | NULL | NULL | Indicative from-price in minor units (pence). Recomputed from `package_lines` but stored for fast display. |
| `is_active` | `boolean` | NOT NULL | `true` | Inactive packages hidden from proposal builder. |
| `sort_order` | `int` | NOT NULL | `1000` | Display order in admin list and proposal builder. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger: `trg_packages_updated_at` |

### package_lines

Purpose: Individual line items within a package (the price library). One-to-many with `packages`. Used by proposal builder to pre-populate lines. Demo reference: `src/lib/mock/proposals.ts` (`PRICE_LIBRARY`, `ProposalTemplate`).

RLS pattern: **OWNER-ADMIN-WRITE** (same as parent `packages`).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE`. Denormalised for RLS. |
| `package_id` | `uuid` | NOT NULL | — | FK → `packages(id) ON DELETE CASCADE` |
| `label` | `text` | NOT NULL | — | Line item description. |
| `unit_minor` | `int` | NOT NULL | — | Price per unit in minor units. |
| `unit_type` | `text` | NOT NULL | — | `'flat' \| 'per_head' \| 'per_evening'`. Matches `PriceLibraryItem.unitType`. |
| `qty_tied_to_guests` | `boolean` | NOT NULL | `false` | True = qty auto-fills from wedding guest count in proposal builder. |
| `category` | `text` | NOT NULL | `'package'` | `'package' \| 'addon'`. Matches `ProposalLine.category`. |
| `sort_order` | `int` | NOT NULL | `1000` | Display order within the package. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

```sql
CREATE INDEX IF NOT EXISTS idx_package_lines_venue_id   ON public.package_lines (venue_id);
CREATE INDEX IF NOT EXISTS idx_package_lines_package_id ON public.package_lines (package_id);
```

---

## M10 — Menu Architecture (D4)

Decision D4 mandates: food ITEMS first (the venue library), then MENUS assembled from items. Editing one item updates everywhere it is used. Demo reference: `src/app/(demo)/preview/admin/menu/page.tsx`, `src/lib/mock/admin.ts` (`MENU_LIBRARY`), `src/lib/mock/index.ts` (`MenuCourse`, `MenuOption`).

### menu_items

Purpose: Venue-level library of individual dishes. Each row is a dish that can appear in one or more menus. RLS pattern: **OWNER-ADMIN-WRITE** (venue config).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE` |
| `name` | `text` | NOT NULL | — | Dish name, e.g. `'Heritage tomato & burrata'` |
| `description` | `text` | NULL | NULL | Full dish description. |
| `course` | `text` | NOT NULL | — | `'Starter' \| 'Main' \| 'Dessert' \| 'Children' \| 'Evening'` etc. Display grouping. Not an enum — venues may use different course names. |
| `meal_period` | `text` | NULL | NULL | `'wedding_breakfast' \| 'evening' \| 'canapes'`. NULL = not period-specific. |
| `allergens` | `text[]` | NOT NULL | `ARRAY[]::text[]` | E.g. `['Dairy', 'Gluten']`. |
| `dietary_tags` | `text[]` | NOT NULL | `ARRAY[]::text[]` | E.g. `['Vegetarian', 'Gluten-free']`. |
| `price_per_head_minor` | `int` | NULL | NULL | Indicative cost in minor units (pence). NULL = priced at package level. |
| `photo_path` | `text` | NULL | NULL | Path in Supabase `venue-assets` bucket. |
| `is_active` | `boolean` | NOT NULL | `true` | Inactive items hidden from menu builder. |
| `sort_order` | `int` | NOT NULL | `1000` | Display order within a course in admin and per-wedding menu view. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger: `trg_menu_items_updated_at` |

```sql
CREATE INDEX IF NOT EXISTS idx_menu_items_venue_id ON public.menu_items (venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_venue_course ON public.menu_items (venue_id, course);
```

### menus

Purpose: A named menu configuration — a curated selection of items from the library, scoped to a specific wedding. A venue may also have "template" menus (where `wedding_id IS NULL`) that serve as starting points. Demo reference: the per-wedding menu tab in `src/app/(demo)/preview/menu/page.tsx`.

RLS pattern: When `wedding_id IS NULL` (venue template menu): **OWNER-ADMIN-WRITE**. When `wedding_id IS NOT NULL` (per-wedding menu): **MEMBER-CRUD**. This is handled by a single combined policy set.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE` |
| `wedding_id` | `uuid` | NULL | NULL | FK → `weddings(id) ON DELETE CASCADE`. NULL = venue template menu. |
| `name` | `text` | NOT NULL | — | E.g. `'Summer Wedding Breakfast'`. |
| `is_active` | `boolean` | NOT NULL | `true` | Inactive menus hidden from wedding menu selector. |
| `notes` | `text` | NULL | NULL | Internal notes. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger: `trg_menus_updated_at` |

```sql
CREATE INDEX IF NOT EXISTS idx_menus_venue_id   ON public.menus (venue_id);
CREATE INDEX IF NOT EXISTS idx_menus_wedding_id ON public.menus (wedding_id) WHERE wedding_id IS NOT NULL;
-- At most one active menu per wedding
CREATE UNIQUE INDEX IF NOT EXISTS uq_menus_active_wedding
  ON public.menus (wedding_id) WHERE wedding_id IS NOT NULL AND is_active;
```

**RLS (combined — venue-member scoped, wedding-member if wedding_id set):**
```sql
-- SELECT: members of the venue
CREATE POLICY "menus_select_members" ON public.menus
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- INSERT: owner/admin for template menus; any member for per-wedding
CREATE POLICY "menus_insert_members" ON public.menus
  FOR INSERT TO authenticated
  WITH CHECK (
    venue_id IN (SELECT public.current_venue_ids())
    AND (
      wedding_id IS NOT NULL         -- per-wedding: any member
      OR venue_id IN (SELECT public.current_owner_or_admin_venue_ids())  -- template: owner/admin
    )
  );

-- UPDATE: same split
CREATE POLICY "menus_update_members" ON public.menus
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (
    venue_id IN (SELECT public.current_venue_ids())
    AND (
      wedding_id IS NOT NULL
      OR venue_id IN (SELECT public.current_owner_or_admin_venue_ids())
    )
  );

-- DELETE: owner/admin only
CREATE POLICY "menus_delete_owners_admins" ON public.menus
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));
```

### menu_item_selections

Purpose: Join table linking menu items to a specific menu. This is the D4 "items→menus" junction. One `menu_item` can appear in many `menus`; changing the `menu_item` (e.g. allergen update) propagates everywhere. Per-wedding choice counts (how many guests chose this option) are stored here.

RLS pattern: **MEMBER-CRUD** (follows parent `menus` — staff manage which items are on which menu).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE`. Denormalised for RLS. |
| `menu_id` | `uuid` | NOT NULL | — | FK → `menus(id) ON DELETE CASCADE` |
| `menu_item_id` | `uuid` | NOT NULL | — | FK → `menu_items(id) ON DELETE CASCADE` |
| `sort_order` | `int` | NOT NULL | `1000` | Display order within this menu (overrides `menu_items.sort_order` for this menu's presentation). |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

```sql
CREATE INDEX IF NOT EXISTS idx_menu_item_selections_venue_id    ON public.menu_item_selections (venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_selections_menu_id     ON public.menu_item_selections (menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_selections_menu_item_id ON public.menu_item_selections (menu_item_id);
-- Each item appears at most once per menu
CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_item_selections_menu_item
  ON public.menu_item_selections (menu_id, menu_item_id);
```

---

## M11 — Per-Wedding Planning Tools

### wedding_guests

Purpose: Guest list for a specific wedding. Demo reference: `src/app/(demo)/preview/guests/page.tsx`, `src/lib/mock/index.ts` (`Guest`, `makeGuests()`).

RLS pattern (staff): **MEMBER-CRUD**. Couple portal access: **COUPLE-SCOPED** SELECT + INSERT/UPDATE for their own wedding (couples can add/RSVP their own guests — exact scope TBD in Slice 8).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE`. Denormalised for RLS. |
| `wedding_id` | `uuid` | NOT NULL | — | FK → `weddings(id) ON DELETE CASCADE` |
| `name` | `text` | NOT NULL | — | Full name. |
| `email` | `citext` | NULL | NULL | For RSVP emails (future). |
| `phone` | `text` | NULL | NULL | |
| `side` | `text` | NULL | NULL | `'partner1' \| 'partner2' \| 'both'`. Which partner's "side". |
| `rsvp` | `text` | NOT NULL | `'pending'` | `'yes' \| 'no' \| 'pending'`. |
| `rsvp_chased_at` | `timestamptz` | NULL | NULL | Last time a chase was sent. |
| `session_type` | `text` | NULL | NULL | `'day' \| 'evening' \| 'ceremony_only'`. |
| `table_number` | `int` | NULL | NULL | Assigned table number from floor plan. NULL = not yet seated. |
| `seat_index` | `int` | NULL | NULL | Seat position at the table (optional). |
| `dietary` | `text[]` | NOT NULL | `ARRAY[]::text[]` | Dietary requirements, e.g. `['Vegetarian', 'Nut allergy']`. |
| `allergen_notes` | `text` | NULL | NULL | Free-text allergen detail beyond the array. |
| `plus_one` | `boolean` | NOT NULL | `false` | Guest has a plus-one. |
| `plus_one_name` | `text` | NULL | NULL | Named plus-one, if known. |
| `household_id` | `text` | NULL | NULL | Logical household grouping key (app-assigned UUID string; not a FK). |
| `household_name` | `text` | NULL | NULL | Household display name. |
| `tags` | `text[]` | NOT NULL | `ARRAY[]::text[]` | `'VIP' \| 'Family' \| 'Wedding party' \| 'Kids' \| 'Evening'` etc. |
| `meal_choice` | `jsonb` | NULL | NULL | `{starter?: uuid, main?: uuid, dessert?: uuid}` — references `menu_item_selections.menu_item_id`. |
| `notes` | `text` | NULL | NULL | Internal or couple notes. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger: `trg_wedding_guests_updated_at` |

```sql
CREATE INDEX IF NOT EXISTS idx_wedding_guests_venue_id   ON public.wedding_guests (venue_id);
CREATE INDEX IF NOT EXISTS idx_wedding_guests_wedding_id ON public.wedding_guests (wedding_id);
-- RSVP reporting
CREATE INDEX IF NOT EXISTS idx_wedding_guests_rsvp       ON public.wedding_guests (wedding_id, rsvp);
-- Table seating query
CREATE INDEX IF NOT EXISTS idx_wedding_guests_table      ON public.wedding_guests (wedding_id, table_number)
  WHERE table_number IS NOT NULL;
```

**Note on `meal_choice`:** Stored as jsonb referencing `menu_item_selections.menu_item_id` values, not a FK. This is intentional — meal choices are soft references; deleting a menu item selection should not cascade-delete guest choices but instead require a re-prompt. A CHECK constraint or application-layer validation enforces valid keys.

### timeline_events

Purpose: The run sheet / timeline for a wedding. Each row is one event in the schedule. Demo reference: `src/app/(demo)/preview/runsheet/page.tsx`, `src/lib/mock/index.ts` (`RunsheetItem`).

RLS pattern: **MEMBER-CRUD**.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE` |
| `wedding_id` | `uuid` | NOT NULL | — | FK → `weddings(id) ON DELETE CASCADE` |
| `starts_at_time` | `time` | NOT NULL | — | Wall-clock start time, e.g. `14:00`. `time` type (no date) since the wedding date is on `weddings.wedding_date`. |
| `duration_min` | `int` | NOT NULL | `30` | Duration in minutes. |
| `title` | `text` | NOT NULL | — | E.g. `'Ceremony — The Long Barn'` |
| `owner` | `text` | NULL | NULL | Who runs this item (display string; not a FK to memberships). |
| `category` | `text` | NOT NULL | — | `'ceremony' \| 'reception' \| 'catering' \| 'supplier' \| 'logistics'`. |
| `supplier_id` | `uuid` | NULL | NULL | FK → `wedding_suppliers(id) ON DELETE SET NULL`. Optional link. |
| `done` | `boolean` | NOT NULL | `false` | On-the-day check-in state. |
| `notes` | `text` | NULL | NULL | Internal notes. |
| `sort_order` | `int` | NOT NULL | `1000` | Manual sort override when times are equal. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger: `trg_timeline_events_updated_at` |

```sql
CREATE INDEX IF NOT EXISTS idx_timeline_events_venue_id   ON public.timeline_events (venue_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_wedding_id ON public.timeline_events (wedding_id);
-- Run sheet read path: ordered by time
CREATE INDEX IF NOT EXISTS idx_timeline_events_wedding_time
  ON public.timeline_events (wedding_id, starts_at_time, sort_order);
```

### floor_plans

Purpose: A saved floor plan for a specific wedding, derived from a `floor_templates` starting point and then customised. The canvas state (table positions, assignments) is stored as jsonb. Demo reference: `src/app/(demo)/preview/floorplan/page.tsx`, `src/lib/mock/planning.ts` (`FLOORPLAN_TABLES`, `ROOM_ELEMENTS`).

RLS pattern: **MEMBER-CRUD**.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE` |
| `wedding_id` | `uuid` | NOT NULL | — | FK → `weddings(id) ON DELETE CASCADE` |
| `space_id` | `uuid` | NULL | NULL | FK → `spaces(id) ON DELETE SET NULL`. The space this layout is for. |
| `template_id` | `uuid` | NULL | NULL | FK → `floor_templates(id) ON DELETE SET NULL`. Starting template (informational after copy). |
| `canvas_json` | `jsonb` | NOT NULL | `'{}'` | Serialised canvas state: `{tables: FloorplanTable[], roomElements: RoomElement[]}` (shapes from `src/lib/mock/planning.ts`). |
| `name` | `text` | NULL | NULL | Optional label (e.g. `'Long Barn — seated 120'`). |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger: `trg_floor_plans_updated_at` |

```sql
CREATE INDEX IF NOT EXISTS idx_floor_plans_venue_id   ON public.floor_plans (venue_id);
CREATE INDEX IF NOT EXISTS idx_floor_plans_wedding_id ON public.floor_plans (wedding_id);
-- At most one floor plan per space per wedding
CREATE UNIQUE INDEX IF NOT EXISTS uq_floor_plans_wedding_space
  ON public.floor_plans (wedding_id, space_id) WHERE space_id IS NOT NULL;
```

---

## M12 — Suppliers

### suppliers

Purpose: Venue-level preferred/approved supplier directory. Distinct from per-wedding supplier assignments. Demo reference: `src/app/(demo)/preview/suppliers/page.tsx` (venue directory view), `src/lib/mock/suppliers.ts` (`PREFERRED_SUPPLIERS`).

RLS pattern: **OWNER-ADMIN-WRITE** (venue config, managed by owner/admin).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE` |
| `name` | `text` | NOT NULL | — | Company/trading name. |
| `category` | `text` | NOT NULL | — | E.g. `'Florist' \| 'Photographer' \| 'Band / DJ' \| 'Caterer' \| 'Transport'`. Free text — no fixed enum. |
| `contact_name` | `text` | NULL | NULL | Primary contact person. |
| `email` | `citext` | NULL | NULL | |
| `phone` | `text` | NULL | NULL | |
| `website` | `text` | NULL | NULL | |
| `notes` | `text` | NULL | NULL | Venue's private notes about working with this supplier. |
| `venue_approved` | `boolean` | NOT NULL | `false` | Appears on the "Approved suppliers" list shown to couples. |
| `tags` | `text[]` | NOT NULL | `ARRAY[]::text[]` | Freeform tags, e.g. `['Preferred', 'Florals']`. |
| `avg_rating` | `numeric(3,1)` | NULL | NULL | Staff-assigned rating (0.0–5.0). |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger: `trg_suppliers_updated_at` |

```sql
CREATE INDEX IF NOT EXISTS idx_suppliers_venue_id  ON public.suppliers (venue_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_category  ON public.suppliers (venue_id, category);
```

### wedding_suppliers

Purpose: The specific suppliers engaged for a single wedding — pulled from the venue directory or added ad-hoc. Tracks arrival time, status, and doc checklist per wedding. Demo reference: `src/lib/mock/index.ts` (`Supplier`, per-wedding `suppliers` array).

RLS pattern: **MEMBER-CRUD**.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE` |
| `wedding_id` | `uuid` | NOT NULL | — | FK → `weddings(id) ON DELETE CASCADE` |
| `supplier_id` | `uuid` | NULL | NULL | FK → `suppliers(id) ON DELETE SET NULL`. NULL = ad-hoc supplier not in directory. |
| `name` | `text` | NOT NULL | — | Denormalised from `suppliers.name` or entered ad-hoc. |
| `category` | `text` | NOT NULL | — | Denormalised or entered ad-hoc. |
| `contact_name` | `text` | NULL | NULL | |
| `email` | `citext` | NULL | NULL | |
| `phone` | `text` | NULL | NULL | |
| `status` | `text` | NOT NULL | `'enquired'` | `'confirmed' \| 'pending' \| 'enquired' \| 'declined'`. Matches `SupplierStatus` from mock. |
| `arrival_time` | `time` | NULL | NULL | Expected on-the-day arrival. |
| `checked_in_at` | `timestamptz` | NULL | NULL | Stamped on day-of check-in. |
| `notes` | `text` | NULL | NULL | Wedding-specific notes (e.g. access instructions). |
| `docs_required` | `int` | NOT NULL | `0` | Count of docs required (PLI, PAT etc). Used for doc-chase logic. |
| `docs_received` | `int` | NOT NULL | `0` | Count of docs received. |
| `tags` | `text[]` | NOT NULL | `ARRAY[]::text[]` | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger: `trg_wedding_suppliers_updated_at` |

```sql
CREATE INDEX IF NOT EXISTS idx_wedding_suppliers_venue_id   ON public.wedding_suppliers (venue_id);
CREATE INDEX IF NOT EXISTS idx_wedding_suppliers_wedding_id ON public.wedding_suppliers (wedding_id);
CREATE INDEX IF NOT EXISTS idx_wedding_suppliers_supplier_id
  ON public.wedding_suppliers (supplier_id) WHERE supplier_id IS NOT NULL;
```

---

## M13 — Money

### proposals

Purpose: A formal pricing proposal sent to a couple (pre or post booking). Links to a `contact` (pre-booking) and optionally a `wedding` (post-booking, accepted). Status lifecycle: `draft → sent → viewed → accepted | expired`. Demo reference: `src/app/(demo)/preview/money/page.tsx`, `src/app/(demo)/preview/money/proposals/[id]/build/page.tsx`, `src/lib/mock/proposals.ts` (`Proposal`).

RLS pattern: **MEMBER-CRUD**.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE` |
| `contact_id` | `uuid` | NULL | NULL | FK → `contacts(id) ON DELETE SET NULL`. |
| `wedding_id` | `uuid` | NULL | NULL | FK → `weddings(id) ON DELETE SET NULL`. Set when proposal is accepted and wedding created. |
| `ghl_opportunity_id` | `text` | NULL | NULL | GHL opportunity ID for associating proposal with GHL invoices (Phase 3). |
| `status` | `text` | NOT NULL | `'draft'` | `'draft' \| 'sent' \| 'viewed' \| 'accepted' \| 'expired'`. |
| `template_id` | `uuid` | NULL | NULL | FK → `packages(id) ON DELETE SET NULL`. Which package template was used to start this proposal. |
| `discount_type` | `text` | NULL | NULL | `'pct' \| 'fixed'`. NULL = no discount. |
| `discount_value_minor` | `int` | NULL | NULL | Discount amount: percentage (0–100) if `'pct'`, or minor units if `'fixed'`. |
| `deposit_pct` | `int` | NOT NULL | `25` | Deposit percentage (0–100). |
| `vat_pct` | `int` | NULL | NULL | VAT percentage. NULL = not VAT-registered. |
| `subtotal_minor` | `int` | NULL | NULL | Sum of line item totals before discount + VAT. Recomputed on save. |
| `total_minor` | `int` | NULL | NULL | Final total after discount + VAT. Recomputed on save. |
| `hold_until` | `date` | NULL | NULL | Date hold expires if proposal not accepted. |
| `sent_at` | `timestamptz` | NULL | NULL | When the proposal was sent to the couple. |
| `sent_channel` | `text` | NULL | NULL | `'email' \| 'sms' \| 'whatsapp'`. |
| `viewed_at` | `timestamptz` | NULL | NULL | First view (if tracked). |
| `accepted_at` | `timestamptz` | NULL | NULL | When couple accepted. |
| `notes` | `text` | NULL | NULL | Internal notes. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger: `trg_proposals_updated_at` |

```sql
CREATE INDEX IF NOT EXISTS idx_proposals_venue_id      ON public.proposals (venue_id);
CREATE INDEX IF NOT EXISTS idx_proposals_contact_id    ON public.proposals (contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_wedding_id    ON public.proposals (wedding_id) WHERE wedding_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_status        ON public.proposals (venue_id, status);
```

### proposal_line_items

Purpose: Individual line items on a proposal. One-to-many with `proposals`. Demo reference: `src/lib/mock/proposals.ts` (`ProposalLine`).

RLS pattern: **MEMBER-CRUD** (follows parent proposal).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE`. Denormalised for RLS. |
| `proposal_id` | `uuid` | NOT NULL | — | FK → `proposals(id) ON DELETE CASCADE` |
| `package_line_id` | `uuid` | NULL | NULL | FK → `package_lines(id) ON DELETE SET NULL`. Source library item, if from library. |
| `label` | `text` | NOT NULL | — | Line item description (copied from library at time of use; editable per-proposal). |
| `qty` | `int` | NOT NULL | `1` | |
| `unit_minor` | `int` | NOT NULL | — | Unit price in minor units at time of proposal creation (snapshot; not live from library). |
| `unit_type` | `text` | NOT NULL | `'flat'` | `'flat' \| 'per_head' \| 'per_evening'`. |
| `qty_tied_to_guests` | `boolean` | NOT NULL | `false` | |
| `category` | `text` | NOT NULL | `'package'` | `'package' \| 'addon'`. |
| `discount_pct` | `int` | NULL | NULL | Per-line discount percentage. |
| `sort_order` | `int` | NOT NULL | `1000` | |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

```sql
CREATE INDEX IF NOT EXISTS idx_proposal_line_items_venue_id   ON public.proposal_line_items (venue_id);
CREATE INDEX IF NOT EXISTS idx_proposal_line_items_proposal_id ON public.proposal_line_items (proposal_id);
```

### payment_milestones

Purpose: The scheduled payment plan for a wedding — deposit, interim, balance. In GHL-bundled mode these mirror GHL invoice status; in standalone mode they are native VF2 records. Demo reference: `src/lib/mock/index.ts` (`PaymentMilestone`), `src/lib/mock/proposals.ts` (`generateSchedule()`).

RLS pattern: **MEMBER-CRUD** for staff. COUPLE-SCOPED SELECT for couple portal (couples see their own payment schedule).

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `venue_id` | `uuid` | NOT NULL | — | FK → `venues(id) ON DELETE CASCADE` |
| `wedding_id` | `uuid` | NOT NULL | — | FK → `weddings(id) ON DELETE CASCADE` |
| `proposal_id` | `uuid` | NULL | NULL | FK → `proposals(id) ON DELETE SET NULL`. Which proposal this schedule was generated from. |
| `ghl_invoice_id` | `text` | NULL | NULL | GHL invoice ID once created via GHL API (Phase 3). |
| `label` | `text` | NOT NULL | — | E.g. `'Booking deposit (25%)'` |
| `amount_minor` | `int` | NOT NULL | — | Amount in minor units. |
| `due_date` | `date` | NOT NULL | — | |
| `status` | `text` | NOT NULL | `'upcoming'` | `'paid' \| 'due' \| 'upcoming' \| 'overdue'`. |
| `paid_on` | `date` | NULL | NULL | Date payment was confirmed. |
| `reminder_sent` | `boolean` | NOT NULL | `false` | Whether a reminder has been dispatched. |
| `reminder_sent_at` | `timestamptz` | NULL | NULL | When the reminder was sent. |
| `receipt_url` | `text` | NULL | NULL | URL or storage path to receipt PDF. |
| `sort_order` | `int` | NOT NULL | `1000` | Display order (deposit first, balance last). |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| `updated_at` | `timestamptz` | NOT NULL | `now()` | Trigger: `trg_payment_milestones_updated_at` |

```sql
CREATE INDEX IF NOT EXISTS idx_payment_milestones_venue_id   ON public.payment_milestones (venue_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_wedding_id ON public.payment_milestones (wedding_id);
-- Payment health report: upcoming + overdue across a venue
CREATE INDEX IF NOT EXISTS idx_payment_milestones_venue_due
  ON public.payment_milestones (venue_id, due_date)
  WHERE status IN ('due', 'upcoming', 'overdue');
-- GHL invoice lookup
CREATE INDEX IF NOT EXISTS idx_payment_milestones_ghl_invoice
  ON public.payment_milestones (ghl_invoice_id) WHERE ghl_invoice_id IS NOT NULL;
```

**RLS for staff:**
```sql
CREATE POLICY "payment_milestones_select_members" ON public.payment_milestones
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

CREATE POLICY "payment_milestones_insert_members" ON public.payment_milestones
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

CREATE POLICY "payment_milestones_update_members" ON public.payment_milestones
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));
-- No authenticated DELETE — milestones are voided via status change
```

**Couple-portal SELECT policy (added in M8 or M13 — defer to Slice 8):**
```sql
CREATE POLICY "payment_milestones_select_couples" ON public.payment_milestones
  FOR SELECT TO authenticated
  USING (wedding_id IN (SELECT public.current_couple_wedding_ids()));
```

---

## What Is Intentionally NOT Stored

This section documents scope boundaries so future builders do not accidentally add tables for these.

| Data | Where it lives | Why not in Supabase |
|------|---------------|---------------------|
| GHL WhatsApp / SMS / email messages | GHL (services.leadconnectorhq.com) | Architecture decision D3: pre-sales messaging stays entirely in GHL. VF2 renders it via API calls; zero message rows in Supabase. |
| GHL contact full detail mirror | GHL | Only `ghl_contact_id` is stored as a link column. VF2 fetches fresh contact detail from GHL on demand. No local mirror of GHL contact fields beyond what is already on `contacts` (name, email, phone, wedding date). |
| GHL opportunity full mirror | GHL | Only `ghl_opportunity_id` and `ghl_location_id` link columns. Pipeline/stage data is fetched from GHL API for the Daily Brief (Phase 4); not stored. |
| GHL invoices | GHL | Phase 3 stores only `ghl_invoice_id` on `payment_milestones` as a foreign key for API lookups. Invoice line-item details are never mirrored. |
| GHL pipeline stage data for reports | GHL | Daily Brief (Slice 7) fetches from GHL at dispatch time. No local copy. |
| Stripe payment intents / customer portal | Stripe | `billing_subscriptions` stores VF2 SaaS subscription status only (M6). Couple-facing payment for the actual wedding goes through GHL bank transfer (not Stripe). |

---

## RLS Summary Table

| Table | Staff pattern | Couple portal pattern | Notes |
|-------|--------------|----------------------|-------|
| `ghl_credentials` | SERVICE-ROLE-ONLY | n/a | Token security |
| `venues` | SELECT: member; UPDATE: owner/admin; no INSERT/DELETE for auth | n/a | M1 |
| `weddings` | MEMBER-CRUD (DELETE: owner/admin) | n/a | Staff only |
| `couple_accounts` | SELECT: member; writes: service-role | n/a | Auth by service role |
| `floor_templates` | OWNER-ADMIN-WRITE | n/a | Venue config |
| `packages` | OWNER-ADMIN-WRITE | n/a | Venue config |
| `package_lines` | OWNER-ADMIN-WRITE | n/a | Venue config |
| `menu_items` | OWNER-ADMIN-WRITE | n/a | Venue library |
| `menus` | Split (see M10 section) | COUPLE-SCOPED SELECT (Slice 8) | Template vs per-wedding |
| `menu_item_selections` | MEMBER-CRUD | COUPLE-SCOPED SELECT (Slice 8) | |
| `wedding_guests` | MEMBER-CRUD | COUPLE-SCOPED SELECT + INSERT/UPDATE (Slice 8) | |
| `timeline_events` | MEMBER-CRUD | COUPLE-SCOPED SELECT (Slice 8) | |
| `floor_plans` | MEMBER-CRUD | n/a | Staff only |
| `suppliers` | OWNER-ADMIN-WRITE | n/a | Venue directory |
| `wedding_suppliers` | MEMBER-CRUD | COUPLE-SCOPED SELECT (Slice 8) | |
| `proposals` | MEMBER-CRUD | COUPLE-SCOPED SELECT (Slice 8) | |
| `proposal_line_items` | MEMBER-CRUD | COUPLE-SCOPED SELECT (Slice 8) | |
| `payment_milestones` | MEMBER-CRUD (no DELETE) | COUPLE-SCOPED SELECT (Slice 8) | |

---

## Open Questions

**OQ-1 — Credential encryption:** App-layer AES-256-GCM vs Supabase `pgsodium` for `ghl_credentials.access_token` / `refresh_token`. Must be resolved before M7 implementation starts. Recommendation: app-layer (the value is never readable via SQL console or Supabase Studio).

**OQ-2 — Couple portal auth method:** Should couples share a single Supabase `auth.users` project with staff, or be in a separate Supabase project / tenant? Shared project is simpler but requires careful `auth.uid()` disambiguation in RLS (a couple `auth.uid()` must never accidentally match a staff membership). The `couple_accounts.auth_user_id` FK + `current_couple_wedding_ids()` helper handles this, but the risk is worth flagging. Separate project = zero risk of cross-contamination but adds complexity. Decision gates Slice 8.

**OQ-3 — `venues.ghl_mode` type:** Should `ghl_mode` be a DB enum or a constrained text column? Currently spec'd as text with a CHECK constraint for easier future extensibility (e.g. adding `'hybrid'`). If the enum is preferred, it blocks future values without a migration. Decision: leave as text with CHECK unless Emilio has a strong preference.

**OQ-4 — Floor plan canvas schema versioning:** `canvas_json` is untyped jsonb. Changes to the `FloorplanTable` / `RoomElement` shape in `src/lib/mock/planning.ts` during the build could leave orphan rows with stale structure. Recommend adding a `canvas_version int NOT NULL DEFAULT 1` column to `floor_plans` and `floor_templates` so the app can detect and migrate old canvas shapes.

**OQ-5 — `wedding_guests.meal_choice` FK enforcement:** The jsonb field references `menu_item_selections.menu_item_id` values by UUID. No FK enforced at DB level (soft reference). If a `menu_item_selection` row is deleted, guest meal choices referencing it become stale. Options: (a) application-layer nullification on deletion, (b) use a proper junction table `guest_meal_choices(guest_id, menu_item_selection_id)`. Recommend (b) if meal choice reporting is critical (Copilot / Daily Brief); defer to Slice 4 decision.

**OQ-6 — `payment_milestones.status` — enum vs text:** Currently spec'd as text with application-layer CHECK. GHL invoice statuses (returned from `GET /v2/invoices/{id}`) do not exactly map to `'paid' | 'due' | 'upcoming' | 'overdue'`. The mapping logic lives in the Inngest GHL phase 3 function. Confirm the four values are sufficient or whether `'pending_ghl'` is needed for invoices sent but not yet confirmed paid.

---

## Assumptions Made

1. All monetary values are stored in integer minor units (pence/cents) matching the existing `contacts.budget_minor` convention.
2. `ghl_credentials.location_id` equals the GHL sub-account location ID (a 20-character alphanumeric string from the GHL API). One venue = one GHL sub-account location = one `ghl_credentials` row.
3. The `couple_accounts` magic-link activation flow uses Supabase Auth `admin.inviteUserByEmail()` (service-role). The couple user lands in the same `auth.users` table as staff but is distinguished by the absence of a `memberships` row and the presence of a `couple_accounts` row.
4. `floor_plans.canvas_json` uses percentage-based coordinates (0–100 of canvas width/height) matching the existing `FloorplanTable.x/y` and `RoomElement.x/y/w/h` shapes from `src/lib/mock/planning.ts`.
5. The `set_updated_at()` trigger function already exists (defined in `20260611100000_tenancy_layer.sql`). New migrations reuse it; no re-creation needed.
6. All new tables set `SET search_path = ''` on any SECURITY DEFINER functions, matching the existing pattern.
7. `timeline_events.starts_at_time` uses the PostgreSQL `time` type (no timezone) because the wedding date is stored separately on `weddings.wedding_date`. The combined datetime for display is constructed at the application layer: `weddings.wedding_date + timeline_events.starts_at_time AT TIME ZONE venues.timezone`.
