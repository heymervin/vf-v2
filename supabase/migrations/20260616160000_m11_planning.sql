-- Migration: m11_planning
-- Date: 2026-06-16
-- Description: M11 Per-wedding planning tools.
--
--   * wedding_guests       — guest list per wedding; member CRUD for staff;
--                            couple-scoped SELECT + INSERT/UPDATE (Slice 8).
--   * timeline_events      — run-sheet items per wedding; member CRUD for staff.
--                            timeline_events.supplier_id is a plain uuid here;
--                            the FK → wedding_suppliers(id) is added via ALTER
--                            in M12 (wedding_suppliers does not exist yet).
--   * floor_plans          — per-wedding canvas state (SD-5: jsonb layout blob);
--                            member CRUD for staff. Column is `layout` per SD-5.
--   * wedding_menu_selections — per-wedding item choices (SD-4 resolved model);
--                            member CRUD for staff + couple-scoped SELECT/INSERT/
--                            UPDATE. `menu_items` exists from M10; `menus` also
--                            from M10; `menu_item_id` is a FK to menu_items.
--
-- RLS helpers used:
--   public.current_venue_ids()                  — any member of the venue
--   public.current_owner_or_admin_venue_ids()   — owner or admin only
--   public.current_couple_wedding_ids()         — defined in M8; returns wedding_ids
--                                                 for the active couple session
--
-- Cross-migration FK note:
--   timeline_events.supplier_id → wedding_suppliers(id) is deferred to M12.
--   floor_plans.template_id → floor_templates(id) is a nullable FK added here
--   (floor_templates is defined in M9, earlier).
--   wedding_menu_selections.menu_item_id → menu_items(id) refs M10 (earlier).
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS
--             before recreate, CREATE OR REPLACE FUNCTION.

-- ============================================================
-- TABLE: wedding_guests
-- Guest list for a specific wedding. Staff manage via MEMBER-CRUD.
-- Couple portal can read + manage their own wedding's guest list (Slice 8).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wedding_guests (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id         uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  wedding_id       uuid        NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  email            citext      NULL,
  phone            text        NULL,
  side             text        NULL
                     CHECK (side IN ('partner1', 'partner2', 'both')),
  rsvp             text        NOT NULL DEFAULT 'pending'
                     CHECK (rsvp IN ('yes', 'no', 'pending')),
  rsvp_chased_at   timestamptz NULL,
  session_type     text        NULL
                     CHECK (session_type IN ('day', 'evening', 'ceremony_only')),
  -- SD-5 refinement: structured seating (table_number + seat_index) supersedes the
  -- spec's simple `table_assignment text`; floor_plans.layout still holds the canvas.
  table_number     int         NULL,
  seat_index       int         NULL,
  dietary          text[]      NOT NULL DEFAULT ARRAY[]::text[],
  allergen_notes   text        NULL,
  plus_one         boolean     NOT NULL DEFAULT false,
  plus_one_name    text        NULL,
  household_id     text        NULL,
  household_name   text        NULL,
  tags             text[]      NOT NULL DEFAULT ARRAY[]::text[],
  -- meal_choice is a soft jsonb reference to menu_item_selections.menu_item_id
  -- values by uuid. No FK enforced (intentional — see data-model OQ-5).
  meal_choice      jsonb       NULL,
  notes            text        NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_wedding_guests_venue_id   ON public.wedding_guests (venue_id);
CREATE INDEX IF NOT EXISTS idx_wedding_guests_wedding_id ON public.wedding_guests (wedding_id);
-- RSVP reporting: count by status for a wedding
CREATE INDEX IF NOT EXISTS idx_wedding_guests_rsvp
  ON public.wedding_guests (wedding_id, rsvp);
-- Seating query: guests assigned to a specific table
CREATE INDEX IF NOT EXISTS idx_wedding_guests_table
  ON public.wedding_guests (wedding_id, table_number)
  WHERE table_number IS NOT NULL;

DROP TRIGGER IF EXISTS trg_wedding_guests_updated_at ON public.wedding_guests;
CREATE TRIGGER trg_wedding_guests_updated_at
  BEFORE UPDATE ON public.wedding_guests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.wedding_guests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: wedding_guests
-- Staff: MEMBER-CRUD (SELECT/INSERT/UPDATE/DELETE via current_venue_ids)
-- Couple: SELECT + INSERT + UPDATE for own wedding (Slice 8 — defined now
--         so the helper is wired; couple portal activates when couple accounts
--         go live)
-- ============================================================

