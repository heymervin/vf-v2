# Couple Portal — Spec

**Slice:** 8 (build last — per D8)
**Audience:** Kai + Trey (product), Mervin (builder)
**Demo reference:** `src/app/(portal)/portal/portal-client.tsx` + `src/app/(portal)/portal/page.tsx`
**Route group:** `src/app/(portal)/*`

> ⚠️ **Schema reconciliation (2026-06-20) — some names below predate the shipped migrations.** The
> couple menu-pick table is **`wedding_menu_selections`** (m10), not `couple_menu_selections`; there is
> **no `courses` table** — `course` is a free-text column (SD-4), so any `course_id` FK reference does
> not apply. `weddings.portal_theme` is **not** in any migration (portal branding comes from
> `venues.accent_seed` + `logo_path`); verify `weddings.menu_id` / `contract_terms` against the schema
> before relying on them. Where this doc and the m7–m14 migrations / [`SCHEMA-DECISIONS.md`](./SCHEMA-DECISIONS.md)
> disagree, the migrations win.

---

## 1. Overview

The Couple Portal is the couple-facing surface of VenueFlow. It is a white-labeled, per-venue planning hub that a booked couple accesses after their venue is marked "Won" in GHL (or manually created in standalone mode). It replaces the read-only wedding confirmation email with a live, interactive workspace for the couple — but it deliberately does NOT replicate the staff workspace. Staff run the show; the couple has a curated, friendly window into it.

The portal is built in Slice 8. It depends on the `weddings` and `couple_accounts` tables (Slice 2), the venue config libraries (Slice 3), and the per-wedding planning data (Slices 4–6). Invite flow is wired in Slice 2; portal UI lands in Slice 8.

---

## 2. Auth: Magic-Link / Invite Flow

### 2.1 couple_accounts table (introduced in Slice 2)

This table is the identity layer for the portal. It is separate from `auth.users` staff accounts.

```sql
CREATE TABLE public.couple_accounts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  wedding_id      uuid        NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  email           text        NOT NULL,
  display_name    text        NOT NULL,                    -- e.g. "Emma Henderson"
  role            text        NOT NULL DEFAULT 'partner'   -- 'partner' only for now
                    CHECK (role IN ('partner')),
  invited_at      timestamptz NOT NULL DEFAULT now(),
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT couple_accounts_wedding_email_unique UNIQUE (wedding_id, email)
);

CREATE INDEX IF NOT EXISTS idx_couple_accounts_venue_id   ON public.couple_accounts (venue_id);
CREATE INDEX IF NOT EXISTS idx_couple_accounts_wedding_id ON public.couple_accounts (wedding_id);
CREATE INDEX IF NOT EXISTS idx_couple_accounts_email      ON public.couple_accounts (email);
```

Each booking creates up to 2 rows (partner1 + partner2). Both partners share the same `wedding_id` and therefore see the same data.

### 2.2 Invite trigger (Slice 2 wires this; Slice 8 adds the portal UI)

1. Inngest `ghl/opportunity-won` (or manual-create fallback) creates the `weddings` row and inserts 1–2 `couple_accounts` rows.
2. For each `couple_accounts` row, the function calls `supabase.auth.admin.inviteUserByEmail({ email, options: { data: { couple_account_id, wedding_id, venue_id } } })`. This uses the Supabase magic-link invite flow.
3. Supabase sends the invite email via Resend (configured in `venue_email_settings`). Email links to `/portal/accept?token=...`.
4. On accept, the `auth.users` row is created and linked to `couple_accounts` via `auth.users.id`. Add `auth_user_id uuid REFERENCES auth.users(id)` column to `couple_accounts`.

**Standalone fallback (D6):** Staff can trigger "Send Portal Invite" from the Wedding Workspace manually. This calls the same Inngest function path; no GHL dependency.

### 2.3 Session + auth route handling

