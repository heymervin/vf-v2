-- Migration: m9_venue_config
-- Date: 2026-06-16
-- Description: M9 Venue Configuration Libraries.
--
--   * venues   — ADD COLUMN legal_name, tagline, address, phone, accent_seed
--                (profile columns required by /settings/profile).
--   * spaces   — ADD COLUMN indoor_outdoor, capacity_ceremony, photo_path,
--                sort_order, is_archived (display + archive support).
--   * floor_templates  — per-space canvas blueprint; layout stored as jsonb
--                        blob (SD-5 — drops floor_template_tables normalisation).
--   * packages         — venue price package library; from_price_minor in
--                        integer minor units (SD-7).
--   * package_lines    — line items within a package; unit_minor int (SD-7).
--   * custom_fields    — venue-level field definitions (applies_to contact|wedding).
--   * weddings FK      — ALTER TABLE weddings ADD CONSTRAINT fk_weddings_package_id
--                        (deferred from M8; packages table now exists).
--
-- RLS template:
--   floor_templates, packages, package_lines, custom_fields:
--     OWNER-ADMIN-WRITE — members SELECT; owners/admins INSERT/UPDATE/DELETE.
--
-- SD notes applied:
--   SD-5: floor_templates uses layout jsonb (not floor_template_tables rows).
--   SD-7: all money columns are integer minor units (*_minor int).
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS
--             before recreate, DO $$ guards for ADD COLUMN. Reuses helpers
--             from 20260611100000 (set_updated_at, current_venue_ids,
--             current_owner_or_admin_venue_ids).

-- ============================================================
-- ALTER TABLE venues — profile columns (venue-settings.md §2)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'legal_name'
  ) THEN
    ALTER TABLE public.venues ADD COLUMN legal_name text;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'tagline'
  ) THEN
    ALTER TABLE public.venues ADD COLUMN tagline text;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'address'
  ) THEN
    ALTER TABLE public.venues ADD COLUMN address text;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.venues ADD COLUMN phone text;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'accent_seed'
  ) THEN
    ALTER TABLE public.venues
      ADD COLUMN accent_seed text NOT NULL DEFAULT 'pink'
        CHECK (accent_seed IN ('pink','teal','blue','green','mint','muted'));
  END IF;
END;
$$;

-- ============================================================
-- ALTER TABLE spaces — display + archive columns (venue-settings.md §3)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'spaces' AND column_name = 'indoor_outdoor'
  ) THEN
    ALTER TABLE public.spaces
      ADD COLUMN indoor_outdoor text NOT NULL DEFAULT 'indoor'
        CHECK (indoor_outdoor IN ('indoor', 'outdoor', 'both'));
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'spaces' AND column_name = 'capacity_ceremony'
  ) THEN
    ALTER TABLE public.spaces ADD COLUMN capacity_ceremony int;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'spaces' AND column_name = 'photo_path'
  ) THEN
    ALTER TABLE public.spaces ADD COLUMN photo_path text;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'spaces' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE public.spaces ADD COLUMN sort_order int NOT NULL DEFAULT 0;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'spaces' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE public.spaces ADD COLUMN is_archived boolean NOT NULL DEFAULT false;
  END IF;
END;
$$;

