# Venue Settings — Spec

> **Slice:** 3 — Venue config/libraries (admin side first)  
> **Depends on:** Slice 1 (ghl_credentials + ghlClient), Slice 2 (weddings + couple_accounts)  
> **Demo reference:** `src/app/(demo)/preview/admin/*`  
> **Build target:** `src/app/(app)/settings/*` + new sub-routes listed below  
> **Decision anchor:** D5 (gating), D4 (menu architecture), D6 (standalone fallback), D8 (internal-first)

---

## 1. Settings Hub Structure

### Current real settings (`src/app/(app)/settings/`)

| Sub-page | Route | Status | Action |
|---|---|---|---|
| Hub index | `/settings` | Exists — lists 5 tiles | Expand to include 6 new sections |
| Enquiry form | `/settings/forms` | Exists — standalone-mode feature | Keep; in GHL-bundled mode show read-only note pointing to GHL |
| Brochure | `/settings/brochure` | Exists | Keep |
| Nurture sequence | `/settings/sequences` | Exists — standalone-mode feature | Keep; same bundled-mode note as forms |
| Availability | `/settings/availability` | Exists | Keep (viewing bookings are native) |
| Billing | `/settings/billing` | Exists — Stripe SaaS billing | Keep |

### New settings sub-pages (Slice 3 build)

| Sub-page | Route | Ports demo | Persists to |
|---|---|---|---|
| Profile & brand | `/settings/profile` | `preview/admin/page.tsx` + `profile-client.tsx` | `venues` table |
| Spaces | `/settings/spaces` | `preview/admin/spaces/spaces-client.tsx` | `spaces` table |
| Floor templates | `/settings/spaces/[id]/floor` | `preview/admin/spaces/[id]/floor/floor-config-client.tsx` | `floor_templates` table (new) |
| Menu library | `/settings/menu` | `preview/admin/menu/menu-library-client.tsx` | `menu_items` table (new) |
| Packages & pricing | `/settings/packages` | `preview/admin/packages/packages-client.tsx` | `packages` + `package_lines` tables (new) |
| Team & roles | `/settings/team` | `preview/admin/team/team-client.tsx` | `memberships` (existing) + invite token flow (new) |
| Custom fields | `/settings/custom-fields` | `preview/admin/custom-fields/custom-fields-client.tsx` | `custom_fields` table (new) |
| GHL connect | `/settings/ghl` | (no demo — links to ghl-integration spec) | `ghl_credentials` table |

### Updated hub index (`/settings`)

The hub `page.tsx` must gain two new groups separated by visual dividers:

- **Venue identity** — Profile & brand, Spaces, Menu library, Packages, Custom fields
- **Team** — Team & roles
- **Integrations** — GHL connect
- **Standalone CRM** (shown only when `venues.ghl_enabled = false`) — Enquiry form, Brochure, Nurture sequence
- **Platform** — Availability, Billing

---

## 2. Venue Profile & Brand

**Demo source:** `src/app/(demo)/preview/admin/page.tsx` and `profile-client.tsx`  
**Real route:** `src/app/(app)/settings/profile/page.tsx` + `profile-client.tsx`  
**Persists to:** `venues` table

### Fields captured

| Demo field | Column | Notes |
|---|---|---|
| Venue name (trading) | `venues.name` | Already exists |
| Legal name | `venues.legal_name` | **New column** — used in contracts/invoices |
| Tagline | `venues.tagline` | **New column** — email footers + portal header |
| Timezone | `venues.timezone` | Already exists |
| Address | `venues.address` | **New column** (text multiline) |
| Phone | `venues.phone` | **New column** |
| Logo | `venues.logo_path` | Already exists — Storage upload to `venue-assets/{venue_id}/logo.*` |
| Accent colour seed | `venues.accent_seed` | **New column** — one of 6 enum values (pink/teal/blue/green/mint/muted) |
| Opening hours | `venue_hours` | Already exists (separate table, weekday 0–6) |

### New columns on `venues`

```sql
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS legal_name  text,
  ADD COLUMN IF NOT EXISTS tagline     text,
  ADD COLUMN IF NOT EXISTS address     text,
  ADD COLUMN IF NOT EXISTS phone       text,
  ADD COLUMN IF NOT EXISTS accent_seed text NOT NULL DEFAULT 'pink'
    CHECK (accent_seed IN ('pink','teal','blue','green','mint','muted'));
```

