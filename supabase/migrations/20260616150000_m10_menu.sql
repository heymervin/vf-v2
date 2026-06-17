-- Migration: m10_menu
-- Date: 2026-06-16
-- Description: M10 Menu Architecture (SD-4 library model).
--
--   * menu_items             — venue-level dish library; course free-text Title-case
--                              (not a DB enum — venues structure courses differently).
--                              price_per_head_minor int (SD-7).
--   * menus                  — one row per named menu template (venue template when
--                              wedding_id IS NULL; per-wedding when wedding_id IS NOT NULL).
--   * menu_item_selections   — library join: which items belong to which menu template.
--                              Each item appears at most once per menu (unique constraint).
--   * wedding_menu_selections — per-wedding item choices / overrides (SD-4 resolved).
--                              Distinct from the template join so editing a template does
--                              not silently change finalised wedding selections.
--   * weddings FK            — ALTER TABLE weddings ADD CONSTRAINT fk_weddings_menu_id
--                              (deferred from M8; menus table now exists).
--
-- RLS template:
--   menu_items:             OWNER-ADMIN-WRITE (venue library config).
--   menus:                  split — template menus (wedding_id IS NULL): owner/admin write;
--                           per-wedding menus (wedding_id IS NOT NULL): member CRUD.
--                           Members SELECT all.
--   menu_item_selections:   MEMBER-CRUD (staff manage which items are on which menu).
--   wedding_menu_selections: MEMBER-CRUD (staff manage per-wedding selections).
--
-- SD notes applied:
--   SD-4: menu_items.course is free-text; no courses table; menus = one row per named
--         template; menu_item_selections = library join; wedding_menu_selections =
--         per-wedding overrides (separate table, not reusing menu_item_selections).
--   SD-7: price_per_head_minor is integer minor units (pence).
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS
--             before recreate, DO $$ guard for deferred FK. Reuses helpers
--             from 20260611100000 (set_updated_at, current_venue_ids,
--             current_owner_or_admin_venue_ids).