DROP POLICY IF EXISTS "wedding_guests_select_members" ON public.wedding_guests;
CREATE POLICY "wedding_guests_select_members" ON public.wedding_guests
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "wedding_guests_insert_members" ON public.wedding_guests;
CREATE POLICY "wedding_guests_insert_members" ON public.wedding_guests
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "wedding_guests_update_members" ON public.wedding_guests;
CREATE POLICY "wedding_guests_update_members" ON public.wedding_guests
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "wedding_guests_delete_members" ON public.wedding_guests;
CREATE POLICY "wedding_guests_delete_members" ON public.wedding_guests
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- Couple portal: read + add/update guests for their own wedding only.
-- Couple DELETE is blocked (staff removes guests from the guest list).
DROP POLICY IF EXISTS "wedding_guests_select_couples" ON public.wedding_guests;
CREATE POLICY "wedding_guests_select_couples" ON public.wedding_guests
  FOR SELECT TO authenticated
  USING (wedding_id IN (SELECT public.current_couple_wedding_ids()));

DROP POLICY IF EXISTS "wedding_guests_insert_couples" ON public.wedding_guests;
CREATE POLICY "wedding_guests_insert_couples" ON public.wedding_guests
  FOR INSERT TO authenticated
  WITH CHECK (wedding_id IN (SELECT public.current_couple_wedding_ids()));

DROP POLICY IF EXISTS "wedding_guests_update_couples" ON public.wedding_guests;
CREATE POLICY "wedding_guests_update_couples" ON public.wedding_guests
  FOR UPDATE TO authenticated
  USING (wedding_id IN (SELECT public.current_couple_wedding_ids()))
  WITH CHECK (wedding_id IN (SELECT public.current_couple_wedding_ids()));