**RLS:** existing `venues_update_owners_admins` policy covers this; no new policy needed.

### Server action

`src/app/(app)/settings/actions.ts` (already exists) — add `updateVenueProfile(venueId, data)` using service-role client for venue row update + `upsertVenueHours(venueId, hours[])` for bulk-upsert of the 7-day hours array into `venue_hours` (ON CONFLICT (venue_id, weekday) DO UPDATE).

### Reflected on

- Brochure email (logo, name, tagline)
- Couple portal header (logo, accent_seed)
- Contract template (legal_name, address)

---

## 3. Spaces

**Demo source:** `src/app/(demo)/preview/admin/spaces/spaces-client.tsx`  
**Real route:** `src/app/(app)/settings/spaces/page.tsx` + `spaces-client.tsx`  
**Persists to:** `spaces` table (existing)

### Existing `spaces` columns

```
id, venue_id, name, capacity_seated, capacity_standing, description, created_at, updated_at
```

### Missing columns vs demo

The demo `Space` type includes `indoorOutdoor`, `ceremonyCapacity`, `photoUrl`, and `order`. These are missing from the existing migration.

**New columns on `spaces`:**

```sql
ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS indoor_outdoor     text NOT NULL DEFAULT 'indoor'
    CHECK (indoor_outdoor IN ('indoor', 'outdoor', 'both')),
  ADD COLUMN IF NOT EXISTS capacity_ceremony  int,
  ADD COLUMN IF NOT EXISTS photo_path         text,
  ADD COLUMN IF NOT EXISTS sort_order         int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_archived        boolean NOT NULL DEFAULT false;
```

**RLS:** existing `spaces_*` policies cover all four verbs; no new policy needed.

### UX notes from demo

- Cards view vs table view toggle (DataToolbar pattern — already in demo)
- Archive soft-deletes (set `is_archived = true`); archived spaces hidden by default
- Each card has a "Configure floor" link → `/settings/spaces/[id]/floor`

---

## 4. Floor Templates Per Space

**Demo source:** `src/app/(demo)/preview/admin/spaces/[id]/floor/floor-config-client.tsx`  
**Real route:** `src/app/(app)/settings/spaces/[id]/floor/page.tsx` + `floor-config-client.tsx`  
**Persists to:** `floor_templates` table (new) + `floor_template_tables` table (new)

### New tables

#### `floor_templates`

```sql
CREATE TABLE public.floor_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  space_id    uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  table_count int         NOT NULL DEFAULT 0,   -- denormalised for display
  capacity    int         NOT NULL DEFAULT 0,   -- sum of table seats, denormalised
  is_default  boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_floor_templates_default
  ON public.floor_templates (space_id)
  WHERE is_default = true;   -- only one default per space
```

**RLS:** standard owner/admin write, member read — same pattern as `spaces`.

#### `floor_template_tables`

```sql
CREATE TABLE public.floor_template_tables (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_template_id uuid      NOT NULL REFERENCES public.floor_templates(id) ON DELETE CASCADE,
  table_number    int         NOT NULL,
  shape           text        NOT NULL CHECK (shape IN ('round','banquet','square','top')),
  capacity        int         NOT NULL,
  x_pct           numeric(5,2) NOT NULL,   -- position as % of canvas width
  y_pct           numeric(5,2) NOT NULL,   -- position as % of canvas height
  label           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_floor_template_tables_template_id
  ON public.floor_template_tables (floor_template_id);
```

**RLS:** inherits venue_id via floor_template_id join — use a SECURITY DEFINER helper or join-through policy. Simplest: add `venue_id` column to `floor_template_tables` denormalised (same pattern as stage_events) and apply standard policy.

### Gating (D5)

- The "Configure floor" link in the Spaces list is **disabled/greyed** when the space has `is_archived = true`.
- The per-wedding floor plan tool (Slice 4) is **locked** until the assigned space has at least one `floor_template` row.

### UX from demo

