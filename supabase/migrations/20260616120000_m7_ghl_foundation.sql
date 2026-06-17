-- Migration: m7_ghl_foundation
-- Date: 2026-06-16
-- Description: M7 GoHighLevel integration foundation.
--
--   * ghl_credentials          — one row per venue; stores encrypted PIT/OAuth
--                                tokens for the GHL sub-account. Service-role
--                                only — no authenticated RLS policies (SD-8).
--   * venues.mode              — 'bundled' (GHL connected) | 'standalone'
--                                (VF-native only). DEFAULT 'bundled' (SD-1).
--   * contacts.ghl_contact_id  — nullable foreign key into GHL for two-way sync.
--   * opportunities.ghl_opportunity_id — nullable foreign key into GHL.
--
-- RLS template:
--   ghl_credentials: RLS ENABLED, zero client policies. All reads/writes go
--   through the service-role admin client (createAdminClient) after an
--   owner/admin auth check in server actions. Tokens are AES-256-GCM encrypted
--   at the application layer (SD-8).
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS
--             before recreate, DO $$ guards for ADD COLUMN. Reuses helpers
--             from 20260611100000 (set_updated_at, current_venue_ids,
--             current_owner_or_admin_venue_ids).

-- ============================================================
-- ALTER TABLE venues — add mode column (SD-1)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'venues'
      AND column_name  = 'mode'
  ) THEN
    ALTER TABLE public.venues
      ADD COLUMN mode text NOT NULL DEFAULT 'bundled'
        CHECK (mode IN ('bundled', 'standalone'));
  END IF;
END;
$$;

-- ============================================================
-- ALTER TABLE contacts — add ghl_contact_id column
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'contacts'
      AND column_name  = 'ghl_contact_id'
  ) THEN
    ALTER TABLE public.contacts
      ADD COLUMN ghl_contact_id text;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_contacts_ghl_contact_id
  ON public.contacts (ghl_contact_id);

-- ============================================================
-- ALTER TABLE opportunities — add ghl_opportunity_id column
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'opportunities'
      AND column_name  = 'ghl_opportunity_id'
  ) THEN
    ALTER TABLE public.opportunities
      ADD COLUMN ghl_opportunity_id text;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_opportunities_ghl_opportunity_id
  ON public.opportunities (ghl_opportunity_id);

-- ============================================================
-- TABLE: ghl_credentials — one row per venue
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ghl_credentials (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id         uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  location_id      text,
  auth_type        text        NOT NULL DEFAULT 'pit'
                     CHECK (auth_type IN ('pit', 'oauth')),
  access_token     text,                              -- AES-256-GCM ciphertext (SD-8)
  refresh_token    text,                              -- AES-256-GCM ciphertext (SD-8)
  token_expires_at timestamptz,
  scopes           text[],
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ghl_credentials_venue_unique UNIQUE (venue_id)
);

CREATE INDEX IF NOT EXISTS idx_ghl_credentials_venue_id
  ON public.ghl_credentials (venue_id);

DROP TRIGGER IF EXISTS trg_ghl_credentials_updated_at ON public.ghl_credentials;
CREATE TRIGGER trg_ghl_credentials_updated_at
  BEFORE UPDATE ON public.ghl_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ghl_credentials ENABLE ROW LEVEL SECURITY;

-- SD-8: NO authenticated RLS policies on ghl_credentials.
-- Tokens are encrypted at the application layer (AES-256-GCM, keyed by
-- GHL_TOKEN_ENCRYPTION_KEY). All reads and writes are performed exclusively
-- via the service-role admin client (createAdminClient) inside server actions
-- that perform their own owner/admin auth check. Granting direct row access
-- to the authenticated role — even SELECT — would expose ciphertext to clients
-- through the PostgREST auto-API, which violates the SD-8 security contract.

-- ============================================================
-- Down (rollback)
-- ============================================================
-- DROP TABLE IF EXISTS public.ghl_credentials;
-- DROP INDEX IF EXISTS idx_opportunities_ghl_opportunity_id;
-- ALTER TABLE public.opportunities DROP COLUMN IF EXISTS ghl_opportunity_id;
-- DROP INDEX IF EXISTS idx_contacts_ghl_contact_id;
-- ALTER TABLE public.contacts DROP COLUMN IF EXISTS ghl_contact_id;
-- ALTER TABLE public.venues DROP COLUMN IF EXISTS mode;
