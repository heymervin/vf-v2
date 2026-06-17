# VF2 Schema Decisions — Resolved Forks

> The six spec writers independently sketched several of the same new tables, and disagreed on the
> details. The coherence pass flagged **8 schema-blocking forks** (see [`SPECS-INDEX.md`](./SPECS-INDEX.md)
> → "Decisions Still Needing Human Sign-Off"). This doc **resolves all 8** so migrations are
> unambiguous. These are architect calls; where a call is really a *product* question it is marked
> **CONFIRM** for the team — but a sensible default is chosen so nothing is blocked.
>
> **Authority:** this doc **supersedes** any conflicting inline DDL in `data-model.md`,
> `staff-workspace.md`, `venue-settings.md`, and `couple-portal.md`. When writing the M7+ migrations,
> follow the resolutions here. Decided 2026-06-16.

---

## SD-1 · Mode flag (was Fork 1)

**Resolved:** one column.
```sql
ALTER TABLE venues ADD COLUMN mode text NOT NULL DEFAULT 'bundled'
  CHECK (mode IN ('bundled','standalone'));
```
Drop the proposed `venues.ghl_enabled` boolean — it is derivable (`mode = 'bundled'`). One explicit
column, room to grow, defaults to the path we are actually building (GHL-backed).

**CONFIRM (low-risk):** new-venue default = `'bundled'`. All current TWM venues have a GHL sub-account,
so this is right; standalone is the future fallback, not the default.

---

## SD-2 · `weddings` columns (was Fork 2)

**Resolved canonical shape** (data-model M8 is the schema home; this is the agreed column set):

| Column | Type | Note |
|---|---|---|
| `id` | uuid PK | |
| `venue_id` | uuid NOT NULL FK→venues | tenant |
| `contact_id` | uuid NULL FK→contacts | nullable (standalone / manual create) |
| `ghl_opportunity_id` | text NULL | link key to the won GHL deal |
| `couple_names` | text | display string, e.g. "Henderson & Carter" (partner detail lives in `couple_accounts`) |
| `wedding_date` | date NULL | |
| `space_id` | uuid NULL FK→spaces | |
| `guest_count_day` | int NULL | **split** day vs evening (UK norm) |
| `guest_count_evening` | int NULL | |
| `package_id` | uuid NULL FK→packages | FK, not a denormalized name |
| `total_value_minor` | int | money in **minor units / pence** (see SD-7) |
| `menu_id` | uuid NULL FK→menus | chosen menu template (see SD-4) |
| `status` | text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','confirmed','completed','cancelled')) | |
| `source` | text NOT NULL DEFAULT 'manual' CHECK (source IN ('ghl_webhook','manual')) | D6 — how it was created |
| `coordinator_membership_id` | uuid NULL FK→memberships | assigned staff coordinator |
| `custom` | jsonb DEFAULT '{}' | custom-field values (mirrors `contacts.custom`) |
| `created_at` / `updated_at` | timestamptz | standard trigger |

RLS: **member CRUD** (staff operational record). `staff-workspace.md`'s `couple_display_name` /
`coordinator_id` / `total_value numeric` variants are superseded by the above.