- Preset strip: named layout presets (e.g. "Full capacity — 16 rounds") load a canned table arrangement.
- Canvas: `FloorCanvas` + `ShapedTable` components already exist in `src/components/floorplan/`.
- Right panel: add/edit/remove individual tables; capacity counter vs space seated capacity.
- "Save template" → persists to `floor_template_tables`.

---

## 5. Menu Library

**Demo source:** `src/app/(demo)/preview/admin/menu/menu-library-client.tsx`  
**Real route:** `src/app/(app)/settings/menu/page.tsx` + `menu-library-client.tsx`  
**Persists to:** `menu_items` table (new)

**Decision D4:** Items-first architecture. `menu_items` is the master catalogue. Per-wedding menus (`menus` table, Slice 2/4) reference items via `menu_item_selections` join table. Editing one item propagates everywhere it is used.

### New table: `menu_items`

```sql
CREATE TABLE public.menu_items (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id       uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  course         text        NOT NULL
    CHECK (course IN ('starter','main','dessert','children','evening')),
  description    text        NOT NULL DEFAULT '',
  price_per_head numeric(10,2) NOT NULL DEFAULT 0,
  photo_path     text,
  allergens      text[]      NOT NULL DEFAULT '{}',
  dietary        text[]      NOT NULL DEFAULT '{}',
  is_active      boolean     NOT NULL DEFAULT true,
  sort_order     int         NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_venue_id ON public.menu_items (venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_course   ON public.menu_items (venue_id, course);
```

**RLS:** standard — members read, owners/admins write (INSERT/UPDATE/DELETE).

```sql
-- SELECT: any member
CREATE POLICY "menu_items_select_members" ON public.menu_items
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- INSERT/UPDATE/DELETE: owner or admin
CREATE POLICY "menu_items_write_owners_admins" ON public.menu_items
  FOR ALL TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));
```

### Course enum mapping (demo → DB)

| Demo display | DB value |
|---|---|
| Starter | `starter` |
| Main | `main` |
| Dessert | `dessert` |
| Children | `children` |
| Evening | `evening` |

### Allergens & dietary