- Auth entry: `src/app/(portal)/auth/magic-link/route.ts` — handles `?token=` from the invite email; exchanges token for session; redirects to `/portal`.
- The `(portal)` layout server component reads `supabase.auth.getSession()` and fetches `couple_accounts` WHERE `auth_user_id = session.user.id`. If no match → redirect to `/portal/login` (re-send magic link).
- Couples do NOT use password auth. They log in via magic link every session (Supabase OTP). The UX is: enter email → receive link → land in portal.
- Session cookies are standard Supabase SSR cookies (`@supabase/ssr`), scoped to the `(portal)` layout.

**Open question OQ-1:** Should a couple's Supabase `auth.users` row be in the same tenant (same project) as staff? If yes, RLS must cleanly separate couple rows from staff rows. If no, a separate Supabase project would isolate them but add operational complexity. Assumption: same project, RLS-isolated (see Section 3).

---

## 3. RLS: Couple-Only Pattern

### 3.1 Helper function

```sql
-- Returns the wedding_id(s) the currently authenticated couple can access.
-- Returns no rows if the caller is a staff user (no couple_accounts row).
-- SETOF form matches the existing current_venue_ids() convention and is the
-- single canonical definition (also in specs/data-model.md M8). Use with IN (SELECT ...).
CREATE OR REPLACE FUNCTION public.current_couple_wedding_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT wedding_id
  FROM public.couple_accounts
  WHERE auth_user_id = auth.uid()
    AND status = 'active';
$$;
```

### 3.2 RLS template for couple-visible tables

For every table that couples can read, add a `couple_select` policy alongside the existing `member_select` policy:

```sql
CREATE POLICY "weddings_select_couple" ON public.weddings
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.current_couple_wedding_ids()));

CREATE POLICY "wedding_guests_select_couple" ON public.wedding_guests
  FOR SELECT TO authenticated
  USING (wedding_id IN (SELECT public.current_couple_wedding_ids()));
```

For tables where couples can INSERT/UPDATE (guests, menu choices), add narrow write policies scoped to their own `wedding_id`. Example:

```sql
CREATE POLICY "wedding_guests_insert_couple" ON public.wedding_guests
  FOR INSERT TO authenticated
  WITH CHECK (wedding_id IN (SELECT public.current_couple_wedding_ids()));

CREATE POLICY "wedding_guests_update_couple" ON public.wedding_guests
  FOR UPDATE TO authenticated
  USING (wedding_id IN (SELECT public.current_couple_wedding_ids()))
  WITH CHECK (wedding_id IN (SELECT public.current_couple_wedding_ids()));
```

### 3.3 What couples can NEVER see

The RLS layer enforces these at the database level — not just in the UI:

| Table / data | Why blocked |
|---|---|
| `contacts` (other weddings) | RLS: `current_couple_wedding_ids()` scopes to the couple's own wedding(s) only |
| `weddings` (other couples) | Same |
| `memberships`, `team`, staff notes | No `couple_select` policy on these tables |
| `venues` row | Couple gets only the columns exposed via a safe view (name, logo, email) — never `ghl_credentials` or billing fields |
| `ghl_credentials` | No couple policy; service-role only |
| `billing_subscriptions`, `stripe_events` | No couple policy |
| Internal staff notes (`wedding_notes`) | Separate table from couple-visible notes; no couple policy |
| Other couples' guest lists, menus, floor plans | All scoped by `wedding_id IN (SELECT current_couple_wedding_ids())` |

**Rule:** When in doubt, add no couple policy. Withhold until there is an explicit product reason to expose.

---

## 4. Data Shape: What Couples See

### 4.1 Read-only (staff-owned, couple surfaces)

These are written by staff in the Wedding Workspace; the couple sees a curated view.

| Data | Source table(s) | Couple can see | Couple notes |
|---|---|---|---|
| Wedding date, space, package | `weddings` | Yes | Read-only |
| Coordinator name + email | `memberships` JOIN `venues` | Display name + email only | No role/internal info |
| Run sheet / timeline | `timeline_events` | Yes (all published rows) | Read-only |
| Floor plan (seating) | `floor_plans`, `floor_plan_tables` | Read-only canvas | Cannot drag tables |
| Docs / contract | `wedding_documents` | Their own docs | View + download only |
| Payment schedule | Fetched from GHL invoices (Phase 3) or `payment_milestones` (standalone) | Yes | Cannot edit amounts/dates |
| Suppliers | `wedding_suppliers` JOIN `suppliers` | Name, role, contact only | No internal rate/notes |
| Venue-published tasks (couple checklist) | `wedding_tasks` WHERE `visible_to_couple = true` | Yes | Cannot create tasks |

