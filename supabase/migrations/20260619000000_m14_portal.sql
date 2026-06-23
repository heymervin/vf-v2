-- Migration: m14_portal
-- Date: 2026-06-19
-- Description: Couple Portal supplemental tables + columns.
--
--   Complements 20260619000000_m14_portal_and_gaps.sql (which owns wedding_tasks,
--   ghl_webhook_events, RLS fixes). This file adds:
--
--   * couple_messages   — standalone couple↔staff messaging (no GHL dependency).
--   * weddings columns  — portal_theme jsonb + contract_terms text[].
--   * couple_accounts   — email lookup index.
--   * wedding_tasks     — rename label→title + add owner col if applied out of order.
--
-- RLS helpers used:
--   public.current_venue_ids()           — any member of the venue
--   public.current_couple_wedding_ids()  — active couple session (M8)
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS
--             before recreate, ALTER TABLE ADD COLUMN IF NOT EXISTS.

-- ============================================================
-- Fix wedding_tasks column name if this migration ran before _and_gaps
-- (label → title; add owner if missing)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'wedding_tasks'
      AND column_name  = 'label'
  ) THEN
    ALTER TABLE public.wedding_tasks RENAME COLUMN label TO title;
  END IF;
END $$;

ALTER TABLE public.wedding_tasks
  ADD COLUMN IF NOT EXISTS owner text;

-- ============================================================
-- TABLE: couple_messages
-- Standalone couple↔staff messaging thread (no GHL dependency).
-- Couples can read all + send direction='couple_to_staff'.
-- Staff can read all for their venue.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.couple_messages (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  wedding_id   uuid        NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  direction    text        NOT NULL CHECK (direction IN ('couple_to_staff','staff_to_couple')),
  body         text        NOT NULL,
  author_name  text        NOT NULL,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz
);

CREATE INDEX IF NOT EXISTS idx_couple_messages_wedding_id
  ON public.couple_messages (wedding_id);
CREATE INDEX IF NOT EXISTS idx_couple_messages_venue_id
  ON public.couple_messages (venue_id);

ALTER TABLE public.couple_messages ENABLE ROW LEVEL SECURITY;

-- Couple: read all messages for their wedding; send only couple_to_staff
DROP POLICY IF EXISTS "couple_messages_select_couples" ON public.couple_messages;
CREATE POLICY "couple_messages_select_couples" ON public.couple_messages
  FOR SELECT TO authenticated
  USING (wedding_id IN (SELECT public.current_couple_wedding_ids()));

DROP POLICY IF EXISTS "couple_messages_insert_couples" ON public.couple_messages;
CREATE POLICY "couple_messages_insert_couples" ON public.couple_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    wedding_id IN (SELECT public.current_couple_wedding_ids())
    AND direction = 'couple_to_staff'
  );

-- Staff: read all for their venue
DROP POLICY IF EXISTS "couple_messages_select_members" ON public.couple_messages;
CREATE POLICY "couple_messages_select_members" ON public.couple_messages
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "couple_messages_insert_members" ON public.couple_messages;
CREATE POLICY "couple_messages_insert_members" ON public.couple_messages
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

-- ============================================================
-- weddings columns: portal_theme + contract_terms
-- ============================================================

ALTER TABLE public.weddings
  ADD COLUMN IF NOT EXISTS portal_theme jsonb,
  ADD COLUMN IF NOT EXISTS contract_terms text[] NOT NULL DEFAULT '{}';

-- ============================================================
-- couple_accounts: email lookup index
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_couple_accounts_email
  ON public.couple_accounts (email);