Stored as `text[]`. Enforced values (Natasha's Law 14): `celery, crustaceans, dairy, egg, fish, gluten, lupin, molluscs, mustard, nuts, peanuts, sesame, soya, sulphites`. Dietary tags: `vegan, vegetarian, gluten-free, dairy-free, nut-free`. No DB constraint on array values (checked in server action).

### Photo upload

Same pattern as logo: `venue-assets/{venue_id}/menu/{item_id}.*`; store relative path in `photo_path`.

### Gating (D5)

- Per-wedding menu builder (Slice 4) is **locked** if `menu_items` has zero active items for the venue.
- Lock state: grey out "Menu" tab in wedding workspace; show "Set up menu library first" CTA linking to `/settings/menu`.

---

## 6. Packages & Pricing

**Demo source:** `src/app/(demo)/preview/admin/packages/packages-client.tsx`  
**Real route:** `src/app/(app)/settings/packages/page.tsx` + `packages-client.tsx`  
**Persists to:** `packages` + `package_lines` tables (new)

### New table: `packages`

```sql
CREATE TABLE public.packages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  season      text        NOT NULL DEFAULT 'All year'
    CHECK (season IN ('Summer','Autumn','Winter','Spring','All year')),
  description text        NOT NULL DEFAULT '',
  from_price  numeric(10,2) NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packages_venue_id ON public.packages (venue_id);
```

### New table: `package_lines`

```sql
CREATE TABLE public.package_lines (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id          uuid        NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  venue_id            uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  label               text        NOT NULL,
  unit                numeric(10,2) NOT NULL DEFAULT 0,
  unit_type           text        NOT NULL DEFAULT 'flat'
    CHECK (unit_type IN ('flat','per_head','per_evening')),
  qty_tied_to_guests  boolean     NOT NULL DEFAULT false,
  sort_order          int         NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_package_lines_package_id ON public.package_lines (package_id);
CREATE INDEX IF NOT EXISTS idx_package_lines_venue_id   ON public.package_lines (venue_id);
```

**Note:** `venue_id` is denormalised onto `package_lines` so the standard RLS policy can scope directly without a join. This is the same pattern as `stage_events`.

**RLS for both tables:** members read, owners/admins write.

### Add-ons & drinks

The demo surfaces `evening` + `drinks` menu_items alongside packages in the price list. In the real version the "Add-ons & drinks" section is a filtered read of `menu_items` (no second table). Prices are set on `menu_items.price_per_head`.

### Feeds

The proposal builder (Slice 5) reads from `packages` + `package_lines` to populate the price library.

### Gating (D5)

No hard gate on proposal builder, but an empty-packages warning is shown when the builder opens with no packages configured. Link goes to `/settings/packages`.

---

## 7. Team & Roles

**Demo source:** `src/app/(demo)/preview/admin/team/team-client.tsx`  
**Real route:** `src/app/(app)/settings/team/page.tsx` + `team-client.tsx`  
**Persists to:** `memberships` table (existing) + `invite_tokens` table (new)

### Existing `memberships` columns

```
id, venue_id, user_id, role (owner|admin|member), created_at, updated_at
```

### Gap: invite flow

The demo shows an "Invite member" sheet. The demo prototype calls `toast("Invitation sent")` — no backend. The real flow requires:

1. Staff fills in name + email + role in the invite sheet.
2. Server action creates an `invite_tokens` row and sends a Resend email with a magic link.
3. Invitee clicks the link, signs up (or signs in) — callback creates the `memberships` row.

### New table: `invite_tokens`

```sql
CREATE TABLE public.invite_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  email       citext      NOT NULL,
  role        text        NOT NULL CHECK (role IN ('admin','member')),
  token       text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by  uuid        NOT NULL REFERENCES auth.users(id),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_tokens_venue_id ON public.invite_tokens (venue_id);
CREATE INDEX IF NOT EXISTS idx_invite_tokens_token    ON public.invite_tokens (token);
```

**RLS on `invite_tokens`:**
- INSERT: owner or admin of the venue (`current_owner_or_admin_venue_ids()`)
- SELECT: owner or admin of the venue (to see pending invites)
- No authenticated UPDATE/DELETE — acceptance and expiry are handled by a server action (service-role client)

**Invite acceptance route:** `src/app/api/invite/accept/route.ts` (new) — validates token, creates membership, marks `accepted_at`.

### Role capabilities matrix

The demo renders a `PermissionMatrix` component hard-coded to the 3 roles (owner/admin/member). In the real build this matrix is **display-only** — capabilities are enforced by RLS policies, not a DB capabilities table. The matrix is seeded in `src/lib/constants/role-permissions.ts`.

| Capability | Owner | Admin | Member |
|---|---|---|---|
| manage_billing | Y | — | — |
| manage_settings | Y | Y | — |
| manage_team | Y | — | — |
| manage_pipeline | Y | Y | Y |
| edit_weddings | Y | Y | Y |
| view_reports | Y | Y | — |
| send_messages | Y | Y | Y |

**Owner cannot be removed.** The invite sheet filters roles to `admin` and `member` (matches demo: owner is excluded from the dropdown).

---

## 8. Custom Fields

**Demo source:** `src/app/(demo)/preview/admin/custom-fields/custom-fields-client.tsx`  
**Real route:** `src/app/(app)/settings/custom-fields/page.tsx` + `custom-fields-client.tsx`  
**Persists to:** `custom_fields` table (new)

### New table: `custom_fields`

```sql
CREATE TABLE public.custom_fields (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  key         text        NOT NULL,     -- slug auto-derived from label; used in contacts.custom jsonb
  label       text        NOT NULL,
  type        text        NOT NULL CHECK (type IN ('text','number','select','date')),
  options     text[],                  -- only populated when type = 'select'
  applies_to  text        NOT NULL CHECK (applies_to IN ('contact','wedding')),
  sort_order  int         NOT NULL DEFAULT 0,
  is_archived boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_fields_venue_key_unique UNIQUE (venue_id, key)
);

CREATE INDEX IF NOT EXISTS idx_custom_fields_venue_id ON public.custom_fields (venue_id);
```

**RLS:** members read, owners/admins write.

### Cap

12 active fields per venue (matches demo `FIELD_CAP = 12`). Enforced in the server action — count active fields before inserting; return a 400 if at cap.

### Where values live

- `applies_to = 'contact'` → values stored in `contacts.custom jsonb` (column already exists in M2).
- `applies_to = 'wedding'` → values stored in `weddings.custom jsonb` (defined in `specs/data-model.md` M8, mirroring the `contacts.custom` pattern).

### Rendered in

- Contact detail page key-facts section
- Wedding Workspace hub key-facts panel

---

## 9. GHL Connect Tile

**Demo source:** none (GHL integration was post-demo decision)  
**Real route:** `src/app/(app)/settings/ghl/page.tsx`  
**Persists to:** `ghl_credentials` table

### Table: `ghl_credentials`

The authoritative column list lives in [`specs/data-model.md`](./data-model.md) (M7) and [`specs/ghl-integration.md`](./ghl-integration.md) §13.1 — including the `auth_type` (`pit`/`oauth`) and `scopes` columns this tile needs. Do not redefine the table here; this section only specifies the settings UI that writes to it (created in Slice 1, not Slice 3).

**RLS:** SERVICE-ROLE-ONLY — no authenticated client reads the token columns. The tile learns connection status via a server action returning `{ connected, locationId }`, never by selecting from the table directly (see ghl-integration.md §13.1, Assumption A-3).

### Settings tile UX

The tile shows one of three states:
1. **Not connected** — "Connect GHL" button → initiates PIT entry (MVP) or OAuth flow (production).
2. **Connected** — shows `location_id`, connected-at date, disconnect button.
3. **Error** (token expired, API unreachable) — warning badge, reconnect CTA.

### GHL-enabled flag

```sql
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS ghl_enabled boolean NOT NULL DEFAULT false;
```

This flag (D2) controls which mode the venue is in. Set `true` when credentials are saved successfully. The flag is used throughout the app to conditionally show standalone-mode vs GHL-bundled UI.

**For full GHL integration spec see:** [`specs/ghl-integration.md`](./ghl-integration.md).

---

## 10. Gating Model (D5)

### Feature → Prerequisite → Locked State

| Feature (planning tool) | Prerequisite in settings | Locked state UX |
|---|---|---|
| Per-wedding floor plan | Space exists AND space has at least one `floor_template` | Floor plan tab in wedding workspace is greyed; tooltip "Configure a floor template for this space first" with link to `/settings/spaces/[id]/floor` |
| Per-wedding menu | `menu_items` has at least one active item | Menu tab greyed; "Add dishes to your menu library first" CTA → `/settings/menu` |
| Proposal builder price library | `packages` has at least one active package | Proposal builder shows empty-packages notice; link → `/settings/packages` |
| Couple portal invite | `couple_accounts` need a portal to receive | No gate; invites can be sent as soon as a wedding exists |
| Run sheet / timeline | Wedding exists (no extra config) | No gate |
| Supplier directory | No prerequisite | No gate |
| GHL-specific features (opp-won trigger, invoice mirror, etc.) | `ghl_credentials` exists AND `venues.ghl_enabled = true` | GHL sections not rendered; non-intrusive "Connect GHL in Settings" nudge in relevant places |

### Gating implementation pattern

Use a simple server-side check in the page or layout that renders the planning-tool tab:

```typescript
// Example: floor plan gate check (server component)
const templateCount = await supabase
  .from('floor_templates')
  .select('id', { count: 'exact', head: true })
  .eq('space_id', space.id)
  .eq('venue_id', venueId)

const isLocked = (templateCount.count ?? 0) === 0
```

Locked state is a `<LockedFeature>` wrapper component that renders a grey overlay + CTA rather than completely hiding the tab (better UX: user understands the feature exists but needs setup).

### First-login guided setup checklist

Replaces the existing `/onboarding` wizard (which is 3-step, focused on pre-sales forms). The new checklist surfaces after first login in the staff app as a dismissible banner or a dedicated `/setup` page.

**Checklist items in priority order:**

1. Complete venue profile (name, logo, timezone) → `/settings/profile`
2. Add at least one space → `/settings/spaces`
3. Configure a floor template for each space → `/settings/spaces/[id]/floor`
4. Add dishes to the menu library → `/settings/menu`
5. Set up packages & pricing → `/settings/packages`
6. Invite your team → `/settings/team`
7. Connect GHL (if using bundled mode) → `/settings/ghl`

**Tracking setup completion:** Add a `setup_completed_steps` jsonb column to `venues`:

```sql
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS setup_completed_steps jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Server actions mark steps complete (e.g. `{ "profile": true, "spaces": true }`). The checklist banner queries this column and hides when all steps are done (or is dismissed by setting `setup_dismissed_at timestamptz`).

**Open question OQ-1:** Should the existing `/onboarding` wizard (M1-era 3-step flow) be deprecated in favour of this new checklist, or should both coexist? The old wizard is focused on pre-sales (enquiry form, brochure, availability). The new checklist is focused on post-booking config. Recommendation: keep the old wizard for standalone-mode venues; show the new setup checklist for GHL-bundled venues or as an additional "complete your profile" nudge for all venues.

---

## 11. Discard Note: /preview/admin/messaging

`src/app/(demo)/preview/admin/messaging/` is **NOT ported to real settings**.

**Reason (D3):** Pre-sales messaging identity (WhatsApp number, SMS sender) is owned by GHL. In GHL-bundled mode the venue configures this in GHL directly; VF2 has no involvement. In standalone mode, messaging is email-only (Resend) and is configured via `/settings/sequences` (already real).

The messaging admin screen in the demo was a prototype placeholder for a feature that was superseded by the GHL architecture decision. It can be deleted from the demo route group once Slice 4 is complete and the demo is retired.

---

## 12. New Tables & Columns Summary

### New tables (this spec)

| Table | Purpose | Slice |
|---|---|---|
| `floor_templates` | Named table-layout presets per space | 3 |
| `floor_template_tables` | Individual table entries in a floor template | 3 |
| `menu_items` | Master dish catalogue per venue | 3 |
| `packages` | Pricing packages per venue | 3 |
| `package_lines` | Line items within a package | 3 |
| `custom_fields` | Venue-specific field definitions | 3 |
| `invite_tokens` | Pending team invitations with expiry | 3 |

### New columns on existing tables

| Table | Column(s) | Notes |
|---|---|---|
| `venues` | `legal_name`, `tagline`, `address`, `phone`, `accent_seed`, `ghl_enabled`, `setup_completed_steps` | Profile + mode flag + onboarding tracking |
| `spaces` | `indoor_outdoor`, `capacity_ceremony`, `photo_path`, `sort_order`, `is_archived` | Missing from M1 migration |

### Previously specified tables (not in this spec, but referenced)

| Table | Specified in |
|---|---|
| `ghl_credentials` | `specs/data-model.md` (M7) + `specs/ghl-integration.md` §13.1 |
| `weddings` | `specs/data-model.md` (M8) + `specs/staff-workspace.md` §3 |
| `couple_accounts` | `specs/data-model.md` (M8) + `specs/couple-portal.md` §2 |
| `menus` | `specs/data-model.md` (M10) |
| `menu_item_selections` | `specs/data-model.md` (M10) |

---

## 13. Migration Placement

These tables and column alterations span the Slice 3 migrations defined authoritatively in [`specs/data-model.md`](./data-model.md) (the migration map there is the single source of truth for file names and `m`-numbers):

- `supabase/migrations/20260618000001_m9_venue_config.sql` — `floor_templates` (+ `floor_template_tables`), `packages`, `package_lines`, `custom_fields`, `invite_tokens`, and the `venues`/`spaces` column additions in this spec.
- `supabase/migrations/20260619000001_m10_menu.sql` — `menu_items` (the venue menu library; the per-wedding `menus` + `menu_item_selections` also land here per data-model).

`ghl_credentials` and `venues.ghl_enabled` are **not** created here — they land in `m7` (Slice 1). All migrations are idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` before recreate).

