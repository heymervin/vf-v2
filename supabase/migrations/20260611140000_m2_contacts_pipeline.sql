-- Migration: m2_contacts_pipeline
-- Date: 2026-06-11
-- Description: M2 Contacts & Pipeline data layer.
--
--   * pipeline_stage enum (fixed 8 stages, MVP — no configurable pipelines)
--   * contacts        — wedding-venue CRM contacts; first-class wedding columns
--                       + custom jsonb escape hatch; pg_trgm name search;
--                       partial unique (venue_id, email) for dedupe.
--   * opportunities   — one active opportunity per contact (partial unique),
--                       fractional numeric sort_index for in-column ordering.
--   * stage_events    — append-only stage-change log, written ONLY by the
--                       opportunities stage trigger (SECURITY DEFINER); powers
--                       reports + the contact activity timeline.
--   * trg_log_stage_event — fires on opportunity INSERT (logs initial stage
--                       with from_stage NULL) and on stage UPDATE.
--   * create_contact_with_opportunity() RPC — atomically inserts a contact and
--                       its opening opportunity at 'inbound_enquiry'.
--
-- RLS: contacts + opportunities use the full tenant template for MEMBERS
--      (operational data — staff need CRUD, not just owners/admins).
--      stage_events is SELECT-only for members; all writes go through the
--      definer trigger.
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS
--             before recreate, CREATE OR REPLACE FUNCTION, enum guarded by
--             a pg_type lookup. Extensions (pg_trgm, btree_gist) already
--             enabled in 20260611000000_extensions.sql.

-- ============================================================
-- ENUM: pipeline_stage (fixed 8 stages, ordered)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'pipeline_stage'
  ) THEN
    CREATE TYPE public.pipeline_stage AS ENUM (
      'inbound_enquiry',
      'responded',
      'viewing_interest',
      'appointment_booked',
      'appointment_attended',
      'date_on_hold',
      'wedding_booked',
      'archived'
    );
  END IF;
END;
$$;

