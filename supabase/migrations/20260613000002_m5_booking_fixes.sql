-- Migration: m5_booking_fixes
-- Date: 2026-06-13
-- Description: Post-review fixes for M5.
--
--   N1  ip column on appointments — captures request IP for per-IP rate limiting
--       in bookSlot. Nullable inet; existing rows get NULL (acceptable).
--
--   N4  reschedule_appointment RPC — atomic cancel-then-rebook inside a single
--       Postgres transaction. The EXCLUDE constraint on the new INSERT fires
--       before the old row is cancelled; on conflict the whole tx rolls back
--       and the customer keeps their original booking.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION.

-- ============================================================
-- N1: ip column on appointments
-- ============================================================

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS ip inet;

-- Index to support the rate-limit count query (ip + created_at range).
CREATE INDEX IF NOT EXISTS idx_appointments_ip_created
  ON public.appointments (ip, created_at)
  WHERE ip IS NOT NULL;

-- ============================================================
-- N4: reschedule_appointment RPC
--
-- Atomically reschedules a booking identified by manage_token:
--   1. Validates the token resolves to a 'booked' appointment.
--   2. INSERTs the new appointment row (same membership/contact/opp/
--      meeting_type, fresh manage_token, status='booked').
--      If the EXCLUDE constraint fires (23P01) the INSERT raises and
--      the transaction rolls back — the original booking is preserved.
--   3. Only on successful INSERT: marks the old appointment cancelled.
--   4. Returns the new manage_token.
--
-- SECURITY DEFINER: bypasses RLS (called from the public booking page
-- where there is no authenticated session). The function enforces its
-- own access control via manage_token lookup.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reschedule_appointment(
  p_manage_token uuid,
  p_starts_at    timestamptz,
  p_ends_at      timestamptz
)
RETURNS uuid   -- the new manage_token
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old        public.appointments%ROWTYPE;
  v_new_token  uuid;
BEGIN
  -- 1. Look up and lock the existing booking.
  SELECT * INTO v_old
    FROM public.appointments
   WHERE manage_token = p_manage_token
     AND status       = 'booked'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or already cancelled'
      USING ERRCODE = 'P0001';
  END IF;

  -- Basic sanity on the requested window.
  IF p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'ends_at must be after starts_at'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Insert the new appointment.
  --    If the EXCLUDE constraint fires (23P01), the error propagates and
  --    Postgres rolls back the whole transaction — v_old remains 'booked'.
  v_new_token := gen_random_uuid();

  INSERT INTO public.appointments (
    venue_id,
    meeting_type_id,
    membership_id,
    contact_id,
    opportunity_id,
    starts_at,
    ends_at,
    status,
    manage_token,
    source
  ) VALUES (
    v_old.venue_id,
    v_old.meeting_type_id,
    v_old.membership_id,
    v_old.contact_id,
    v_old.opportunity_id,
    p_starts_at,
    p_ends_at,
    'booked',
    v_new_token,
    v_old.source
  );

  -- 3. Cancel the original booking (only reached if INSERT succeeded).
  UPDATE public.appointments
     SET status       = 'cancelled',
         cancelled_at = now()
   WHERE id = v_old.id;

  -- 4. Return the new manage_token for the confirmation page redirect.
  RETURN v_new_token;
END;
$$;

-- No public/anon access — called exclusively from the server-side admin client.
REVOKE ALL ON FUNCTION public.reschedule_appointment(uuid, timestamptz, timestamptz)
  FROM PUBLIC;

-- ============================================================
-- Down (rollback — not run automatically)
-- ============================================================
-- DROP FUNCTION IF EXISTS public.reschedule_appointment(uuid, timestamptz, timestamptz);
-- ALTER TABLE public.appointments DROP COLUMN IF EXISTS ip;
