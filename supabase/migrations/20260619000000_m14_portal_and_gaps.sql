-- Migration: m14_portal_and_gaps
-- Date: 2026-06-19
-- Description: Closes verified spec/audit gaps across Slices 1, 2, 5, 6, 8.
--
--   1. ghl_webhook_events     — webhook dedup table referenced by the GHL webhook
--                               handler (route.ts §5) and present in types.ts, but
--                               missing from all prior migration SQL (Slice 1/2/6 P0).
--   2. ghl_credentials        — location_id NOT NULL + UNIQUE (webhook routing key,
--                               Slice 1 P0).
--   3. contacts/opportunities — partial-UNIQUE indexes on the GHL link keys so a GHL
--                               id maps to exactly one row per venue (Slice 1 P1).
--   4. weddings               — index on ghl_contact_id for InboundMessage routing
--                               (Slice 6 P1).
--   5. weddings               — couple-scoped SELECT policy so a couple session can
--                               read its own wedding (Slice 8 P0 — was missing).
--   6. floor_plans            — couple-scoped SELECT policy (read-only seating, Slice 8 P1).
--   7. wedding_tasks          — couple checklist table (Home-tab tasks); member CRUD +
--                               couple SELECT gated on visible_to_couple (Slice 8 P1).
--   8. proposals.discount_type — widen CHECK from ('pct','fixed') to the app-canonical
--                               ('percentage','fixed'); migrate any legacy 'pct' rows
--                               (Slice 5 P0 — DB rejected every percentage discount).
--
-- RLS helpers used:
--   public.current_venue_ids()                  — any member of the venue
--   public.current_couple_wedding_ids()         — wedding_ids for the active couple session
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY/CONSTRAINT/TRIGGER IF EXISTS
--             before recreate, guarded DO blocks.

-- ============================================================
-- 1. TABLE: ghl_webhook_events  (Slice 1/2/6 P0)
-- Inbound-webhook idempotency ledger. Written ONLY by the webhook handler via
-- the service role (ON CONFLICT (webhook_id) DO NOTHING). No authenticated
-- policies — tokens/ids here are never exposed to clients.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ghl_webhook_events (
  webhook_id text        PRIMARY KEY,
  type       text        NOT NULL,
  venue_id   uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ghl_webhook_events_venue_id
  ON public.ghl_webhook_events (venue_id);

ALTER TABLE public.ghl_webhook_events ENABLE ROW LEVEL SECURITY;
-- (no policies: service-role only)

-- ============================================================
-- 2. ghl_credentials.location_id NOT NULL + UNIQUE  (Slice 1 P0)
-- location_id is the GHL sub-account id used to route inbound webhooks to a venue;
-- it must be present and unique. The connect action already enforces min(1).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.ghl_credentials WHERE location_id IS NULL
  ) THEN
    ALTER TABLE public.ghl_credentials ALTER COLUMN location_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'ghl_credentials has NULL location_id rows; skipping SET NOT NULL';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ghl_credentials_location_id
  ON public.ghl_credentials (location_id);

-- ============================================================
-- 3. Partial-UNIQUE indexes on GHL link keys  (Slice 1 P1)
-- A given GHL contact/opportunity id maps to at most one row per venue.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_ghl_contact_id_unique
  ON public.contacts (venue_id, ghl_contact_id)
  WHERE ghl_contact_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_opportunities_ghl_opportunity_id_unique
  ON public.opportunities (venue_id, ghl_opportunity_id)
  WHERE ghl_opportunity_id IS NOT NULL;

-- ============================================================
-- 4. weddings.ghl_contact_id index  (Slice 6 P1)
-- InboundMessage webhooks resolve the wedding via (venue_id, ghl_contact_id).
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_weddings_ghl_contact_id
  ON public.weddings (ghl_contact_id)
  WHERE ghl_contact_id IS NOT NULL;

-- ============================================================
-- 5. weddings couple-scoped SELECT policy  (Slice 8 P0)
-- A couple session must read its own wedding row. Staff policies already exist.
-- ============================================================

