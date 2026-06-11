-- Migration: tenancy_layer
-- Date: 2026-06-11
-- Description: M1 tenancy layer — venues, memberships, spaces, venue_hours,
--              helper security-definer functions, RLS policies, create_venue_with_owner
--              RPC, updated_at trigger, and venue-assets storage bucket.
--
-- Idempotent: safe to re-apply (CREATE TABLE IF NOT EXISTS, DROP POLICY IF
--             EXISTS before recreate, CREATE OR REPLACE FUNCTION).

-- ============================================================
-- SHARED: updated_at trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLE: venues
-- ============================================================

CREATE TABLE IF NOT EXISTS public.venues (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    text        NOT NULL,
  slug                    citext      NOT NULL,
  timezone                text        NOT NULL DEFAULT 'Europe/London',
  logo_path               text,
  trial_ends_at           timestamptz,
  onboarding_completed_at timestamptz,
  onboarding_step         smallint    NOT NULL DEFAULT 1,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venues_slug_unique UNIQUE (slug)
);

DROP TRIGGER IF EXISTS trg_venues_updated_at ON public.venues;
CREATE TRIGGER trg_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TABLE: memberships
-- ============================================================

CREATE TABLE IF NOT EXISTS public.memberships (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_venue_user_unique UNIQUE (venue_id, user_id)
);

-- Index: queries "what venues does this user belong to?" hit this constantly
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.memberships (user_id);
-- Index: FK backing index (venue_id → venues)
CREATE INDEX IF NOT EXISTS idx_memberships_venue_id ON public.memberships (venue_id);

DROP TRIGGER IF EXISTS trg_memberships_updated_at ON public.memberships;
CREATE TRIGGER trg_memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TABLE: spaces
-- ============================================================

CREATE TABLE IF NOT EXISTS public.spaces (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id          uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name              text        NOT NULL,
  capacity_seated   int,
  capacity_standing int,
  description       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Index: FK backing index (venue_id → venues)
CREATE INDEX IF NOT EXISTS idx_spaces_venue_id ON public.spaces (venue_id);

DROP TRIGGER IF EXISTS trg_spaces_updated_at ON public.spaces;
CREATE TRIGGER trg_spaces_updated_at
  BEFORE UPDATE ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TABLE: venue_hours
-- ============================================================

CREATE TABLE IF NOT EXISTS public.venue_hours (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  weekday    smallint    NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  open_time  time,           -- NULL means closed that day (pair with close_time)
  close_time time,           -- NULL means closed that day
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_hours_venue_weekday_unique UNIQUE (venue_id, weekday)
);

-- Index: FK backing index (venue_id → venues)
CREATE INDEX IF NOT EXISTS idx_venue_hours_venue_id ON public.venue_hours (venue_id);

DROP TRIGGER IF EXISTS trg_venue_hours_updated_at ON public.venue_hours;
CREATE TRIGGER trg_venue_hours_updated_at
  BEFORE UPDATE ON public.venue_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.venue_hours ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECURITY DEFINER HELPERS
-- These functions run with the privileges of their definer,
-- bypassing RLS on memberships. This prevents the self-
-- referential recursion that occurs when RLS policies on
-- memberships subquery memberships directly.
-- ============================================================

-- Returns the set of venue_ids the current user is a member of.
-- Used in: venues SELECT, spaces policies, venue_hours policies.
CREATE OR REPLACE FUNCTION public.current_venue_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT venue_id
  FROM public.memberships
  WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_venue_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_venue_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_venue_ids() TO authenticated;

-- Returns venue_ids where the current user has role owner or admin.
-- Used in: venues UPDATE policy, memberships write policies.
-- Separate function to avoid recursive RLS on memberships.
CREATE OR REPLACE FUNCTION public.current_owner_or_admin_venue_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT venue_id
  FROM public.memberships
  WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin');
$$;

REVOKE ALL ON FUNCTION public.current_owner_or_admin_venue_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_owner_or_admin_venue_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_owner_or_admin_venue_ids() TO authenticated;

-- Returns venue_ids where the current user has role owner (only).
-- Used in: memberships insert/update/delete policies.
CREATE OR REPLACE FUNCTION public.current_owner_venue_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT venue_id
  FROM public.memberships
  WHERE user_id = auth.uid()
    AND role = 'owner';
$$;

REVOKE ALL ON FUNCTION public.current_owner_venue_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_owner_venue_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_owner_venue_ids() TO authenticated;

-- ============================================================
-- RLS POLICIES: venues
--
-- Template for tenant-scoped tables:
--   SELECT:  id in (select current_venue_ids())
--   INSERT:  blocked for authenticated (use create_venue_with_owner RPC)
--   UPDATE:  id in (select current_owner_or_admin_venue_ids())
--   DELETE:  blocked for authenticated (hard deletes via service role only)
-- ============================================================

DROP POLICY IF EXISTS "venues_select_members" ON public.venues;
CREATE POLICY "venues_select_members" ON public.venues
  FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.current_venue_ids()));