-- ============================================================
-- TABLE: menu_items — venue dish library (SD-4, SD-7)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.menu_items (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id             uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name                 text        NOT NULL,
  description          text        NULL,
  course               text        NOT NULL,             -- SD-4: free-text Title-case, e.g. 'Starter'
  meal_period          text        NULL
                         CHECK (meal_period IN ('wedding_breakfast','evening','canapes') OR meal_period IS NULL),
  allergens            text[]      NOT NULL DEFAULT ARRAY[]::text[],
  dietary_tags         text[]      NOT NULL DEFAULT ARRAY[]::text[],
  price_per_head_minor int         NULL,                 -- SD-7: pence; NULL = priced at package level
  photo_path           text        NULL,                 -- Supabase venue-assets bucket path
  is_active            boolean     NOT NULL DEFAULT true,
  sort_order           int         NOT NULL DEFAULT 1000,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- FK backing index
CREATE INDEX IF NOT EXISTS idx_menu_items_venue_id ON public.menu_items (venue_id);
-- Admin list + per-wedding menu view sorted by course within venue
CREATE INDEX IF NOT EXISTS idx_menu_items_venue_course ON public.menu_items (venue_id, course);

DROP TRIGGER IF EXISTS trg_menu_items_updated_at ON public.menu_items;
CREATE TRIGGER trg_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- OWNER-ADMIN-WRITE
DROP POLICY IF EXISTS "menu_items_select_members" ON public.menu_items;
CREATE POLICY "menu_items_select_members" ON public.menu_items
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "menu_items_insert_owners_admins" ON public.menu_items;
CREATE POLICY "menu_items_insert_owners_admins" ON public.menu_items
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "menu_items_update_owners_admins" ON public.menu_items;
CREATE POLICY "menu_items_update_owners_admins" ON public.menu_items
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "menu_items_delete_owners_admins" ON public.menu_items;
CREATE POLICY "menu_items_delete_owners_admins" ON public.menu_items
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- ============================================================
-- TABLE: menus — named menu templates (SD-4)
--
-- wedding_id IS NULL  = venue template menu (starting point, owner/admin-write)
-- wedding_id IS NOT NULL = per-wedding working menu (member CRUD)
-- At most one active menu per wedding (unique partial index below).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.menus (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  wedding_id uuid        NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  notes      text        NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_menus_venue_id   ON public.menus (venue_id);
CREATE INDEX IF NOT EXISTS idx_menus_wedding_id ON public.menus (wedding_id)
  WHERE wedding_id IS NOT NULL;

-- At most one active menu per wedding (template menus have NULL wedding_id, excluded)
CREATE UNIQUE INDEX IF NOT EXISTS uq_menus_active_wedding
  ON public.menus (wedding_id)
  WHERE wedding_id IS NOT NULL AND is_active;

DROP TRIGGER IF EXISTS trg_menus_updated_at ON public.menus;
CREATE TRIGGER trg_menus_updated_at
  BEFORE UPDATE ON public.menus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;

-- SELECT: all members of the venue (covers both template and per-wedding rows)
DROP POLICY IF EXISTS "menus_select_members" ON public.menus;
CREATE POLICY "menus_select_members" ON public.menus
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- INSERT: per-wedding (wedding_id IS NOT NULL) = any member;
--         template (wedding_id IS NULL) = owner/admin only
DROP POLICY IF EXISTS "menus_insert_members" ON public.menus;
CREATE POLICY "menus_insert_members" ON public.menus
  FOR INSERT TO authenticated
  WITH CHECK (
    venue_id IN (SELECT public.current_venue_ids())
    AND (
      wedding_id IS NOT NULL
      OR venue_id IN (SELECT public.current_owner_or_admin_venue_ids())
    )
  );

-- UPDATE: same split as INSERT
DROP POLICY IF EXISTS "menus_update_members" ON public.menus;
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

-- DELETE: owner/admin only (both template and per-wedding)
DROP POLICY IF EXISTS "menus_delete_owners_admins" ON public.menus;
CREATE POLICY "menus_delete_owners_admins" ON public.menus
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- ============================================================
-- TABLE: menu_item_selections — library join (SD-4)
--
-- Defines which menu_items belong to which menu template.
-- Editing one menu_item (e.g. allergen update) propagates to all menus
-- that include it via this join.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.menu_item_selections (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  menu_id      uuid        NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  menu_item_id uuid        NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  course       text        NULL,         -- SD-4: per-menu course assignment (free-text)
  sort_index   numeric     NOT NULL DEFAULT 0,   -- SD-4: ordering within the menu
  created_at   timestamptz NOT NULL DEFAULT now()
  -- No updated_at: selections are replaced (delete + insert), not edited in-place
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_menu_item_selections_venue_id
  ON public.menu_item_selections (venue_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_selections_menu_id
  ON public.menu_item_selections (menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_selections_menu_item_id
  ON public.menu_item_selections (menu_item_id);

-- Each item appears at most once per menu
CREATE UNIQUE INDEX IF NOT EXISTS uq_menu_item_selections_menu_item
  ON public.menu_item_selections (menu_id, menu_item_id);

ALTER TABLE public.menu_item_selections ENABLE ROW LEVEL SECURITY;

-- MEMBER-CRUD (staff manage which items are on which menu)
DROP POLICY IF EXISTS "menu_item_selections_select_members" ON public.menu_item_selections;
CREATE POLICY "menu_item_selections_select_members" ON public.menu_item_selections
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "menu_item_selections_insert_members" ON public.menu_item_selections;
CREATE POLICY "menu_item_selections_insert_members" ON public.menu_item_selections
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "menu_item_selections_update_members" ON public.menu_item_selections;
CREATE POLICY "menu_item_selections_update_members" ON public.menu_item_selections
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "menu_item_selections_delete_members" ON public.menu_item_selections;
CREATE POLICY "menu_item_selections_delete_members" ON public.menu_item_selections
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- ============================================================
-- TABLE: wedding_menu_selections — per-wedding item choices (SD-4)
--
-- Separating per-wedding choices from the library join means finalised
-- wedding selections are not affected when a venue admin edits a template.
-- SD-4: "per-wedding choices/overrides live in wedding_menu_selections;
--        menu_item_selections is NOT reused per-wedding."
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wedding_menu_selections (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  wedding_id   uuid        NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  menu_item_id uuid        NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  course       text        NULL,   -- SD-4: free-text course label (copy from menu_item at selection time)
  sort_index   numeric     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_wedding_menu_selections_venue_id
  ON public.wedding_menu_selections (venue_id);
CREATE INDEX IF NOT EXISTS idx_wedding_menu_selections_wedding_id
  ON public.wedding_menu_selections (wedding_id);
CREATE INDEX IF NOT EXISTS idx_wedding_menu_selections_menu_item_id
  ON public.wedding_menu_selections (menu_item_id);

-- Each item appears at most once per wedding
CREATE UNIQUE INDEX IF NOT EXISTS uq_wedding_menu_selections_wedding_item
  ON public.wedding_menu_selections (wedding_id, menu_item_id);

DROP TRIGGER IF EXISTS trg_wedding_menu_selections_updated_at ON public.wedding_menu_selections;
CREATE TRIGGER trg_wedding_menu_selections_updated_at
  BEFORE UPDATE ON public.wedding_menu_selections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.wedding_menu_selections ENABLE ROW LEVEL SECURITY;

-- MEMBER-CRUD (staff manage per-wedding food selections)
DROP POLICY IF EXISTS "wedding_menu_selections_select_members" ON public.wedding_menu_selections;
CREATE POLICY "wedding_menu_selections_select_members" ON public.wedding_menu_selections
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "wedding_menu_selections_insert_members" ON public.wedding_menu_selections;
CREATE POLICY "wedding_menu_selections_insert_members" ON public.wedding_menu_selections
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "wedding_menu_selections_update_members" ON public.wedding_menu_selections;
CREATE POLICY "wedding_menu_selections_update_members" ON public.wedding_menu_selections
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "wedding_menu_selections_delete_members" ON public.wedding_menu_selections;
CREATE POLICY "wedding_menu_selections_delete_members" ON public.wedding_menu_selections
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- ============================================================
-- DEFERRED FK: weddings.menu_id → menus(id)
--
-- M8 declared weddings.menu_id as plain uuid (no FK) because menus
-- did not yet exist. Now that menus is created above, we add the
-- constraint. DO $$ guard makes this re-runnable.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name         = 'weddings'
      AND constraint_name    = 'fk_weddings_menu_id'
  ) THEN
    ALTER TABLE public.weddings
      ADD CONSTRAINT fk_weddings_menu_id
        FOREIGN KEY (menu_id) REFERENCES public.menus(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- FK backing index (deferred from M8 with the constraint)
CREATE INDEX IF NOT EXISTS idx_weddings_menu_id
  ON public.weddings (menu_id) WHERE menu_id IS NOT NULL;

-- ============================================================
-- Down (rollback)
-- ============================================================
-- ALTER TABLE public.weddings DROP CONSTRAINT IF EXISTS fk_weddings_menu_id;
-- DROP TABLE IF EXISTS public.wedding_menu_selections;
-- DROP TABLE IF EXISTS public.menu_item_selections;
-- DROP TABLE IF EXISTS public.menus;
-- DROP TABLE IF EXISTS public.menu_items;