### 4.2 Interactive (couple can write)

| Action | Table written | Fields couple can set |
|---|---|---|
| Add a guest | `wedding_guests` INSERT | name, rsvp, dietary[], plus_one_name, session_type |
| Update a guest | `wedding_guests` UPDATE | rsvp, dietary[], plus_one_name |
| Choose a menu option (per course) | `couple_menu_selections` INSERT / UPSERT | menu_item_id (one per course per wedding) |
| Send a message to coordinator | Via GHL API POST (messaging mirror) or `couple_messages` table | body, channel |

### 4.3 Two-way sync points

```
Couple adds guest  →  wedding_guests row created  →  staff Wedding Workspace
                                                        "Guests" tab shows it live

Staff publishes menu options  →  menus + menu_items (Slice 3)
                             →  couple portal "Menu" tab shows available options
                             →  couple picks  →  couple_menu_selections upserted

Staff assigns guest to table  →  floor_plan_seat row updated
                              →  couple "Seating" tab re-reads (read-only canvas)

Staff marks task visible_to_couple = true  →  couple "Home" tab todo list updates
```

No polling. Use Supabase Realtime subscriptions on `wedding_guests`, `timeline_events`, and `floor_plan_seats` for live updates where the couple's view needs to refresh when staff make changes.

---

## 5. New Tables Introduced by This Spec

All tables follow the RLS pattern in Section 3: a `couple_select` policy scoped to `current_couple_wedding_ids()` PLUS the existing staff `member_select`.

### 5.1 couple_menu_selections

Stores the couple's per-course menu pick for their wedding.

```sql
CREATE TABLE public.couple_menu_selections (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  wedding_id   uuid        NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  menu_id      uuid        NOT NULL REFERENCES public.menus(id),
  course_id    uuid        NOT NULL,                              -- FK to a courses table (TBD in Slice 3)
  menu_item_id uuid        NOT NULL REFERENCES public.menu_items(id),
  selected_by  uuid        REFERENCES public.couple_accounts(id),-- which partner made the pick
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT couple_menu_sel_wedding_course_unique UNIQUE (wedding_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_couple_menu_sel_wedding_id ON public.couple_menu_selections (wedding_id);
```

RLS:
- `couple_select`: `wedding_id IN (SELECT current_couple_wedding_ids())`
- `couple_insert` / `couple_update`: same check on `wedding_id`
- `member_select`: `venue_id IN (current_venue_ids())`

**Open question OQ-2:** The demo has per-guest meal choices (`guest.mealChoice`). Should `couple_menu_selections` be per-guest (one row per guest per course) or per-wedding (one canonical couple choice that applies to all day guests)? The safer first version is per-wedding — one choice per course that the venue uses as the default. Per-guest meal choices can be added in a later slice.

### 5.2 wedding_documents

Stores documents shared with the couple (contracts, invoices, insurance certificates, supplier confirmations).

```sql
CREATE TABLE public.wedding_documents (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  wedding_id   uuid        NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  kind         text        NOT NULL CHECK (kind IN ('contract','insurance','invoice','supplier','other')),
  status       text        NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','sent','signed','received','missing')),
  storage_path text,                                             -- Supabase Storage path (venue-assets bucket or a new portal-docs bucket)
  uploaded_by  uuid        REFERENCES public.memberships(id),
  signed_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wedding_documents_wedding_id ON public.wedding_documents (wedding_id);
```

RLS:
- `couple_select`: `wedding_id IN (SELECT current_couple_wedding_ids())`
- No couple INSERT/UPDATE/DELETE — documents are staff-managed only.
- `member_select` / `owner_admin_write`: standard staff template.

