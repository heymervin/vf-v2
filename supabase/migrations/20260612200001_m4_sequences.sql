-- Migration: m4_sequences
-- Date: 2026-06-12
-- Description: M4 Email Nurture Sequences data layer.
--
--   * sequences            — one row per venue (unique venue_id), toggled on/off.
--                            Created lazily; seeded with defaults on first read.
--   * sequence_steps       — exactly 3 per sequence (step_number 1-3, unique per
--                            sequence), content + delay_hours + enabled flag.
--                            Default wedding-venue copy seeded for new sequences.
--   * sequence_enrollments — per-opportunity enrollment record, tracks progress
--                            through the 3-step sequence.
--   * email_messages       — unified send log for all sequence emails; holds the
--                            idempotency_key used to dedupe Inngest replays.
--   * email_suppressions   — global bounce/complaint suppression list (venue_id
--                            NULL = global, across all venues).
--
-- RLS template:
--   sequences, sequence_steps, sequence_enrollments, email_messages:
--     MEMBERS SELECT; owners/admins write config (sequences, sequence_steps);
--     sequence_enrollments + email_messages have no client INSERT (admin-write only).
--   email_suppressions: no client access (service-role only).
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS
--             before recreate, CREATE OR REPLACE FUNCTION, enum guarded by
--             pg_type lookup. Reuses helpers from 20260611100000.

-- ============================================================
-- ENUM: enrollment_status
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'enrollment_status'
  ) THEN
    CREATE TYPE public.enrollment_status AS ENUM (
      'active',
      'completed',
      'stopped'
    );
  END IF;
END;
$$;

-- ============================================================
-- ENUM: email_message_status
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'email_message_status'
  ) THEN
    CREATE TYPE public.email_message_status AS ENUM (
      'sent',
      'skipped',
      'failed'
    );
  END IF;
END;
$$;

-- ============================================================
-- TABLE: sequences — one row per venue
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sequences (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  enabled    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sequences_venue_unique UNIQUE (venue_id)
);

CREATE INDEX IF NOT EXISTS idx_sequences_venue_id ON public.sequences (venue_id);

DROP TRIGGER IF EXISTS trg_sequences_updated_at ON public.sequences;
CREATE TRIGGER trg_sequences_updated_at
  BEFORE UPDATE ON public.sequences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sequences_select_members" ON public.sequences;