**CONFIRM (product):** split `guest_count_day` / `guest_count_evening` — kept as the safe superset
(a venue that doesn't split can just use `_day`). Confirm this matches how venues actually quote.

---

## SD-3 · `couple_accounts` + invite mechanism (was Fork 3)

**Resolved:** use **Supabase-native auth** (reuse the staff auth stack), not a custom token table.

```sql
CREATE TABLE couple_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  wedding_id    uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  user_id       uuid NULL REFERENCES auth.users(id),     -- linked on activation
  email         citext NOT NULL,
  first_name    text,
  role          text NULL CHECK (role IN ('partner_a','partner_b')),
  status        text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','disabled')),
  invited_at    timestamptz,
  activated_at  timestamptz,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wedding_id, email)
);
```

- **Invite flow:** Supabase `auth.admin.inviteUserByEmail` (magic link). Landing route: **`/portal`**
  (the invite link drops the couple into the portal once authenticated). Drop the `invite_token`
  column, the `/portal/activate` + `/portal/accept` + `/portal/auth/magic-link` variants, and the
  `auth.admin.createUser` path. One mechanism, one route.
- **`status`** stays (the `current_couple_wedding_ids()` helper filters `status = 'active'`).
- Column drift resolved: `last_login_at` (not `last_seen_at`); `role` kept as `partner_a`/`partner_b`
  (nullable — a single-login couple can leave it null).
- Couple-only RLS helper (Slice 8):
  ```sql
  -- SECURITY DEFINER, SETOF uuid, plural — matches current_venue_ids()
  CREATE FUNCTION current_couple_wedding_ids() RETURNS SETOF uuid ...
    SELECT wedding_id FROM couple_accounts
     WHERE user_id = auth.uid() AND status = 'active';
  ```

**CONFIRM (infra, not blocking the migration):** same Supabase project for staff + couples, RLS-isolated
(recommended — simpler) vs a separate project. Index item #15.

---

## SD-4 · Menu / course model (was Fork 4 + Fork 8)

**Resolved:** library menus are templates; per-wedding choices get their own table.

- **`menu_items.course`** = **free-text, Title-case** (`'Canapé'`, `'Starter'`, `'Main'`, `'Dessert'`).
  No DB enum — venues structure courses differently. (Supersedes venue-settings' lowercase CHECK enum.)
- **`menus`** = **one row per named menu template** (`id`, `venue_id`, `name`, `is_active`, `notes`,
  timestamps; admin-write). Courses are *derived* from the items' `course` + selection `sort_index` —
  **not** stored as one-row-per-course-slot, and there is **no `course_structure jsonb`**.
- **`menu_item_selections`** = library join: which items belong to which template
  (`id`, `venue_id`, `menu_id` FK, `menu_item_id` FK, `course`, `sort_index`; admin-write).
- **Per-wedding (Fork 8 resolved):** a wedding picks a template via **`weddings.menu_id`** (SD-2), and
  actual per-wedding choices/overrides live in a **new** table — `menu_item_selections` is **not**
  reused per-wedding:
  ```sql
  CREATE TABLE wedding_menu_selections (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    venue_id      uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    wedding_id    uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
    menu_item_id  uuid NOT NULL REFERENCES menu_items(id),
    course        text,
    sort_index    numeric NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );  -- member CRUD; couple read/write own wedding via couple RLS (Slice 8)
  ```
- **No `courses` table.** couple-portal's `couple_menu_selections.course_id` → use the `course` text
  field; `couple_menu_selections` is the same concept as `wedding_menu_selections` — use the latter name.

---

## SD-5 · Floor-plan storage (was Fork 5)

**Resolved:** **jsonb blob** for both template and per-wedding (the demo already uses object/array
canvas data; normalizing tables/seats is premature).

```sql
-- venue settings (Slice 3): per-space starting template
CREATE TABLE floor_templates (
  id uuid PK, venue_id FK, space_id uuid FK→spaces, name text,
  layout jsonb NOT NULL DEFAULT '{}', created_at, updated_at);   -- admin-write

-- per wedding (Slice 4): the wedding's working plan, seeded from a template
CREATE TABLE floor_plans (
  id uuid PK, venue_id FK, wedding_id uuid FK→weddings, space_id uuid NULL FK→spaces,
  layout jsonb NOT NULL DEFAULT '{}', created_at, updated_at);   -- member CRUD
```

Drop `floor_plan_tables`, `floor_plan_seats`, and `floor_template_tables`. Table→guest seat
assignments live **inside `layout`** (referencing `wedding_guests.id`); `wedding_guests.table_assignment text`
remains as the simple denormalized pointer for list views. (Revisit normalization only if we need
SQL-level seating queries — `data-model OQ-4` `canvas_version` can live inside `layout`.)

---

## SD-6 · Documents table (was Fork 6)

**Resolved:** one table, **`wedding_documents`** (clearer name; serves both staff doc-tracking and
couple-facing contract/sign).

```sql
CREATE TABLE wedding_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  wedding_id    uuid NOT NULL REFERENCES weddings(id) ON DELETE CASCADE,
  kind          text,                              -- contract | invoice-pdf | supplier-doc | other
  name          text,
  storage_path  text NOT NULL,                     -- Supabase Storage
  supplier_id   uuid NULL REFERENCES suppliers(id),
  uploaded_by   uuid NULL,                         -- membership or couple user id
  expiry_date   date NULL,                         -- staff: chase tracking
  last_chased_at timestamptz NULL,
  signed_at     timestamptz NULL,                  -- couple: e-sign
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);  -- member CRUD (staff); couple read + sign their own wedding's docs via couple RLS (Slice 8)
```
Drop `wedding_docs`. Contract e-sign native-vs-external (index #17 / couple-portal OQ-3) is a later UX
call; `signed_at` supports either.

---

## SD-7 · Money units (was Fork 7)

**Resolved:** **integer minor units (pence) app-wide.** Every money column is `*_minor int`, matching
the existing `contacts.budget_minor`. Supersedes all `numeric(10,2)` / `numeric(12,2)` variants.

Affected: `weddings.total_value_minor`, `packages.from_price_minor`, `package_lines.*_minor`,
`menu_items.price_per_head_minor`, `proposals.total_minor`, `proposal_line_items.*_minor`,
`payment_milestones.amount_minor`. Format to currency in the UI layer only.

---

## SD-8 · Credential encryption (was Fork "8"/R7)

**Resolved:** **app-layer AES-256-GCM**, keyed by env `GHL_TOKEN_ENCRYPTION_KEY`, encrypt/decrypt
inside the `ghlClient` / connect-action server boundary. Not `pgsodium`/Vault (portability; Supabase
is deprecating `pgsodium` in favor of Vault, and app-layer keeps the secret out of the DB entirely).
`ghl_credentials.access_token` / `refresh_token` stay `text` (ciphertext) — **column shape is
unchanged**, so this gates code, not the M7 migration. RLS on `ghl_credentials` remains
**service-role-only** (no authenticated token read) regardless.

---

## Still open (NOT resolved here — out of schema scope)

These remain for the team; they don't block the M7–M13 migrations:

- **Go-live / GHL (Mando):** win-detection model (status vs stage), WhatsApp Business approval,
  OAuth app + scopes timing, per-location webhook registration. (Index #9–12.)
- **Product / UX:** standalone-mode scope, onboarding wizard vs new checklist, per-guest meal-choice
  normalization, and the smaller flagged items. (Index #13–17.)

See [`SPECS-INDEX.md`](./SPECS-INDEX.md) for the full list.