**Open question OQ-3:** For contract e-signature, does the venue want a native VF2 e-sign flow or just a link to DocuSign/PandaDoc? The demo has a "Review & sign" button. Assumption: MVP is a link to an external doc URL stored in `storage_path` or a `doc_url text` column. Native e-sign is a future feature.

### 5.3 payment_milestones (standalone mode)

In GHL-bundled mode, payment data comes from the GHL invoices API (Phase 3 integration). In standalone mode, `payment_milestones` holds the schedule natively.

```sql
CREATE TABLE public.payment_milestones (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  wedding_id   uuid        NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  label        text        NOT NULL,                             -- e.g. "Deposit", "Balance"
  amount       numeric(10,2) NOT NULL CHECK (amount >= 0),
  due_date     date        NOT NULL,
  status       text        NOT NULL DEFAULT 'upcoming'
                 CHECK (status IN ('upcoming','due','overdue','paid')),
  paid_on      date,
  receipt_url  text,
  ghl_invoice_id text,                                          -- set if mirrored from GHL
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_milestones_wedding_id ON public.payment_milestones (wedding_id);
```

RLS:
- `couple_select`: `wedding_id IN (SELECT current_couple_wedding_ids())`
- No couple write — staff/GHL webhook updates status.

### 5.4 wedding_tasks (couple-visible subset)

Staff create tasks in the Wedding Workspace (Slice 2/4). A `visible_to_couple boolean` column gates which appear in the portal checklist.

This column is added to the `wedding_tasks` table (defined in Slice 2). It is not a new table but a new column:

```sql
ALTER TABLE public.wedding_tasks
  ADD COLUMN IF NOT EXISTS visible_to_couple boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'planning'
    CHECK (category IN ('money','planning','suppliers','admin'));
```

RLS for couple:
- `couple_select` on `wedding_tasks`: `wedding_id IN (SELECT current_couple_wedding_ids()) AND visible_to_couple = true`

---

## 6. Screen-by-Screen

Demo source for all screens: `src/app/(portal)/portal/portal-client.tsx`

### 6.1 Layout (portal shell)

**File:** `src/app/(portal)/layout.tsx` — currently uses `VENUE.name` from mock.

Real version:
- Server component. Reads `couple_accounts` for the current session. Fetches `weddings` JOIN `venues` for `venueName`, `venue.logo_path`, `venue.slug`.
- Header: venue logo (from `venues.logo_path`), venue name, "Wedding Portal" label. No "Prototype" badge.
- Footer: "Powered by VenueFlow" (can be white-labeled later with `venues.hide_powered_by boolean`).
- Portal theme (accent colour, welcome note): from `weddings.portal_theme jsonb` column (already modelled in the demo via `portalTheme` prop: `{ accent: string, logoText: string, welcomeNote?: string }`).

### 6.2 Home tab

**Demo:** Hero + `WhatNextCallout` + `QuickStat` grid + `TaskRow` list + `QuickLink` grid

Real version:
- Countdown hero: computed from `weddings.date` (real column). `daysUntil = differenceInCalendarDays(wedding.date, today)`.
- Planning progress: `doneTasks / totalTasks` from `wedding_tasks WHERE visible_to_couple = true` for this `wedding_id`.
- What's Next callout: highest-priority alert — overdue payment first, then due payment, then next uncompleted task.
- Quick stats: confirmed guests (`wedding_guests WHERE rsvp = 'yes'`), pending RSVPs (`rsvp = 'pending'`), amount paid (sum of `payment_milestones WHERE status = 'paid'`), balance remaining.
- Tasks list: `wedding_tasks WHERE visible_to_couple = true ORDER BY due_date NULLS LAST`. Show first 5; link to expand.
- Quick links: navigate to Menu / Guests / Seating / Messages tabs.

### 6.3 Menu tab

**Demo:** `MenuCourseBlock` per course with radio-style option picker.

