-- Migration: invitations
-- Date: 2026-06-14
-- Description: Team invitations. An owner invites someone by email; an
--              invitation row holds a single-use token. The invitee, once
--              logged in, redeems the token at /accept-invite/<token> which
--              inserts their membership.
--
--   RLS:
--     SELECT  — any member of the venue (so the team page can list pending invites)
--     INSERT  — owners only (current_owner_venue_ids(), SECURITY DEFINER helper
--               from 20260611100000_tenancy_layer)
--     DELETE  — owners only (revoke a pending invite)
--   No UPDATE policy for authenticated: accept_invitation (SECURITY DEFINER)
--   stamps accepted_at, so RLS never needs to allow direct updates.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS before recreate,
--             CREATE OR REPLACE FUNCTION. Reuses citext (20260611000000) and the
--             memberships table + helpers (20260611100000).

-- ============================================================
-- TABLE: invitations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invitations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  email       citext      NOT NULL,
  role        text        NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  token       uuid        NOT NULL DEFAULT gen_random_uuid(),
  invited_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT invitations_token_unique UNIQUE (token)
);

-- Index: FK backing index (venue_id → venues); also backs the team page's
-- "pending invites for this venue" listing.
CREATE INDEX IF NOT EXISTS idx_invitations_venue_id ON public.invitations (venue_id);
-- Index: redemption looks an invite up by token (already unique, but make the
-- intent explicit and keep it covering the common WHERE token = ... path).
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations (token);

-- Only one OPEN (not-yet-accepted) invite per venue+email. Re-inviting the same
-- address replaces the open one (handled in the action via upsert/delete).
CREATE UNIQUE INDEX IF NOT EXISTS uq_invitations_open_venue_email
  ON public.invitations (venue_id, email)
  WHERE accepted_at IS NULL;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: invitations
-- Uses current_venue_ids() / current_owner_venue_ids() (SECURITY DEFINER
-- helpers from 20260611100000) — never subquery memberships directly here.
-- ============================================================

DROP POLICY IF EXISTS "invitations_select_members" ON public.invitations;
CREATE POLICY "invitations_select_members" ON public.invitations
  FOR SELECT
  TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "invitations_insert_owners" ON public.invitations;
CREATE POLICY "invitations_insert_owners" ON public.invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_owner_venue_ids()));

DROP POLICY IF EXISTS "invitations_delete_owners" ON public.invitations;
CREATE POLICY "invitations_delete_owners" ON public.invitations
  FOR DELETE
  TO authenticated
  USING (venue_id IN (SELECT public.current_owner_venue_ids()));

-- No UPDATE policy: accept_invitation (SECURITY DEFINER) handles accepted_at.

-- ============================================================
-- RPC: accept_invitation
-- Redeems a token for the CURRENT user: validates the invite (exists, not
-- accepted), confirms it was addressed to this user's email, creates the
-- membership (idempotent if already a member), and stamps accepted_at — all in
-- one transaction. SECURITY DEFINER bypasses RLS (the invitee is not yet a
-- member, so they could not insert their own membership) but enforces its own
-- authorization: the logged-in user's email must match the invite.
--
-- Returns the venue_id on success so the caller can redirect.
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id    uuid;
  v_user_email citext;
  v_invite     public.invitations;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_invite
  FROM public.invitations
  WHERE token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This invite link is not valid.' USING ERRCODE = 'P0001';
  END IF;

  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'This invite has already been used.' USING ERRCODE = 'P0001';
  END IF;

  -- The invite must be addressed to the logged-in user's email (citext = is
  -- case-insensitive).
  IF v_invite.email <> v_user_email THEN
    RAISE EXCEPTION 'This invite was sent to a different email address.' USING ERRCODE = 'P0001';
  END IF;

  -- Create the membership. If they're somehow already a member, do nothing.
  INSERT INTO public.memberships (venue_id, user_id, role)
  VALUES (v_invite.venue_id, v_user_id, v_invite.role)
  ON CONFLICT (venue_id, user_id) DO NOTHING;

  -- Mark the invite consumed.
  UPDATE public.invitations
     SET accepted_at = now()
   WHERE id = v_invite.id;

  RETURN v_invite.venue_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_invitation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;

-- ============================================================
-- Down (rollback)
-- ============================================================
-- DROP FUNCTION IF EXISTS public.accept_invitation(uuid);
-- DROP POLICY IF EXISTS "invitations_delete_owners" ON public.invitations;
-- DROP POLICY IF EXISTS "invitations_insert_owners" ON public.invitations;
-- DROP POLICY IF EXISTS "invitations_select_members" ON public.invitations;
-- DROP TABLE IF EXISTS public.invitations;