-- ============================================================
-- TABLE: timeline_events
-- Run-sheet items for a wedding. One row = one scheduled event.
-- supplier_id is a plain uuid here; FK to wedding_suppliers(id) is added
-- in M12 via ALTER TABLE once wedding_suppliers exists.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.timeline_events (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id         uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  wedding_id       uuid        NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  starts_at_time   time        NOT NULL,
  duration_min     int         NOT NULL DEFAULT 30 CHECK (duration_min > 0),
  title            text        NOT NULL,
  owner            text        NULL,
  category         text        NOT NULL
                     CHECK (category IN ('ceremony', 'reception', 'catering', 'supplier', 'logistics')),
  -- supplier_id: soft reference to wedding_suppliers(id); FK added in M12.
  supplier_id      uuid        NULL,
  done             boolean     NOT NULL DEFAULT false,
  notes            text        NULL,
  sort_order       int         NOT NULL DEFAULT 1000,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_timeline_events_venue_id   ON public.timeline_events (venue_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_wedding_id ON public.timeline_events (wedding_id);
-- Primary read path: run sheet ordered by time within a wedding
CREATE INDEX IF NOT EXISTS idx_timeline_events_wedding_time
  ON public.timeline_events (wedding_id, starts_at_time, sort_order);

DROP TRIGGER IF EXISTS trg_timeline_events_updated_at ON public.timeline_events;
CREATE TRIGGER trg_timeline_events_updated_at
  BEFORE UPDATE ON public.timeline_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: timeline_events — MEMBER-CRUD for staff
-- Couple portal: SELECT only (Slice 8) — couples view but do not edit run sheets
-- ============================================================

DROP POLICY IF EXISTS "timeline_events_select_members" ON public.timeline_events;
CREATE POLICY "timeline_events_select_members" ON public.timeline_events
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "timeline_events_insert_members" ON public.timeline_events;
CREATE POLICY "timeline_events_insert_members" ON public.timeline_events
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "timeline_events_update_members" ON public.timeline_events;
CREATE POLICY "timeline_events_update_members" ON public.timeline_events
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "timeline_events_delete_members" ON public.timeline_events;
CREATE POLICY "timeline_events_delete_members" ON public.timeline_events
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- Couple portal: view the run sheet for their own wedding (read-only)
DROP POLICY IF EXISTS "timeline_events_select_couples" ON public.timeline_events;
CREATE POLICY "timeline_events_select_couples" ON public.timeline_events
  FOR SELECT TO authenticated
  USING (wedding_id IN (SELECT public.current_couple_wedding_ids()));

-- ============================================================
-- TABLE: floor_plans
-- Per-wedding floor plan canvas. Seeded from a floor_template; then freely
-- edited. SD-5: layout stored as jsonb blob. Column name is `layout`
-- (SD-5 wins over data-model.md's `canvas_json`).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.floor_plans (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  wedding_id   uuid        NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  space_id     uuid        NULL REFERENCES public.spaces(id) ON DELETE SET NULL,
  -- template_id: informational link to the floor_template used as starting point.
  -- floor_templates is defined in M9 (earlier); nullable so ad-hoc plans are
  -- allowed without a template.
  template_id  uuid        NULL REFERENCES public.floor_templates(id) ON DELETE SET NULL,
  -- layout jsonb: {tables: FloorplanTable[], roomElements: RoomElement[]}
  -- Coordinates are percentage-based (0-100). See src/lib/mock/planning.ts.
  layout       jsonb       NOT NULL DEFAULT '{}',
  name         text        NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_floor_plans_venue_id   ON public.floor_plans (venue_id);
CREATE INDEX IF NOT EXISTS idx_floor_plans_wedding_id ON public.floor_plans (wedding_id);
CREATE INDEX IF NOT EXISTS idx_floor_plans_space_id
  ON public.floor_plans (space_id) WHERE space_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_floor_plans_template_id
  ON public.floor_plans (template_id) WHERE template_id IS NOT NULL;
-- At most one active floor plan per space per wedding
CREATE UNIQUE INDEX IF NOT EXISTS uq_floor_plans_wedding_space
  ON public.floor_plans (wedding_id, space_id)
  WHERE space_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_floor_plans_updated_at ON public.floor_plans;
CREATE TRIGGER trg_floor_plans_updated_at
  BEFORE UPDATE ON public.floor_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: floor_plans — MEMBER-CRUD for staff only
-- Floor plans are staff-managed; couples do not interact with the canvas.
-- ============================================================

DROP POLICY IF EXISTS "floor_plans_select_members" ON public.floor_plans;
CREATE POLICY "floor_plans_select_members" ON public.floor_plans
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "floor_plans_insert_members" ON public.floor_plans;
CREATE POLICY "floor_plans_insert_members" ON public.floor_plans
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "floor_plans_update_members" ON public.floor_plans;
CREATE POLICY "floor_plans_update_members" ON public.floor_plans
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "floor_plans_delete_members" ON public.floor_plans;
CREATE POLICY "floor_plans_delete_members" ON public.floor_plans
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- ============================================================
-- RLS POLICIES (couple-scoped): wedding_menu_selections
--
-- The wedding_menu_selections TABLE + staff MEMBER-CRUD policies are owned by
-- M10 (20260616150000_m10_menu.sql). M11 only adds couple portal access here so
-- couples can review/propose selections for their own wedding (staff confirm).
-- ============================================================

-- Couple portal: read and update menu selections for their own wedding
DROP POLICY IF EXISTS "wedding_menu_selections_select_couples" ON public.wedding_menu_selections;
CREATE POLICY "wedding_menu_selections_select_couples" ON public.wedding_menu_selections
  FOR SELECT TO authenticated
  USING (wedding_id IN (SELECT public.current_couple_wedding_ids()));

DROP POLICY IF EXISTS "wedding_menu_selections_insert_couples" ON public.wedding_menu_selections;
CREATE POLICY "wedding_menu_selections_insert_couples" ON public.wedding_menu_selections
  FOR INSERT TO authenticated
  WITH CHECK (wedding_id IN (SELECT public.current_couple_wedding_ids()));

DROP POLICY IF EXISTS "wedding_menu_selections_update_couples" ON public.wedding_menu_selections;
CREATE POLICY "wedding_menu_selections_update_couples" ON public.wedding_menu_selections
  FOR UPDATE TO authenticated
  USING (wedding_id IN (SELECT public.current_couple_wedding_ids()))
  WITH CHECK (wedding_id IN (SELECT public.current_couple_wedding_ids()));

-- ============================================================
-- Down (rollback — not run automatically, for reference)
-- ============================================================
-- DROP TABLE IF EXISTS public.wedding_menu_selections;
-- DROP TABLE IF EXISTS public.floor_plans;
-- DROP TABLE IF EXISTS public.timeline_events;
-- DROP TABLE IF EXISTS public.wedding_guests;