Real version:
- Source: `menus` table (published for this wedding via `weddings.menu_id` or a wedding-specific override), `menu_items` table, structured by course.
- Gate (D5): if venue has no menu items published (`menus` table empty for this venue), show "Your coordinator will share menu options soon."
- Couple selects one `menu_item_id` per course → UPSERT into `couple_menu_selections` (wedding_id, course_id, menu_item_id). Server action called from a `useTransition` / `useOptimistic` hook.
- Allergen warnings: rendered from `menu_items.allergens text[]`.
- "Request a menu change" button: sends a message via the messaging channel (GHL conversation POST or `couple_messages` fallback).

**Staff view:** Wedding Workspace "Menu" tab shows `couple_menu_selections` rows alongside each guest's dietary info. Staff see which options were chosen and can override.

### 6.4 Guests tab

**Demo:** `GuestRow` list + `AddGuestSheet` + `EditGuestSheet`

Real version:
- Source: `wedding_guests` WHERE `wedding_id IN (SELECT current_couple_wedding_ids())`.
- **Couple can INSERT** new guests (name, rsvp, dietary[], plus_one_name, session_type). Server action → INSERT into `wedding_guests`.
- **Couple can UPDATE** their own guests (rsvp, dietary[], plus_one_name). Server action → UPDATE.
- Couple CANNOT: assign table numbers (staff-only), set `side` field (staff-set), delete guests (soft-delete is staff-only).
- RSVP progress bar: computed client-side from the guest list.
- Realtime: subscribe to `wedding_guests` Supabase Realtime channel filtered by `wedding_id` — if staff add a guest (e.g. from GHL contact data), the couple's list updates live without refresh.

**Staff view:** The same `wedding_guests` rows appear in the staff Wedding Workspace "Guests" tab. Staff see the `side`, `table` assignment, and internal tags that couples cannot set or see.

### 6.5 Seating tab (read-only)

**Demo:** `FloorCanvas` + `ShapedTable` components from `src/components/floorplan/`.