-- ============================================================
-- TABLE: contacts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contacts (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id              uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  first_name            text        NOT NULL,
  last_name             text,
  email                 citext,
  phone                 text,
  partner_first_name    text,
  partner_last_name     text,
  wedding_date          date,
  wedding_date_flexible boolean     NOT NULL DEFAULT false,
  guest_count           int,
  budget_minor          int,                     -- integer minor units (pence)
  source                text,
  email_status          text        NOT NULL DEFAULT 'ok'
                          CHECK (email_status IN ('ok', 'bounced', 'complained')),
  custom                jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- FK backing index (venue_id → venues)
CREATE INDEX IF NOT EXISTS idx_contacts_venue_id ON public.contacts (venue_id);

-- Dedupe: at most one contact per (venue, email) when an email is present.
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_venue_email
  ON public.contacts (venue_id, email)
  WHERE email IS NOT NULL;

-- pg_trgm name search (full-name expression; immutable via coalesce).
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm
  ON public.contacts
  USING gin ((lower(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) gin_trgm_ops);

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON public.contacts;
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TABLE: opportunities
-- ============================================================

CREATE TABLE IF NOT EXISTS public.opportunities (
  id          uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id    uuid                  NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  contact_id  uuid                  NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  stage       public.pipeline_stage NOT NULL DEFAULT 'inbound_enquiry',
  sort_index  numeric               NOT NULL DEFAULT 1000,
  archived_at timestamptz,
  created_at  timestamptz           NOT NULL DEFAULT now(),
  updated_at  timestamptz           NOT NULL DEFAULT now()
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_opportunities_venue_id ON public.opportunities (venue_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_contact_id ON public.opportunities (contact_id);

-- One ACTIVE (non-archived) opportunity per contact.
CREATE UNIQUE INDEX IF NOT EXISTS uq_opportunities_active_contact
  ON public.opportunities (contact_id)
  WHERE archived_at IS NULL;

-- Kanban read path: fetch a venue's board, grouped by stage, ordered in-column.
CREATE INDEX IF NOT EXISTS idx_opportunities_board
  ON public.opportunities (venue_id, stage, sort_index);

DROP TRIGGER IF EXISTS trg_opportunities_updated_at ON public.opportunities;
CREATE TRIGGER trg_opportunities_updated_at
  BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TABLE: stage_events (append-only; written by trigger only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stage_events (
  id             uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id       uuid                  NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  opportunity_id uuid                  NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  from_stage     public.pipeline_stage,                -- NULL on the opening event
  to_stage       public.pipeline_stage NOT NULL,
  changed_by     uuid                  REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at    timestamptz           NOT NULL DEFAULT now()
);

-- Reports path: venue activity over time.
CREATE INDEX IF NOT EXISTS idx_stage_events_venue_occurred
  ON public.stage_events (venue_id, occurred_at);

-- Contact timeline path: one opportunity's history, newest first.
CREATE INDEX IF NOT EXISTS idx_stage_events_opportunity_occurred
  ON public.stage_events (opportunity_id, occurred_at DESC);

ALTER TABLE public.stage_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRIGGER FN: log_stage_event
-- Records every stage transition into stage_events.
-- SECURITY DEFINER so the insert bypasses stage_events RLS — the table
-- has no INSERT policy for authenticated; this is the only writer.
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_stage_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.stage_events (venue_id, opportunity_id, from_stage, to_stage, changed_by)
    VALUES (NEW.venue_id, NEW.id, NULL, NEW.stage, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO public.stage_events (venue_id, opportunity_id, from_stage, to_stage, changed_by)
    VALUES (NEW.venue_id, NEW.id, OLD.stage, NEW.stage, auth.uid());
  END IF;
  RETURN NULL;  -- AFTER trigger: return value ignored
END;
$$;

DROP TRIGGER IF EXISTS trg_log_stage_event ON public.opportunities;
CREATE TRIGGER trg_log_stage_event
  AFTER INSERT OR UPDATE OF stage ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.log_stage_event();

-- ============================================================
-- RLS POLICIES: contacts — full template, MEMBER-scoped CRUD
-- ============================================================

DROP POLICY IF EXISTS "contacts_select_members" ON public.contacts;
CREATE POLICY "contacts_select_members" ON public.contacts
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "contacts_insert_members" ON public.contacts;
CREATE POLICY "contacts_insert_members" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "contacts_update_members" ON public.contacts;
CREATE POLICY "contacts_update_members" ON public.contacts
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "contacts_delete_members" ON public.contacts;
CREATE POLICY "contacts_delete_members" ON public.contacts
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- ============================================================
-- RLS POLICIES: opportunities — full template, MEMBER-scoped CRUD
-- ============================================================

DROP POLICY IF EXISTS "opportunities_select_members" ON public.opportunities;
CREATE POLICY "opportunities_select_members" ON public.opportunities
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "opportunities_insert_members" ON public.opportunities;
CREATE POLICY "opportunities_insert_members" ON public.opportunities
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "opportunities_update_members" ON public.opportunities;
CREATE POLICY "opportunities_update_members" ON public.opportunities
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "opportunities_delete_members" ON public.opportunities;
CREATE POLICY "opportunities_delete_members" ON public.opportunities
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- ============================================================
-- RLS POLICIES: stage_events — SELECT only; writes via trigger
-- ============================================================

DROP POLICY IF EXISTS "stage_events_select_members" ON public.stage_events;
CREATE POLICY "stage_events_select_members" ON public.stage_events
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- No INSERT/UPDATE/DELETE policies: the only writer is log_stage_event()
-- (SECURITY DEFINER). Append-only by construction.

-- ============================================================
-- RPC: create_contact_with_opportunity
-- Atomically creates a contact and its opening opportunity
-- ('inbound_enquiry'). SECURITY DEFINER bypasses RLS, but enforces its
-- own authorization: the caller must be a member of the target venue.
-- The new opportunity is placed at the TOP of the inbound_enquiry column
-- (smallest sort_index = first).
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_contact_with_opportunity(
  p_venue_id              uuid,
  p_first_name            text,
  p_last_name             text    DEFAULT NULL,
  p_email                 citext  DEFAULT NULL,
  p_phone                 text    DEFAULT NULL,
  p_partner_first_name    text    DEFAULT NULL,
  p_partner_last_name     text    DEFAULT NULL,
  p_wedding_date          date    DEFAULT NULL,
  p_wedding_date_flexible boolean DEFAULT false,
  p_guest_count           int     DEFAULT NULL,
  p_budget_minor          int     DEFAULT NULL,
  p_source                text    DEFAULT NULL
)
RETURNS public.contacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id  uuid;
  v_contact  public.contacts;
  v_sort     numeric;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Authorization: caller must belong to the target venue.
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = v_user_id AND venue_id = p_venue_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this venue' USING ERRCODE = 'P0001';
  END IF;

  -- Insert contact (partial-unique violation on (venue_id, email) → 23505).
  BEGIN
    INSERT INTO public.contacts (
      venue_id, first_name, last_name, email, phone,
      partner_first_name, partner_last_name,
      wedding_date, wedding_date_flexible, guest_count, budget_minor, source
    )
    VALUES (
      p_venue_id, p_first_name, p_last_name, p_email, p_phone,
      p_partner_first_name, p_partner_last_name,
      p_wedding_date, p_wedding_date_flexible, p_guest_count, p_budget_minor, p_source
    )
    RETURNING * INTO v_contact;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'A contact with this email already exists' USING ERRCODE = 'P0001';
  END;

  -- Place new opportunity at the top of the inbound_enquiry column.
  SELECT coalesce(min(sort_index), 1000) - 1000
    INTO v_sort
    FROM public.opportunities
   WHERE venue_id = p_venue_id
     AND stage = 'inbound_enquiry'
     AND archived_at IS NULL;

  INSERT INTO public.opportunities (venue_id, contact_id, stage, sort_index)
  VALUES (p_venue_id, v_contact.id, 'inbound_enquiry', v_sort);

  RETURN v_contact;
END;
$$;

REVOKE ALL ON FUNCTION public.create_contact_with_opportunity(
  uuid, text, text, citext, text, text, text, date, boolean, int, int, text
) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_contact_with_opportunity(
  uuid, text, text, citext, text, text, text, date, boolean, int, int, text
) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_contact_with_opportunity(
  uuid, text, text, citext, text, text, text, date, boolean, int, int, text
) TO authenticated;

-- ============================================================
-- Down (rollback)
-- ============================================================
-- DROP FUNCTION IF EXISTS public.create_contact_with_opportunity(uuid, text, text, citext, text, text, text, date, boolean, int, int, text);
-- DROP TRIGGER IF EXISTS trg_log_stage_event ON public.opportunities;
-- DROP FUNCTION IF EXISTS public.log_stage_event();
-- DROP TABLE IF EXISTS public.stage_events;
-- DROP TABLE IF EXISTS public.opportunities;
-- DROP TABLE IF EXISTS public.contacts;
-- DROP TYPE IF EXISTS public.pipeline_stage;
