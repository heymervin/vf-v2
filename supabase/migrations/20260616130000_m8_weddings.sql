-- Migration: m8_weddings
-- Date: 2026-06-16
-- Description: M8 Weddings + Couple Accounts data layer.
--
--   * weddings          — post-booking workspace record; one row per booked couple
--                         per venue. Spawned by Inngest ghl/opportunity-won (bundled
--                         mode) or created manually by staff (standalone mode, D6).
--                         SD-2 canonical column set: couple_names, coordinator_membership_id,
--                         guest_count_day/evening, total_value_minor (SD-7 minor units),
--                         package_id + menu_id as plain uuid (FK constraints deferred —
--                         package FK added in M9, menu FK added in M10), source DEFAULT
--                         'manual' (SD-2 overrides data-model 'ghl_webhook').
--                         status is text NOT NULL with CHECK (SD-2 wins over enum).
--
--   * couple_accounts   — auth identity for the couple portal; up to 2 rows per
--                         wedding (one per partner). SD-3 canonical shape: user_id FK
--                         auth.users (not auth_user_id), role partner_a/partner_b,
--                         invited_at/activated_at/last_login_at, no invite_token.
--                         Invite flow: Supabase auth.admin.inviteUserByEmail (magic link).
--
--   * current_couple_wedding_ids() — SECURITY DEFINER helper returning wedding_ids
--                         the authenticated couple user can access. Used by
--                         COUPLE-SCOPED RLS policies in M11+ planning tables.
--
-- Cross-migration FK note:
--   weddings.package_id references packages (created in M9). To avoid forward FK
--   references, package_id and menu_id are declared as plain uuid columns here with
--   no FK constraint. The FK constraint is added via ALTER TABLE in M9 (package_id)
--   and M10 (menu_id) after those tables exist.
--
-- RLS template:
--   weddings:       MEMBER-CRUD (staff SELECT/INSERT/UPDATE; owner/admin DELETE).
--   couple_accounts: staff member SELECT only; all writes via service-role client
--                   (Inngest creates rows; last_login_at updated server-side).
--                   Couples read their own account via current_couple_wedding_ids().
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS
--             before recreate, CREATE OR REPLACE FUNCTION. Reuses helpers from
--             20260611100000 (set_updated_at, current_venue_ids,
--             current_owner_or_admin_venue_ids).

-- NOTE: the SECURITY DEFINER helper public.current_couple_wedding_ids() is
-- defined further below, AFTER the couple_accounts table — a LANGUAGE sql
-- function body that selects from couple_accounts cannot be created before
-- that table exists (check_function_bodies validates the body at creation).

