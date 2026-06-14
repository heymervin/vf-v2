-- Migration: brochure_replace_rpc
-- Date: 2026-06-14
-- Description: Atomic brochure replacement RPC.
--
--   Replacing a venue's brochure was a two-step (deactivate old, insert new)
--   with no transaction and an unchecked deactivate error. A failed insert
--   (uq_brochures_active_venue partial unique) could leave the venue with ZERO
--   active brochures. This RPC does both in ONE transaction and returns the new
--   row, so either the swap fully succeeds or nothing changes.
--
--   SECURITY DEFINER bypasses RLS but enforces its own authorization: the caller
--   must be an owner or admin of the target venue (mirrors the brochures
--   INSERT/UPDATE policies in 20260611160000_m3_lead_capture).
--
-- Idempotent (CREATE OR REPLACE FUNCTION). Reuses the memberships table from
-- 20260611100000 and the brochures table from 20260611160000.

-- ============================================================
-- RPC: replace_active_brochure
-- Atomically deactivates the venue's current active brochure (if any) and
-- inserts the new one as active, returning the new row. download_token,
-- download_count and timestamps fall back to their column defaults.
-- ============================================================

CREATE OR REPLACE FUNCTION public.replace_active_brochure(
  p_venue_id  uuid,
  p_file_path text,
  p_title     text DEFAULT NULL
)
RETURNS public.brochures
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id   uuid;
  v_brochure  public.brochures;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Authorization: caller must be an owner or admin of the target venue.
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = v_user_id
      AND venue_id = p_venue_id
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to manage this venue''s brochure' USING ERRCODE = 'P0001';
  END IF;

  -- Deactivate the current active brochure (if any). One statement, same
  -- transaction as the insert below, so the partial-unique index never sees
  -- two active rows.
  UPDATE public.brochures
     SET is_active = false
   WHERE venue_id = p_venue_id
     AND is_active;

  -- Insert the new active brochure. download_token / download_count / created_at
  -- / updated_at use their column defaults.
  INSERT INTO public.brochures (venue_id, file_path, title, is_active)
  VALUES (p_venue_id, p_file_path, p_title, true)
  RETURNING * INTO v_brochure;

  RETURN v_brochure;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_active_brochure(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.replace_active_brochure(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.replace_active_brochure(uuid, text, text) TO authenticated;

-- ============================================================
-- Down (rollback)
-- ============================================================
-- DROP FUNCTION IF EXISTS public.replace_active_brochure(uuid, text, text);