CREATE POLICY "sequences_select_members" ON public.sequences
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "sequences_insert_owners_admins" ON public.sequences;
CREATE POLICY "sequences_insert_owners_admins" ON public.sequences
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "sequences_update_owners_admins" ON public.sequences;
CREATE POLICY "sequences_update_owners_admins" ON public.sequences
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- ============================================================
-- TABLE: sequence_steps — exactly 3 per sequence
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sequence_steps (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid        NOT NULL REFERENCES public.sequences(id) ON DELETE CASCADE,
  venue_id    uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  step_number int         NOT NULL CHECK (step_number IN (1, 2, 3)),
  subject     text        NOT NULL,
  body        text        NOT NULL,
  delay_hours int         NOT NULL DEFAULT 0 CHECK (delay_hours >= 0),
  enabled     boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sequence_steps_unique_step UNIQUE (sequence_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence_id ON public.sequence_steps (sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_venue_id ON public.sequence_steps (venue_id);

DROP TRIGGER IF EXISTS trg_sequence_steps_updated_at ON public.sequence_steps;
CREATE TRIGGER trg_sequence_steps_updated_at
  BEFORE UPDATE ON public.sequence_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sequence_steps_select_members" ON public.sequence_steps;
CREATE POLICY "sequence_steps_select_members" ON public.sequence_steps
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "sequence_steps_insert_owners_admins" ON public.sequence_steps;
CREATE POLICY "sequence_steps_insert_owners_admins" ON public.sequence_steps
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "sequence_steps_update_owners_admins" ON public.sequence_steps;
CREATE POLICY "sequence_steps_update_owners_admins" ON public.sequence_steps
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- ============================================================
-- TABLE: sequence_enrollments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sequence_enrollments (
  id               uuid                      PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id         uuid                      NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  contact_id       uuid                      NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  opportunity_id   uuid                      NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  status           public.enrollment_status  NOT NULL DEFAULT 'active',
  stopped_reason   text                      CHECK (stopped_reason IN ('stage_moved','replied','bounced','disabled','manual')),
  current_step     int                       NOT NULL DEFAULT 0,
  created_at       timestamptz               NOT NULL DEFAULT now(),
  updated_at       timestamptz               NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_venue_id ON public.sequence_enrollments (venue_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_contact_id ON public.sequence_enrollments (contact_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_opportunity_id ON public.sequence_enrollments (opportunity_id);

-- One active enrollment per opportunity at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sequence_enrollments_active_opportunity
  ON public.sequence_enrollments (opportunity_id)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_sequence_enrollments_updated_at ON public.sequence_enrollments;
CREATE TRIGGER trg_sequence_enrollments_updated_at
  BEFORE UPDATE ON public.sequence_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sequence_enrollments ENABLE ROW LEVEL SECURITY;

-- Staff may read enrollments for their venue. No INSERT/UPDATE: admin-write only.
DROP POLICY IF EXISTS "sequence_enrollments_select_members" ON public.sequence_enrollments;
CREATE POLICY "sequence_enrollments_select_members" ON public.sequence_enrollments
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- ============================================================
-- TABLE: email_messages — send log + idempotency guard
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_messages (
  id               uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id         uuid                       NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  contact_id       uuid                       NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  enrollment_id    uuid                       REFERENCES public.sequence_enrollments(id) ON DELETE SET NULL,
  step_number      int,
  subject          text                       NOT NULL,
  status           public.email_message_status NOT NULL DEFAULT 'sent',
  provider_id      text,                                -- Resend email ID
  idempotency_key  text                       UNIQUE,   -- e.g. seq:{enrollment_id}:step:{n}
  created_at       timestamptz                NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_messages_venue_id ON public.email_messages (venue_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_contact_id ON public.email_messages (contact_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_enrollment_id ON public.email_messages (enrollment_id);

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- Staff may read message logs for their venue. No INSERT: admin-write only.
DROP POLICY IF EXISTS "email_messages_select_members" ON public.email_messages;
CREATE POLICY "email_messages_select_members" ON public.email_messages
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- ============================================================
-- TABLE: email_suppressions — global bounce/complaint list
-- ============================================================

CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid        REFERENCES public.venues(id) ON DELETE SET NULL,  -- NULL = global
  email      citext      NOT NULL,
  reason     text        NOT NULL CHECK (reason IN ('bounce','complaint')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_suppressions_email_unique UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_email_suppressions_email ON public.email_suppressions (email);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
-- No client policies — this table is service-role only (bounce webhook writes it).

-- ============================================================
-- RPC: get_or_create_sequence
-- Returns the venue's sequence row (with 3 seeded default steps if new).
-- SECURITY DEFINER so the seed insert bypasses RLS for the step rows.
-- Callers must be members of the venue.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_or_create_sequence(p_venue_id uuid)
RETURNS public.sequences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id  uuid;
  v_seq      public.sequences;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = v_user_id AND venue_id = p_venue_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this venue' USING ERRCODE = 'P0001';
  END IF;

  -- Upsert the sequence row (idempotent).
  INSERT INTO public.sequences (venue_id, enabled)
  VALUES (p_venue_id, false)
  ON CONFLICT (venue_id) DO NOTHING;

  SELECT * INTO v_seq FROM public.sequences WHERE venue_id = p_venue_id;

  -- Seed the 3 default steps if they do not already exist.
  INSERT INTO public.sequence_steps
    (sequence_id, venue_id, step_number, subject, body, delay_hours, enabled)
  VALUES
    (
      v_seq.id, p_venue_id, 1,
      'A little something to help you plan',
      E'Hi {{first_name}},\n\nThank you so much for reaching out to {{venue_name}} — we''re thrilled you''re considering us for your wedding day.\n\nIf you haven''t already, do take a look at the brochure we sent over. It covers everything from our spaces and capacities to what a day with us really looks like.\n\nWe''d love to answer any questions you have, or arrange a viewing so you can see the venue for yourself. Just reply to this email and we''ll sort something out.\n\nWarm wishes,\n{{venue_name}}',
      1,
      true
    ),
    (
      v_seq.id, p_venue_id, 2,
      'Still thinking it over? We''re here when you''re ready',
      E'Hi {{first_name}},\n\nPlanning a wedding takes time, and we completely understand that. We just wanted to check in and let you know we''re here whenever you''re ready to take the next step.\n\nIf you''d like to come and see {{venue_name}} in person, a viewing is the best way to picture your day here. We keep our diary flexible — just reply and we''ll find a time that works for you and {{partner_name}}.\n\nLooking forward to hearing from you.\n\nWarm wishes,\n{{venue_name}}',
      72,
      true
    ),
    (
      v_seq.id, p_venue_id, 3,
      'Your dream venue is still available',
      E'Hi {{first_name}},\n\nWe know how busy life gets, so we thought we''d drop you one last note. {{venue_name}} still has availability for your wedding date, and we''d hate for you to miss out.\n\nIf now isn''t the right time, no worries at all — we wish you all the very best with your planning. But if you''d like to arrange a viewing or have any questions, we''re only a reply away.\n\nWith warmest wishes,\n{{venue_name}}',
      168,
      true
    )
  ON CONFLICT (sequence_id, step_number) DO NOTHING;

  RETURN v_seq;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_sequence(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_or_create_sequence(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_sequence(uuid) TO authenticated;

-- ============================================================
-- Down (rollback)
-- ============================================================
-- DROP FUNCTION IF EXISTS public.get_or_create_sequence(uuid);
-- DROP TABLE IF EXISTS public.email_suppressions;
-- DROP TABLE IF EXISTS public.email_messages;
-- DROP TABLE IF EXISTS public.sequence_enrollments;
-- DROP TABLE IF EXISTS public.sequence_steps;
-- DROP TABLE IF EXISTS public.sequences;
-- DROP TYPE IF EXISTS public.email_message_status;
-- DROP TYPE IF EXISTS public.enrollment_status;