Real version:
- Source: `floor_plans` (for the wedding's space), `floor_plan_tables` (table shapes + positions), `floor_plan_seats` (which guest sits where — JOIN `wedding_guests`).
- Gate (D5): if no floor plan exists for this wedding's space yet, show "Your seating plan hasn't been arranged yet — check back closer to the day."
- Couple sees: table positions, table labels, who is seated at their own tables (guests with `wedding_id` = theirs). Read-only — no drag, no edit.
- "Request a seating change" button: fires a message to coordinator (same messaging channel as Menu tab).
- Couple does NOT see internal layout notes or staff-only table annotations.

### 6.6 Messages tab

**Demo:** `MessageBubble` thread + composer `Textarea` + `Send` button.

> **GHL endpoint shapes are normative in [`specs/ghl-integration.md`](./ghl-integration.md) §11**, not here. The `/v2/...` paths and the dotted `conversation.message.received` event below are ground-truth shorthand; the real base has no `/v2`, send is `POST /conversations/messages` with `contactId` in the body, and the event is `InboundMessage`. Follow §11 when implementing.

Real version (depends on Slice 6 messaging mirror):
- In GHL-bundled mode: thread is fetched from `GET /v2/conversations?contactId={ghl_contact_id}` server-side (couple's GHL conversation). Rendered in the portal the same way as in the staff inbox.
- Couple compose + send: POST to `/api/portal/messages` → server action → GHL `POST /v2/conversations/{id}/messages`. Message appears in both the portal and in GHL.
- Realtime: `conversation.message.received` GHL webhook → VF2 handler → Supabase Realtime broadcast → couple's browser shows new message without polling.
- In standalone mode (D6 fallback): `couple_messages` table (see below) used as the thread store instead of GHL.
- Composer sends via ⌘↵ shortcut (matches demo).
- Channel shown: the GHL conversation channel (WhatsApp / SMS / email). The couple always sends via the same channel already active.

**Standalone couple_messages table (D6 fallback):**

```sql
CREATE TABLE public.couple_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  wedding_id   uuid        NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  direction    text        NOT NULL CHECK (direction IN ('couple_to_staff','staff_to_couple')),
  body         text        NOT NULL,
  author_name  text        NOT NULL,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_couple_messages_wedding_id ON public.couple_messages (wedding_id);
```

RLS: couple can SELECT all rows and INSERT `direction = 'couple_to_staff'` rows for their wedding. Staff SELECT all via venue membership.

**Open question OQ-4:** For GHL-bundled mode, does the couple's outbound message route through GHL as WhatsApp, SMS, or email? The channel is determined by the active GHL conversation. If no active conversation exists (e.g. couple never messaged pre-booking), VF2 must create a new conversation via `POST /v2/conversations` before sending. This flow needs explicit design.

### 6.7 Payments tab

**Demo:** Summary progress bar + `PaymentRow` per milestone + "Pay balance" CTA.

Real version:
- In GHL-bundled mode (Phase 3): fetch invoices from `GET /v2/invoices?contactId={ghl_contact_id}`. Map GHL invoice statuses to the four display statuses: Awaiting Deposit → `upcoming`, Deposit Paid → `paid`, Balance Due → `due`, Paid in Full → `paid`. Cache results for 5 minutes server-side (Next.js `cache` + `revalidate`).
- In standalone mode: read from `payment_milestones` table.
- Payment CTA ("Pay balance" button): in GHL mode, link to the GHL invoice payment URL (fetched from the invoice object). No in-app Stripe. In standalone mode: open `payment_milestones.receipt_url` or a venue-configured bank transfer instructions page.
- Receipt download: for paid milestones, the `receipt_url` column (or GHL invoice PDF endpoint).
- Couples cannot edit amounts, due dates, or create new milestones — read-only.

### 6.8 Contract / Documents tab

**Demo:** Contract signed/unsigned card + `DocRow` list.

Real version:
- Contract status: read from `wedding_documents WHERE kind = 'contract' AND wedding_id = {id}`.
- If unsigned: show "Awaiting your signature" + key terms (from `weddings.contract_terms text[]` or a linked template). "Review & sign" button: opens the `doc_url` / `storage_path` (external e-sign link or Supabase Storage signed URL).
- If signed: green confirmation card. "Download a copy" link.
- Other docs list: `wedding_documents WHERE kind != 'contract'` — insurance certificates, supplier confirmations, etc. Status badge per doc.
- Couples can VIEW and DOWNLOAD (signed URLs from Supabase Storage). Cannot upload or delete.

**Open question OQ-3 (repeated):** Native e-sign vs. external link. MVP uses external link stored in `wedding_documents.storage_path` or a `doc_url text` column.

---

## 7. Invite Trigger and Slice Sequencing

The invite flow is split across two slices to keep each slice testable:

| Slice | What lands |
|---|---|
| 2 | `couple_accounts` table, `weddings` table, GHL opp-won → create wedding + `couple_accounts` rows, Supabase auth invite emails sent. No portal UI yet — couples get an email but land on a "coming soon" holding page. |
| 8 | Full portal UI at `/portal`. Magic-link auth flow. All tabs wired to real Supabase data. |

Between Slice 2 and Slice 8, the `/portal` route can show a placeholder: "Your planning portal is being set up. You'll receive another email when it's ready."

---

## 8. Gating (D5) — Portal Feature Gates

The portal applies the same gating principle as the staff app: a feature stays locked until its prerequisite data exists.

| Tab | Gate condition | Locked state copy |
|---|---|---|
| Menu | `menus` table has published items for this venue | "Your menu options will appear here once your coordinator sets up the menu." |
| Seating | `floor_plans` row exists for this wedding's space | "Seating hasn't been arranged yet — check back closer to the day." |
| Payments | At least one `payment_milestones` row or GHL invoice exists | "Your payment schedule will appear here once your booking is confirmed." |
| Contract | `wedding_documents WHERE kind = 'contract'` exists | "Your contract will appear here once your coordinator uploads it." |
| Messages | Always unlocked — couple can always initiate | N/A |

---

## 9. Security Checklist

Enforce in code, not only in policy comments.

- [ ] `current_couple_wedding_ids()` function exists and is used by all couple RLS policies.
- [ ] No couple RLS policy allows `venue_id IN (SELECT current_venue_ids())` — that's the staff pattern. Couple policies always use `wedding_id IN (SELECT current_couple_wedding_ids())`.
- [ ] `ghl_credentials` table has no couple policy. No GHL tokens or location IDs ever reach the portal client.
- [ ] `couple_accounts.auth_user_id` is indexed and uniquely set. A couple session cannot accidentally resolve to a different wedding.
- [ ] Server actions that write `wedding_guests` or `couple_menu_selections` re-validate `current_couple_wedding_ids()` server-side even though RLS already enforces it — defense in depth.
- [ ] Internal staff notes (`wedding_notes`) table has no couple policy.
- [ ] The portal layout (`src/app/(portal)/layout.tsx`) immediately redirects unauthenticated users to `/portal/login` — no data fetching before auth check.
- [ ] Supabase Storage: couple access to `wedding_documents` files uses `createSignedUrl` with a short expiry (1 hour), generated server-side. No public bucket access.
- [ ] Portal is served at a distinct sub-path or sub-domain. Staff and couple sessions do not share the same cookie scope.

---

## 10. Open Questions

| ID | Question | Impact |
|---|---|---|
| OQ-1 | Same Supabase project for staff and couple, or separate project? | RLS complexity vs. operational simplicity |
| OQ-2 | Per-wedding menu choice (one per course) or per-guest meal choice (one per guest per course)? | Schema of `couple_menu_selections`; matches what the kitchen actually needs |
| OQ-3 | Native e-sign flow or external link (DocuSign / PandaDoc)? | Determines if `wedding_documents.storage_path` is a Supabase Storage path or an external URL |
| OQ-4 | What GHL channel does the couple use when messaging from the portal? If no prior conversation exists, how does VF2 create one? | Messaging tab implementation; affects `POST /v2/conversations` logic |
| OQ-5 | White-labeling depth: does the portal use the venue's custom domain, or always live at `app.venueflow.co/portal`? | DNS / routing; does not block Slice 8 but must be decided before launch |
| OQ-6 | Should both partners (partner1 + partner2) have equal write access to guests and menu, or is one the "primary" who can edit? | `couple_accounts` role design; currently both are `partner` with equal access |
| OQ-7 | Couple real-time: Supabase Realtime channels require the couple's session to subscribe. What happens if the couple has two browser tabs open (partner1 on mobile, partner2 on laptop)? | Realtime channel naming + session isolation |

---

## 11. Assumptions Made

- `weddings` and `couple_accounts` tables are defined in Slice 2 (data-model spec). This spec adds columns (`portal_theme`, `contract_terms`) and assumes those land in Slice 2 alongside the core schema.
- `wedding_tasks` table is defined in Slice 2. This spec adds `visible_to_couple` and `category` columns.
- `menu_items` / `menus` / `menu_item_selections` are defined in `specs/data-model.md` (M10) and `specs/venue-settings.md` (Slice 3). This spec's Menu tab depends on that schema. **Note:** the course model is unsettled — `couple_menu_selections.course_id` below references a `courses` table that no other spec defines (course is currently a text field on `menu_items`); see SPECS-INDEX "decisions needing sign-off".
- `floor_plans` (and the placed-table / seat storage) are defined in `specs/data-model.md` (M11) and `specs/staff-workspace.md` §7. The placed-table table name is unsettled across specs (`floor_plan_tables` vs a `canvas_json` blob vs `floor_plan_seats`); see SPECS-INDEX. Seating tab depends on whichever is chosen.
- `payment_milestones` is the standalone fallback; GHL invoice sync (Phase 3) is the bundled-mode source. Both use the same portal Payments tab UI with an adapter layer.
- The portal is white-labeled to the venue (venue name + logo in header). Custom branding theme (accent colour, welcome note) comes from `weddings.portal_theme jsonb`. No venue-specific CSS overrides in Slice 8 MVP.
- Magic-link is the only auth method for couples in MVP. Password auth and social login are out of scope.
- The `(portal)` route group is already established at `src/app/(portal)/` with layout + placeholder portal page.