DROP POLICY IF EXISTS "weddings_select_couples" ON public.weddings;
CREATE POLICY "weddings_select_couples" ON public.weddings
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.current_couple_wedding_ids()));

-- ============================================================
-- 6. floor_plans couple-scoped SELECT policy  (Slice 8 P1)
-- Couples see a read-only seating canvas for their own wedding.
-- ============================================================

DROP POLICY IF EXISTS "floor_plans_select_couples" ON public.floor_plans;
CREATE POLICY "floor_plans_select_couples" ON public.floor_plans
  FOR SELECT TO authenticated
  USING (wedding_id IN (SELECT public.current_couple_wedding_ids()));

-- ============================================================
-- 7. TABLE: wedding_tasks  (Slice 8 P1)
-- Per-wedding checklist. Staff MEMBER-CRUD; couples SELECT only the tasks
-- explicitly published to them (visible_to_couple = true).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wedding_tasks (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id          uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  wedding_id        uuid        NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  title             text        NOT NULL,
  due_date          date        NULL,
  done              boolean     NOT NULL DEFAULT false,
  visible_to_couple boolean     NOT NULL DEFAULT false,
  category          text        NOT NULL DEFAULT 'planning'
                      CHECK (category IN ('money', 'planning', 'suppliers', 'admin')),
  sort_index        numeric     NOT NULL DEFAULT 0,
  owner             text        NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wedding_tasks_venue_id   ON public.wedding_tasks (venue_id);
CREATE INDEX IF NOT EXISTS idx_wedding_tasks_wedding_id ON public.wedding_tasks (wedding_id);
-- Couple Home-tab query: visible tasks for a wedding ordered by sort_index
CREATE INDEX IF NOT EXISTS idx_wedding_tasks_couple
  ON public.wedding_tasks (wedding_id, visible_to_couple, sort_index);

DROP TRIGGER IF EXISTS trg_wedding_tasks_updated_at ON public.wedding_tasks;
CREATE TRIGGER trg_wedding_tasks_updated_at
  BEFORE UPDATE ON public.wedding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.wedding_tasks ENABLE ROW LEVEL SECURITY;

-- Staff: MEMBER-CRUD
DROP POLICY IF EXISTS "wedding_tasks_select_members" ON public.wedding_tasks;
CREATE POLICY "wedding_tasks_select_members" ON public.wedding_tasks
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "wedding_tasks_insert_members" ON public.wedding_tasks;
CREATE POLICY "wedding_tasks_insert_members" ON public.wedding_tasks
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "wedding_tasks_update_members" ON public.wedding_tasks;
CREATE POLICY "wedding_tasks_update_members" ON public.wedding_tasks
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "wedding_tasks_delete_members" ON public.wedding_tasks;
CREATE POLICY "wedding_tasks_delete_members" ON public.wedding_tasks
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- Couple: SELECT only tasks published to them, for their own wedding.
DROP POLICY IF EXISTS "wedding_tasks_select_couples" ON public.wedding_tasks;
CREATE POLICY "wedding_tasks_select_couples" ON public.wedding_tasks
  FOR SELECT TO authenticated
  USING (
    wedding_id IN (SELECT public.current_couple_wedding_ids())
    AND visible_to_couple = true
  );

-- ============================================================
-- 8. proposals.discount_type — align DB CHECK with app-canonical value  (Slice 5 P0)
-- App writes 'percentage' (src/lib/money/proposal.ts, proposal builder); the DB
-- previously only allowed 'pct', so every percentage discount failed to save.
-- ============================================================

ALTER TABLE public.proposals DROP CONSTRAINT IF EXISTS proposals_discount_type_check;
UPDATE public.proposals SET discount_type = 'percentage' WHERE discount_type = 'pct';
ALTER TABLE public.proposals
  ADD CONSTRAINT proposals_discount_type_check
  CHECK (discount_type IN ('percentage', 'fixed'));