-- No direct INSERT for authenticated — only the create_venue_with_owner RPC
-- (SECURITY DEFINER) inserts into venues.

DROP POLICY IF EXISTS "venues_update_owners_admins" ON public.venues;
CREATE POLICY "venues_update_owners_admins" ON public.venues
  FOR UPDATE
  TO authenticated
  USING (id IN (SELECT public.current_owner_or_admin_venue_ids()))
  WITH CHECK (id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- No DELETE for authenticated: hard deletes handled by service role.

-- ============================================================
-- RLS POLICIES: memberships
--
-- Uses current_owner_venue_ids() and current_venue_ids() (both
-- SECURITY DEFINER) — memberships policies must NOT subquery
-- memberships directly to avoid self-referential RLS recursion.
-- ============================================================

DROP POLICY IF EXISTS "memberships_select_members" ON public.memberships;
CREATE POLICY "memberships_select_members" ON public.memberships
  FOR SELECT
  TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- Only owners may add/change/remove memberships for their venues.
DROP POLICY IF EXISTS "memberships_insert_owners" ON public.memberships;
CREATE POLICY "memberships_insert_owners" ON public.memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_owner_venue_ids()));

DROP POLICY IF EXISTS "memberships_update_owners" ON public.memberships;
CREATE POLICY "memberships_update_owners" ON public.memberships
  FOR UPDATE
  TO authenticated
  USING (venue_id IN (SELECT public.current_owner_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_owner_venue_ids()));

DROP POLICY IF EXISTS "memberships_delete_owners" ON public.memberships;
CREATE POLICY "memberships_delete_owners" ON public.memberships
  FOR DELETE
  TO authenticated
  USING (venue_id IN (SELECT public.current_owner_venue_ids()));

-- ============================================================
-- RLS POLICIES: spaces
-- Standard tenant template — all four verbs, venue_id scoped.
-- ============================================================

DROP POLICY IF EXISTS "spaces_select_members" ON public.spaces;
CREATE POLICY "spaces_select_members" ON public.spaces
  FOR SELECT
  TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "spaces_insert_owners_admins" ON public.spaces;
CREATE POLICY "spaces_insert_owners_admins" ON public.spaces
  FOR INSERT
  TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "spaces_update_owners_admins" ON public.spaces;
CREATE POLICY "spaces_update_owners_admins" ON public.spaces
  FOR UPDATE
  TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "spaces_delete_owners_admins" ON public.spaces;
CREATE POLICY "spaces_delete_owners_admins" ON public.spaces
  FOR DELETE
  TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- ============================================================
-- RLS POLICIES: venue_hours
-- Standard tenant template — all four verbs, venue_id scoped.
-- ============================================================

DROP POLICY IF EXISTS "venue_hours_select_members" ON public.venue_hours;
CREATE POLICY "venue_hours_select_members" ON public.venue_hours
  FOR SELECT
  TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "venue_hours_insert_owners_admins" ON public.venue_hours;
CREATE POLICY "venue_hours_insert_owners_admins" ON public.venue_hours
  FOR INSERT
  TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "venue_hours_update_owners_admins" ON public.venue_hours;