---

## 14. File Paths

```
src/
  app/
    (app)/
      settings/
        page.tsx                    ← Update: add new sections to hub
        actions.ts                  ← Update: add updateVenueProfile, upsertVenueHours
        profile/
          page.tsx                  ← New (server: fetch venue row)
          profile-client.tsx        ← Port from preview/admin/profile-client.tsx
        spaces/
          page.tsx                  ← New (server: fetch spaces list)
          spaces-client.tsx         ← Port from preview/admin/spaces/spaces-client.tsx
          [id]/
            floor/
              page.tsx              ← New (server: fetch space + templates)
              floor-config-client.tsx ← Port from preview/admin/spaces/[id]/floor/floor-config-client.tsx
        menu/
          page.tsx                  ← New (server: fetch menu_items)
          menu-library-client.tsx   ← Port from preview/admin/menu/menu-library-client.tsx
        packages/
          page.tsx                  ← New (server: fetch packages + menu_items for add-ons)
          packages-client.tsx       ← Port from preview/admin/packages/packages-client.tsx
        team/
          page.tsx                  ← New (server: fetch memberships + invite_tokens)
          team-client.tsx           ← Port from preview/admin/team/team-client.tsx
        custom-fields/
          page.tsx                  ← New (server: fetch custom_fields)
          custom-fields-client.tsx  ← Port from preview/admin/custom-fields/custom-fields-client.tsx
        ghl/
          page.tsx                  ← New (server: fetch ghl_credentials status)
  api/
    invite/
      accept/
        route.ts                    ← New: validate token + create membership

supabase/
  migrations/
    20260618000001_m9_venue_config.sql  ← floor_templates, packages, package_lines, custom_fields, invite_tokens, venues/spaces columns
    20260619000001_m10_menu.sql         ← menu_items (menu library)
```

