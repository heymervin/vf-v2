-- Migration: m5_booking
-- Date: 2026-06-13
-- Description: M5 Calendar Booking data layer.
--
--   * meeting_type_kind enum  — fixed 2 values: 'viewing' | 'call'
--   * appointment_status enum — 'booked' | 'attended' | 'no_show' | 'cancelled'
--   * meeting_types       — venue_id + kind (unique per venue); duration/buffer tunable.
--                           Seeded via trigger on venue INSERT + backfill existing.
--   * availability_rules  — per-staff weekday time windows.
--   * appointments        — single booking record; EXCLUDE constraint is the
--                           double-booking guard; manage_token for self-serve.
--
-- RLS template: meeting_types + availability_rules → member SELECT, owner/admin
--               write. appointments → member SELECT/UPDATE (status lifecycle),
--               no authenticated INSERT (public books via service role).
--               Public INSERT is admin-client only (server action).
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS
--             before recreate, DO $$ guard on enums, CREATE OR REPLACE FUNCTION.
--             btree_gist already in extensions.sql.

-- ============================================================
-- ENUM: meeting_type_kind
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'meeting_type_kind'
  ) THEN
    CREATE TYPE public.meeting_type_kind AS ENUM ('viewing', 'call');
  END IF;
END;
$$;

-- ============================================================
-- ENUM: appointment_status
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'appointment_status'
  ) THEN
    CREATE TYPE public.appointment_status AS ENUM (
      'booked',
      'attended',
      'no_show',
      'cancelled'
    );
  END IF;
END;
$$;

-- ============================================================
-- TABLE: meeting_types
-- Exactly 2 rows per venue (one per kind). Seeded on venue creation.
-- Venues tune duration_minutes / buffer_minutes — they never add types.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meeting_types (
  id               uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id         uuid                   NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  kind             public.meeting_type_kind NOT NULL,
  duration_minutes int                    NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  buffer_minutes   int                    NOT NULL DEFAULT 0  CHECK (buffer_minutes >= 0),
  enabled          boolean                NOT NULL DEFAULT true,
  created_at       timestamptz            NOT NULL DEFAULT now(),
  updated_at       timestamptz            NOT NULL DEFAULT now(),
  CONSTRAINT meeting_types_venue_kind_unique UNIQUE (venue_id, kind)
);

-- Adjust defaults per kind (viewing = 60 min, call = 20 min) at the application
-- layer — the table stores whatever the venue has configured; the seed trigger
-- supplies the correct defaults on creation.

-- FK backing index
CREATE INDEX IF NOT EXISTS idx_meeting_types_venue_id ON public.meeting_types (venue_id);

DROP TRIGGER IF EXISTS trg_meeting_types_updated_at ON public.meeting_types;
CREATE TRIGGER trg_meeting_types_updated_at
  BEFORE UPDATE ON public.meeting_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meeting_types ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TABLE: availability_rules