CREATE POLICY "venue_hours_update_owners_admins" ON public.venue_hours
  FOR UPDATE
  TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "venue_hours_delete_owners_admins" ON public.venue_hours;
CREATE POLICY "venue_hours_delete_owners_admins" ON public.venue_hours
  FOR DELETE
  TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- ============================================================
-- RPC: create_venue_with_owner
-- Creates a venue and an owner membership atomically.
-- SECURITY DEFINER bypasses RLS so inserts always succeed;
-- the function enforces its own authorization checks.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_venue_with_owner(
  p_name text,
  p_slug citext
)
RETURNS public.venues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id  uuid;
  v_venue    public.venues;
BEGIN
  -- Require an authenticated caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Validate slug: lowercase letters, digits, hyphens; 3–50 chars
  IF p_slug !~ '^[a-z0-9][a-z0-9\-]{1,48}[a-z0-9]$' THEN
    RAISE EXCEPTION 'Invalid slug "%" — must be 3–50 chars, lowercase letters/digits/hyphens, no leading/trailing hyphen', p_slug
      USING ERRCODE = 'P0001';
  END IF;

  -- Insert venue (unique violation on slug raises 23505 automatically)
  BEGIN
    INSERT INTO public.venues (name, slug, trial_ends_at)
    VALUES (p_name, p_slug, now() + interval '14 days')
    RETURNING * INTO v_venue;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Slug "%" is already taken — please choose another', p_slug
        USING ERRCODE = 'P0001';
  END;

  -- Insert owner membership
  INSERT INTO public.memberships (venue_id, user_id, role)
  VALUES (v_venue.id, v_user_id, 'owner');

  RETURN v_venue;
END;
$$;

REVOKE ALL ON FUNCTION public.create_venue_with_owner(text, citext) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_venue_with_owner(text, citext) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_venue_with_owner(text, citext) TO authenticated;

-- ============================================================
-- STORAGE: venue-assets bucket
-- Files live under {venue_id}/... prefix so RLS can scope by
-- the folder name matching a venue the user is a member of.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('venue-assets', 'venue-assets', false)
ON CONFLICT (id) DO NOTHING;

-- Allow members to SELECT (download) objects in their venue folder
DROP POLICY IF EXISTS "venue_assets_select_members" ON storage.objects;
CREATE POLICY "venue_assets_select_members" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'venue-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT (public.current_venue_ids())::text
    )
  );

-- Allow members to INSERT (upload) objects in their venue folder
DROP POLICY IF EXISTS "venue_assets_insert_members" ON storage.objects;
CREATE POLICY "venue_assets_insert_members" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'venue-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT (public.current_venue_ids())::text
    )
  );

-- Allow owners/admins to UPDATE objects in their venue folder
DROP POLICY IF EXISTS "venue_assets_update_owners_admins" ON storage.objects;
CREATE POLICY "venue_assets_update_owners_admins" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'venue-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT (public.current_owner_or_admin_venue_ids())::text
    )
  )
  WITH CHECK (
    bucket_id = 'venue-assets'
    AND (storage.foldername(name))[1] IN (
      SELECT (public.current_owner_or_admin_venue_ids())::text
    )
  );

-- ============================================================
-- Down (rollback)
-- ============================================================
-- DROP POLICY IF EXISTS "venue_assets_update_owners_admins" ON storage.objects;
-- DROP POLICY IF EXISTS "venue_assets_insert_members" ON storage.objects;
-- DROP POLICY IF EXISTS "venue_assets_select_members" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'venue-assets';
-- DROP FUNCTION IF EXISTS public.create_venue_with_owner(text, citext);
-- DROP FUNCTION IF EXISTS public.current_owner_venue_ids();
-- DROP FUNCTION IF EXISTS public.current_owner_or_admin_venue_ids();
-- DROP FUNCTION IF EXISTS public.current_venue_ids();
-- DROP TABLE IF EXISTS public.venue_hours;
-- DROP TABLE IF EXISTS public.spaces;
-- DROP TABLE IF EXISTS public.memberships;
-- DROP TABLE IF EXISTS public.venues;
-- DROP FUNCTION IF EXISTS public.set_updated_at();
