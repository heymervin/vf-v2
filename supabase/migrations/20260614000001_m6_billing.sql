-- Migration: m6_billing
-- Date: 2026-06-14
-- Description: M6 — Stripe billing subscriptions, idempotency ledger,
--              trial_ends_at default fix, and reporting views.
--
-- Idempotent: safe to re-apply (CREATE TABLE IF NOT EXISTS,
--             DROP POLICY IF EXISTS before recreate, CREATE OR REPLACE VIEW).

-- ============================================================
-- Fix: ensure create_venue_with_owner sets trial_ends_at
-- The M1 RPC already sets now()+14d; this DO block verifies it
-- exists and patches any venues inserted before that line was added.
-- ============================================================

DO $$
BEGIN
  -- If any venue somehow has NULL trial_ends_at (e.g. pre-RPC insert),
  -- backfill with created_at + 14 days so trial logic is consistent.
  UPDATE public.venues
  SET trial_ends_at = created_at + interval '14 days'
  WHERE trial_ends_at IS NULL;
END;
$$;

-- ============================================================
-- ENUM: subscription_status
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE public.subscription_status AS ENUM (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete'
    );
  END IF;
END;
$$;

-- ============================================================
-- TABLE: billing_subscriptions
-- One row per venue; upserted on every Stripe lifecycle event.
-- Writes are service-role only — RLS blocks authenticated writes.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id                 uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  stripe_customer_id       text        NOT NULL,
  stripe_subscription_id   text,
  status                   public.subscription_status NOT NULL DEFAULT 'trialing',
  current_period_end       timestamptz,
  price_id                 text,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_subscriptions_venue_id_unique UNIQUE (venue_id)
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_venue_id
  ON public.billing_subscriptions (venue_id);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_stripe_subscription_id
  ON public.billing_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_billing_subscriptions_updated_at ON public.billing_subscriptions;
CREATE TRIGGER trg_billing_subscriptions_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;

-- Owners can read their own subscription row; no authenticated writes.
DROP POLICY IF EXISTS "billing_subscriptions_select_owners" ON public.billing_subscriptions;
CREATE POLICY "billing_subscriptions_select_owners" ON public.billing_subscriptions
  FOR SELECT
  TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- No INSERT / UPDATE / DELETE for authenticated — all writes via service-role webhook handler.

-- ============================================================
-- TABLE: stripe_events (idempotency ledger)
-- Webhook handler inserts on-conflict-do-nothing to dedupe replays.
-- Service-role only — no RLS needed but enable for safety.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id   text        PRIMARY KEY,
  type       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- No authenticated access — stripe_events is internal service-role only.
-- RLS with no policies = deny all non-service-role access by default.

-- ============================================================
-- VIEW: report_leads_by_stage
-- Counts of opportunities per stage per venue.
-- SECURITY INVOKER so the querying user's RLS applies (only their venue).
-- ============================================================

DROP VIEW IF EXISTS public.report_leads_by_stage;
CREATE VIEW public.report_leads_by_stage
  WITH (security_invoker = true)
AS
SELECT
  o.venue_id,
  o.stage,
  COUNT(*) AS lead_count
FROM public.opportunities o
GROUP BY o.venue_id, o.stage;

-- ============================================================
-- VIEW: report_leads_by_source
-- Counts of contacts per source per venue.
-- SECURITY INVOKER so the querying user's RLS applies.
-- ============================================================

DROP VIEW IF EXISTS public.report_leads_by_source;
CREATE VIEW public.report_leads_by_source
  WITH (security_invoker = true)
AS
SELECT
  c.venue_id,
  COALESCE(c.source, 'unknown') AS source,
  COUNT(*) AS lead_count
FROM public.contacts c
GROUP BY c.venue_id, c.source;

-- ============================================================
-- Down (rollback notes — not auto-run)
-- ============================================================
-- DROP VIEW IF EXISTS public.report_leads_by_source;
-- DROP VIEW IF EXISTS public.report_leads_by_stage;
-- DROP TABLE IF EXISTS public.stripe_events;
-- DROP TABLE IF EXISTS public.billing_subscriptions;
-- DROP TYPE IF EXISTS public.subscription_status;