-- ============================================================
-- TABLE: floor_templates — per-space canvas blueprints (SD-5)
--
-- SD-5 resolution: layout is a jsonb blob matching the FloorplanTable[]
-- and RoomElement[] shapes from src/lib/mock/planning.ts. The normalised
-- floor_template_tables child table is NOT created — table/seat positions
-- live inside layout. Denormalised table_count and capacity are
-- re-derived from layout on save (application layer).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.floor_templates (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  space_id     uuid        NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  is_default   boolean     NOT NULL DEFAULT false,
  layout       jsonb       NULL,                        -- NULL = empty canvas; SD-5 blob
  table_count  int         NULL,                        -- denormalised; derived on save
  capacity     int         NULL,                        -- denormalised; derived on save
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_floor_templates_venue_id ON public.floor_templates (venue_id);
CREATE INDEX IF NOT EXISTS idx_floor_templates_space_id ON public.floor_templates (space_id);

-- At most one default template per space
CREATE UNIQUE INDEX IF NOT EXISTS uq_floor_templates_default_space
  ON public.floor_templates (space_id)
  WHERE is_default;

DROP TRIGGER IF EXISTS trg_floor_templates_updated_at ON public.floor_templates;
CREATE TRIGGER trg_floor_templates_updated_at
  BEFORE UPDATE ON public.floor_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.floor_templates ENABLE ROW LEVEL SECURITY;

-- OWNER-ADMIN-WRITE: members read; owners/admins INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "floor_templates_select_members" ON public.floor_templates;
CREATE POLICY "floor_templates_select_members" ON public.floor_templates
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "floor_templates_insert_owners_admins" ON public.floor_templates;
CREATE POLICY "floor_templates_insert_owners_admins" ON public.floor_templates
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "floor_templates_update_owners_admins" ON public.floor_templates;
CREATE POLICY "floor_templates_update_owners_admins" ON public.floor_templates
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "floor_templates_delete_owners_admins" ON public.floor_templates;
CREATE POLICY "floor_templates_delete_owners_admins" ON public.floor_templates
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- ============================================================
-- TABLE: packages — venue price package library (SD-7 minor units)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.packages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id         uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  season           text        NULL,
  description      text        NULL,
  from_price_minor int         NULL,                    -- SD-7: indicative from-price in pence
  is_active        boolean     NOT NULL DEFAULT true,
  sort_order       int         NOT NULL DEFAULT 1000,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packages_venue_id ON public.packages (venue_id);

DROP TRIGGER IF EXISTS trg_packages_updated_at ON public.packages;
CREATE TRIGGER trg_packages_updated_at
  BEFORE UPDATE ON public.packages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- OWNER-ADMIN-WRITE
DROP POLICY IF EXISTS "packages_select_members" ON public.packages;
CREATE POLICY "packages_select_members" ON public.packages
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "packages_insert_owners_admins" ON public.packages;
CREATE POLICY "packages_insert_owners_admins" ON public.packages
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "packages_update_owners_admins" ON public.packages;
CREATE POLICY "packages_update_owners_admins" ON public.packages
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "packages_delete_owners_admins" ON public.packages;
CREATE POLICY "packages_delete_owners_admins" ON public.packages
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- ============================================================
-- TABLE: package_lines — line items within a package (SD-7 minor units)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.package_lines (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id            uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  package_id          uuid        NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  label               text        NOT NULL,
  unit_minor          int         NOT NULL,             -- SD-7: price per unit in pence
  unit_type           text        NOT NULL
                        CHECK (unit_type IN ('flat','per_head','per_evening')),
  qty_tied_to_guests  boolean     NOT NULL DEFAULT false,
  category            text        NOT NULL DEFAULT 'package'
                        CHECK (category IN ('package','addon')),
  sort_order          int         NOT NULL DEFAULT 1000,
  created_at          timestamptz NOT NULL DEFAULT now()
  -- No updated_at: line items are replaced not edited; parent package tracks updated_at
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_package_lines_venue_id   ON public.package_lines (venue_id);
CREATE INDEX IF NOT EXISTS idx_package_lines_package_id ON public.package_lines (package_id);

ALTER TABLE public.package_lines ENABLE ROW LEVEL SECURITY;

-- OWNER-ADMIN-WRITE (follows parent packages)
DROP POLICY IF EXISTS "package_lines_select_members" ON public.package_lines;
CREATE POLICY "package_lines_select_members" ON public.package_lines
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "package_lines_insert_owners_admins" ON public.package_lines;
CREATE POLICY "package_lines_insert_owners_admins" ON public.package_lines
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "package_lines_update_owners_admins" ON public.package_lines;
CREATE POLICY "package_lines_update_owners_admins" ON public.package_lines
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "package_lines_delete_owners_admins" ON public.package_lines;
CREATE POLICY "package_lines_delete_owners_admins" ON public.package_lines
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- ============================================================
-- TABLE: custom_fields — venue-level field definitions
-- (venue-settings.md §7; applies_to contact|wedding)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.custom_fields (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  key         text        NOT NULL,  -- slug used in contacts.custom / weddings.custom jsonb
  label       text        NOT NULL,
  type        text        NOT NULL
                CHECK (type IN ('text','number','select','date')),
  options     text[]      NULL,      -- populated only when type = 'select'
  applies_to  text        NOT NULL
                CHECK (applies_to IN ('contact','wedding')),
  sort_order  int         NOT NULL DEFAULT 0,
  is_archived boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_fields_venue_key_unique UNIQUE (venue_id, key)
);

-- Cap of 12 active fields per venue enforced at application layer (server action).
CREATE INDEX IF NOT EXISTS idx_custom_fields_venue_id ON public.custom_fields (venue_id);

DROP TRIGGER IF EXISTS trg_custom_fields_updated_at ON public.custom_fields;
CREATE TRIGGER trg_custom_fields_updated_at
  BEFORE UPDATE ON public.custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

-- OWNER-ADMIN-WRITE
DROP POLICY IF EXISTS "custom_fields_select_members" ON public.custom_fields;
CREATE POLICY "custom_fields_select_members" ON public.custom_fields
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "custom_fields_insert_owners_admins" ON public.custom_fields;
CREATE POLICY "custom_fields_insert_owners_admins" ON public.custom_fields
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "custom_fields_update_owners_admins" ON public.custom_fields;
CREATE POLICY "custom_fields_update_owners_admins" ON public.custom_fields
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "custom_fields_delete_owners_admins" ON public.custom_fields;
CREATE POLICY "custom_fields_delete_owners_admins" ON public.custom_fields
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- ============================================================
-- DEFERRED FK: weddings.package_id → packages(id)
--
-- M8 declared weddings.package_id as plain uuid (no FK) because packages
-- did not yet exist. Now that packages is created above, we add the
-- constraint. DO $$ guard makes this re-runnable.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name         = 'weddings'
      AND constraint_name    = 'fk_weddings_package_id'
  ) THEN
    ALTER TABLE public.weddings
      ADD CONSTRAINT fk_weddings_package_id
        FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- FK backing index (deferred from M8 with the constraint)
CREATE INDEX IF NOT EXISTS idx_weddings_package_id
  ON public.weddings (package_id) WHERE package_id IS NOT NULL;

-- ============================================================
-- Down (rollback)
-- ============================================================
-- ALTER TABLE public.weddings DROP CONSTRAINT IF EXISTS fk_weddings_package_id;
-- DROP TABLE IF EXISTS public.custom_fields;
-- DROP TABLE IF EXISTS public.package_lines;
-- DROP TABLE IF EXISTS public.packages;
-- DROP TABLE IF EXISTS public.floor_templates;
-- ALTER TABLE public.spaces
--   DROP COLUMN IF EXISTS is_archived,
--   DROP COLUMN IF EXISTS sort_order,
--   DROP COLUMN IF EXISTS photo_path,
--   DROP COLUMN IF EXISTS capacity_ceremony,
--   DROP COLUMN IF EXISTS indoor_outdoor;
-- ALTER TABLE public.venues
--   DROP COLUMN IF EXISTS accent_seed,
--   DROP COLUMN IF EXISTS phone,
--   DROP COLUMN IF EXISTS address,
--   DROP COLUMN IF EXISTS tagline,
--   DROP COLUMN IF EXISTS legal_name;