---

## 15. Open Questions

**OQ-1:** Retire the existing `/onboarding` wizard or keep it alongside the new setup checklist? (See section 10.) Recommendation: coexist for now; deprecate `/onboarding` only after the new checklist ships and is validated with Kai/Trey.

**OQ-2:** Floor template storage — should table positions be stored as percentage-of-canvas or absolute pixel values? Spec uses percentages (consistent with demo `FloorCanvas`), but pixel values might be more precise if the canvas size is always fixed. Percentages are responsive and canvas-size-agnostic.

**OQ-3:** Currency handling — demo uses GBP (£) hardcoded throughout packages and menu pricing. Should `packages.from_price` and `menu_items.price_per_head` be in integer minor units (pence) with a `currency` column, or in `numeric(10,2)` major units? Current spec uses `numeric(10,2)` matching the existing `contacts.budget_minor int` being in minor units — this is inconsistent. **Decide before writing the migration.** Recommendation: align on `numeric(10,2)` for display-facing prices (packages, menu items) and keep `budget_minor int` for budget estimates on contacts. These serve different purposes.

**OQ-4:** `ghl_credentials.access_token` encryption — Supabase vault vs pgsodium directly vs application-layer AES before insert? The GHL-BACKEND-PLAN.md says "encrypted at rest" but doesn't specify the mechanism. Needs decision before the GHL credential save action is written.