-- ============================================================
-- TABLE: weddings
-- Post-booking workspace record. One row per booked couple per venue.
-- SD-2: couple_names (single display string; partner detail in couple_accounts),
--        coordinator_membership_id FK→memberships, status text CHECK,
--        source DEFAULT 'manual', package_id + menu_id plain uuid (FKs added later).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.weddings (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id                uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  contact_id              uuid        REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id          uuid        REFERENCES public.opportunities(id) ON DELETE SET NULL,
  ghl_opportunity_id      text,
  ghl_contact_id          text,
  space_id                uuid        REFERENCES public.spaces(id) ON DELETE SET NULL,
  coordinator_membership_id uuid      REFERENCES public.memberships(id) ON DELETE SET NULL,
  -- SD-2: single couple display string; partner details live in couple_accounts
  couple_names            text        NOT NULL,
  wedding_date            date,
  guest_count_day         int,
  guest_count_evening     int,
  -- SD-2: status as text + CHECK (not enum); SD-2 canonical values
  status                  text        NOT NULL DEFAULT 'planning'
                            CHECK (status IN ('planning','confirmed','completed','cancelled')),
  -- SD-7: all money in minor units (pence)
  total_value_minor       int,
  -- package_id + menu_id: plain uuid — FK constraints added in M9 (package) and M10 (menu)
  package_id              uuid,
  menu_id                 uuid,
  -- SD-2: source DEFAULT 'manual' (overrides data-model default of 'ghl_webhook')
  source                  text        NOT NULL DEFAULT 'manual'
                            CHECK (source IN ('ghl_webhook','manual')),
  -- Additional operational columns from data-model (not in conflict with SD-2)
  package_name            text,
  contract_status         text        NOT NULL DEFAULT 'missing'
                            CHECK (contract_status IN ('missing','sent','signed')),
  portal_active           boolean     NOT NULL DEFAULT false,
  portal_last_seen_at     timestamptz,
  notes                   text,
  custom                  jsonb       NOT NULL DEFAULT '{}',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_weddings_venue_id
  ON public.weddings (venue_id);
CREATE INDEX IF NOT EXISTS idx_weddings_contact_id
  ON public.weddings (contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weddings_opportunity_id
  ON public.weddings (opportunity_id) WHERE opportunity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weddings_coordinator_membership_id
  ON public.weddings (coordinator_membership_id) WHERE coordinator_membership_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weddings_space_id
  ON public.weddings (space_id) WHERE space_id IS NOT NULL;
-- Date-range query: upcoming weddings per venue
CREATE INDEX IF NOT EXISTS idx_weddings_venue_date
  ON public.weddings (venue_id, wedding_date);
-- GHL lookup without a join through opportunities
CREATE INDEX IF NOT EXISTS idx_weddings_ghl_opportunity_id
  ON public.weddings (ghl_opportunity_id) WHERE ghl_opportunity_id IS NOT NULL;
-- Natural dedup: one active (non-cancelled) wedding per opportunity
CREATE UNIQUE INDEX IF NOT EXISTS uq_weddings_opportunity
  ON public.weddings (opportunity_id)
  WHERE opportunity_id IS NOT NULL AND status != 'cancelled';

DROP TRIGGER IF EXISTS trg_weddings_updated_at ON public.weddings;
CREATE TRIGGER trg_weddings_updated_at
  BEFORE UPDATE ON public.weddings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.weddings ENABLE ROW LEVEL SECURITY;

-- MEMBER-CRUD: all staff at the venue may read and write weddings.
-- DELETE is restricted to owner/admin (soft cancellation preferred).

DROP POLICY IF EXISTS "weddings_select_members" ON public.weddings;
CREATE POLICY "weddings_select_members" ON public.weddings
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "weddings_insert_members" ON public.weddings;
CREATE POLICY "weddings_insert_members" ON public.weddings
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "weddings_update_members" ON public.weddings;
CREATE POLICY "weddings_update_members" ON public.weddings
  FOR UPDATE TO authenticated
  USING  (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

-- DELETE: owner/admin only — hard delete is a last resort; cancellations set status='cancelled'.
DROP POLICY IF EXISTS "weddings_delete_owners_admins" ON public.weddings;
CREATE POLICY "weddings_delete_owners_admins" ON public.weddings
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- ============================================================
-- TABLE: couple_accounts
-- Auth identity for the couple portal. Up to 2 rows per wedding.
-- SD-3: user_id FK→auth.users (linked on invite acceptance), role
--        partner_a/partner_b (nullable), invited_at/activated_at/last_login_at.
--        No invite_token column — invite flow uses Supabase auth.admin.inviteUserByEmail.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.couple_accounts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  wedding_id    uuid        NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  -- user_id is NULL until the couple activates their invite
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  email         citext      NOT NULL,
  -- first_name for portal display (SD-3); nullable — not always known at invite time
  first_name    text,
  -- role nullable: a single-login couple need not assign a role
  role          text        CHECK (role IN ('partner_a','partner_b')),
  -- SD-3: status text CHECK (not enum)
  status        text        NOT NULL DEFAULT 'invited'
                  CHECK (status IN ('invited','active','disabled')),
  invited_at    timestamptz,
  activated_at  timestamptz,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- One account per email per wedding
  CONSTRAINT uq_couple_accounts_wedding_email UNIQUE (wedding_id, email)
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_couple_accounts_venue_id
  ON public.couple_accounts (venue_id);
CREATE INDEX IF NOT EXISTS idx_couple_accounts_wedding_id
  ON public.couple_accounts (wedding_id);
-- Portal login check: look up the couple by their Supabase auth user ID
CREATE UNIQUE INDEX IF NOT EXISTS uq_couple_accounts_user_id
  ON public.couple_accounts (user_id) WHERE user_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_couple_accounts_updated_at ON public.couple_accounts;
CREATE TRIGGER trg_couple_accounts_updated_at
  BEFORE UPDATE ON public.couple_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.couple_accounts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FUNCTION: current_couple_wedding_ids (defined here — needs couple_accounts)
-- SECURITY DEFINER helper returning the wedding_ids the authenticated couple
-- user may access. Used by couple_accounts_select_couples below and by the
-- COUPLE-SCOPED RLS policies in M11+. Couples must have status = 'active'.
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_couple_wedding_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT wedding_id
  FROM public.couple_accounts
  WHERE user_id = auth.uid()
    AND status = 'active';
$$;

REVOKE ALL ON FUNCTION public.current_couple_wedding_ids() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_couple_wedding_ids() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_couple_wedding_ids() TO authenticated;

-- Staff: members of the venue may read couple_accounts for their weddings.
-- No INSERT/UPDATE/DELETE for authenticated roles — all writes go through the
-- service-role admin client (Inngest creates the row; server actions update
-- user_id/status/last_login_at after invite acceptance).
DROP POLICY IF EXISTS "couple_accounts_select_members" ON public.couple_accounts;
CREATE POLICY "couple_accounts_select_members" ON public.couple_accounts
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- Couples: read their own account row(s) via the SECURITY DEFINER helper.
-- This allows the portal to display partner info without staff membership.
DROP POLICY IF EXISTS "couple_accounts_select_couples" ON public.couple_accounts;
CREATE POLICY "couple_accounts_select_couples" ON public.couple_accounts
  FOR SELECT TO authenticated
  USING (wedding_id IN (SELECT public.current_couple_wedding_ids()));

-- ============================================================
-- Down (rollback)
-- ============================================================
-- DROP POLICY IF EXISTS "couple_accounts_select_couples" ON public.couple_accounts;
-- DROP POLICY IF EXISTS "couple_accounts_select_members" ON public.couple_accounts;
-- DROP TRIGGER IF EXISTS trg_couple_accounts_updated_at ON public.couple_accounts;
-- DROP INDEX IF EXISTS uq_couple_accounts_user_id;
-- DROP INDEX IF EXISTS idx_couple_accounts_wedding_id;
-- DROP INDEX IF EXISTS idx_couple_accounts_venue_id;
-- DROP TABLE IF EXISTS public.couple_accounts;
-- DROP POLICY IF EXISTS "weddings_delete_owners_admins" ON public.weddings;
-- DROP POLICY IF EXISTS "weddings_update_members" ON public.weddings;
-- DROP POLICY IF EXISTS "weddings_insert_members" ON public.weddings;
-- DROP POLICY IF EXISTS "weddings_select_members" ON public.weddings;
-- DROP TRIGGER IF EXISTS trg_weddings_updated_at ON public.weddings;
-- DROP INDEX IF EXISTS uq_weddings_opportunity;
-- DROP INDEX IF EXISTS idx_weddings_ghl_opportunity_id;
-- DROP INDEX IF EXISTS idx_weddings_venue_date;
-- DROP INDEX IF EXISTS idx_weddings_space_id;
-- DROP INDEX IF EXISTS idx_weddings_coordinator_membership_id;
-- DROP INDEX IF EXISTS idx_weddings_opportunity_id;
-- DROP INDEX IF EXISTS idx_weddings_contact_id;
-- DROP INDEX IF EXISTS idx_weddings_venue_id;
-- DROP TABLE IF EXISTS public.weddings;
-- DROP FUNCTION IF EXISTS public.current_couple_wedding_ids();