-- Per-staff weekly schedule. Each row = one weekday window for one member.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.availability_rules (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id      uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  membership_id uuid        NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  weekday       smallint    NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time    time        NOT NULL,
  end_time      time        NOT NULL,
  CHECK (end_time > start_time),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_availability_rules_venue_id       ON public.availability_rules (venue_id);
CREATE INDEX IF NOT EXISTS idx_availability_rules_membership_id  ON public.availability_rules (membership_id);
-- Common query: all rules for a venue+staff member
CREATE INDEX IF NOT EXISTS idx_availability_rules_venue_member   ON public.availability_rules (venue_id, membership_id);

DROP TRIGGER IF EXISTS trg_availability_rules_updated_at ON public.availability_rules;
CREATE TRIGGER trg_availability_rules_updated_at
  BEFORE UPDATE ON public.availability_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TABLE: appointments
-- Each row is one scheduled meeting. The EXCLUDE constraint on
-- tstzrange(starts_at, ends_at) is the authoritative double-booking guard —
-- it enforces at the DB level that no two 'booked' appointments overlap
-- for the same staff member.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.appointments (
  id              uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        uuid                    NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  meeting_type_id uuid                    NOT NULL REFERENCES public.meeting_types(id),
  membership_id   uuid                    NOT NULL REFERENCES public.memberships(id),
  contact_id      uuid                    NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  opportunity_id  uuid                    REFERENCES public.opportunities(id) ON DELETE SET NULL,
  starts_at       timestamptz             NOT NULL,
  ends_at         timestamptz             NOT NULL,
  CHECK (ends_at > starts_at),
  status          public.appointment_status NOT NULL DEFAULT 'booked',
  manage_token    uuid                    NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  cancelled_at    timestamptz,
  source          text                    NOT NULL DEFAULT 'public'
                    CHECK (source IN ('public', 'staff')),
  created_at      timestamptz             NOT NULL DEFAULT now(),
  updated_at      timestamptz             NOT NULL DEFAULT now(),
  -- THE double-booking guard: no two 'booked' appointments for the same
  -- staff member may overlap in time. Uses btree_gist (already enabled).
  EXCLUDE USING gist (
    membership_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status = 'booked')
);

-- FK / query-path indexes
CREATE INDEX IF NOT EXISTS idx_appointments_venue_id      ON public.appointments (venue_id);
CREATE INDEX IF NOT EXISTS idx_appointments_membership_id ON public.appointments (membership_id);
CREATE INDEX IF NOT EXISTS idx_appointments_contact_id    ON public.appointments (contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_starts_at     ON public.appointments (starts_at);
-- Busy-range lookup (engine query): booked appointments for a staff member in a window
CREATE INDEX IF NOT EXISTS idx_appointments_member_booked
  ON public.appointments (membership_id, starts_at, ends_at)
  WHERE status = 'booked';

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRIGGER: seed meeting_types on venue INSERT
-- Creates one 'viewing' (60 min) and one 'call' (20 min) row for every
-- new venue, mirroring the fixed product spec.
-- ============================================================

CREATE OR REPLACE FUNCTION public.seed_meeting_types_for_venue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.meeting_types (venue_id, kind, duration_minutes, buffer_minutes, enabled)
  VALUES
    (NEW.id, 'viewing', 60, 0, true),
    (NEW.id, 'call',    20, 0, true)
  ON CONFLICT (venue_id, kind) DO NOTHING;
  RETURN NULL; -- AFTER trigger
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_meeting_types ON public.venues;
CREATE TRIGGER trg_seed_meeting_types
  AFTER INSERT ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.seed_meeting_types_for_venue();

-- ============================================================
-- BACKFILL: seed meeting_types for all existing venues that
-- don't yet have rows (idempotent via ON CONFLICT DO NOTHING).
-- ============================================================

INSERT INTO public.meeting_types (venue_id, kind, duration_minutes, buffer_minutes, enabled)
SELECT v.id, k.kind, k.dur, 0, true
FROM public.venues v
CROSS JOIN (VALUES
  ('viewing'::public.meeting_type_kind, 60),
  ('call'::public.meeting_type_kind,    20)
) AS k(kind, dur)
ON CONFLICT (venue_id, kind) DO NOTHING;

-- ============================================================
-- RLS POLICIES: meeting_types — member read, owner/admin write
-- ============================================================

DROP POLICY IF EXISTS "meeting_types_select_members" ON public.meeting_types;
CREATE POLICY "meeting_types_select_members" ON public.meeting_types
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "meeting_types_update_owners_admins" ON public.meeting_types;
CREATE POLICY "meeting_types_update_owners_admins" ON public.meeting_types
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- No INSERT/DELETE for authenticated — rows are created by the trigger only.

-- ============================================================
-- RLS POLICIES: availability_rules — full template, member CRUD
-- ============================================================

DROP POLICY IF EXISTS "availability_rules_select_members" ON public.availability_rules;
CREATE POLICY "availability_rules_select_members" ON public.availability_rules
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "availability_rules_insert_owners_admins" ON public.availability_rules;
CREATE POLICY "availability_rules_insert_owners_admins" ON public.availability_rules
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "availability_rules_update_owners_admins" ON public.availability_rules;
CREATE POLICY "availability_rules_update_owners_admins" ON public.availability_rules
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "availability_rules_delete_owners_admins" ON public.availability_rules;
CREATE POLICY "availability_rules_delete_owners_admins" ON public.availability_rules
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- ============================================================
-- RLS POLICIES: appointments — members SELECT + UPDATE (lifecycle),
-- no authenticated INSERT (server action uses service role).
-- ============================================================

DROP POLICY IF EXISTS "appointments_select_members" ON public.appointments;
CREATE POLICY "appointments_select_members" ON public.appointments
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "appointments_update_members" ON public.appointments;
CREATE POLICY "appointments_update_members" ON public.appointments
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

-- No INSERT policy for authenticated: public bookings go through the admin
-- (service-role) client in the server action to bypass RLS. Staff bookings
-- added in a future task will similarly use admin client.
-- No DELETE: cancellations set status = 'cancelled' (soft).

-- ============================================================
-- Down (rollback — not run automatically, for reference)
-- ============================================================
-- DROP TRIGGER IF EXISTS trg_seed_meeting_types ON public.venues;
-- DROP FUNCTION IF EXISTS public.seed_meeting_types_for_venue();
-- DROP TABLE IF EXISTS public.appointments;
-- DROP TABLE IF EXISTS public.availability_rules;
-- DROP TABLE IF EXISTS public.meeting_types;
-- DROP TYPE IF EXISTS public.appointment_status;
-- DROP TYPE IF EXISTS public.meeting_type_kind;