**OQ-5:** Team invite email — the invite accept flow needs an email template (Resend). What does the invite email look like? Who is it from (venue name, VenueFlow platform)? This is a copy/design question for Kai.

**OQ-6:** `setup_completed_steps` jsonb on venues — alternative to a column is a separate `venue_setup` table. The column approach is simpler for a small fixed checklist. Only revisit if the checklist grows to 15+ items or needs per-step timestamps.

---

## 16. Assumptions Made

1. All settings pages are owner/admin only. Regular members (`role = 'member'`) do not have access to `/settings/*`. This is enforced at the route-group layout level (add a role check to `src/app/(app)/settings/layout.tsx` if it doesn't exist).
2. The existing `/settings` hub `page.tsx` structure (list of link tiles) is the right UX for the expanded hub — tiles can be grouped with visual dividers, no need for a sidebar nav within settings.
3. Photo uploads (spaces, menu items) use the existing `venue-assets` Supabase Storage bucket with path prefix `{venue_id}/spaces/` and `{venue_id}/menu/` respectively.
4. The `FloorCanvas` and `ShapedTable` components at `src/components/floorplan/` are shared between the admin floor-template configurator and the per-wedding floor plan tool (Slice 4). They are not duplicated.
5. `invite_tokens.accepted_at` is set by a service-role server action, not by RLS-accessible authenticated calls. The acceptance route bypasses RLS.
6. The demo's `preview/admin/layout.tsx` (SettingsShell) maps directly to the real `(app)/settings/layout.tsx` — port the shell/nav structure, not the mock-data wiring.
