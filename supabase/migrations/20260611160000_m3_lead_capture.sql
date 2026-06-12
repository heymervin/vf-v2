-- Migration: m3_lead_capture
-- Date: 2026-06-11
-- Description: M3 Lead Capture Form & Brochure data layer.
--
--   * form_submissions — raw enquiry payloads, ALWAYS saved (never lose a lead).
--       Writes happen only through the public server action using the SERVICE
--       ROLE (admin) client after Zod validation + honeypot + rate limit, so
--       the table has NO anon/authenticated INSERT policy. Reads are tenant
--       scoped for staff.
--   * brochures — one active PDF per venue (partial unique). Public download
--       proxy looks rows up by an opaque download_token (admin client), logs
--       the open (count + timestamp), and 302s to a fresh signed URL.
--   * venue_email_settings — per-venue from_name + reply_to for sent email.
--   * brochures storage bucket (private, PDF only, 10 MiB cap).
--
-- RLS template: members SELECT; owners/admins write venue config (brochures,
-- email settings). form_submissions: members SELECT only; no client writes.
--
-- Idempotent. Reuses helpers from 20260611100000 (current_venue_ids,
-- current_owner_or_admin_venue_ids, set_updated_at).

-- ============================================================
-- TABLE: form_submissions  (admin-write only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.form_submissions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  payload      jsonb       NOT NULL,                 -- raw form fields as submitted
  utm          jsonb,                                -- utm_* + source query params
  ip           inet,
  referrer     text,
  contact_id   uuid        REFERENCES public.contacts(id) ON DELETE SET NULL,
  processed_at timestamptz,                          -- set once upserted into a contact
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- FK backing index + reporting path
CREATE INDEX IF NOT EXISTS idx_form_submissions_venue_id ON public.form_submissions (venue_id);
-- Per-IP rate-limit lookups (count recent submissions for an IP at a venue)
CREATE INDEX IF NOT EXISTS idx_form_submissions_ip_created
  ON public.form_submissions (venue_id, ip, created_at);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Staff may read submissions for their venue. No INSERT/UPDATE/DELETE policy:
-- the public capture action writes with the service-role client (bypasses RLS).
DROP POLICY IF EXISTS "form_submissions_select_members" ON public.form_submissions;
CREATE POLICY "form_submissions_select_members" ON public.form_submissions
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- ============================================================
-- TABLE: brochures
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brochures (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id           uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  file_path          text        NOT NULL,           -- {venue_id}/... in the brochures bucket
  title              text,
  is_active          boolean     NOT NULL DEFAULT true,
  download_token     uuid        NOT NULL DEFAULT gen_random_uuid(),
  download_count     int         NOT NULL DEFAULT 0,
  last_downloaded_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brochures_venue_id ON public.brochures (venue_id);
-- One active brochure per venue.
CREATE UNIQUE INDEX IF NOT EXISTS uq_brochures_active_venue
  ON public.brochures (venue_id) WHERE is_active;
-- Public proxy looks brochures up by token.
CREATE UNIQUE INDEX IF NOT EXISTS uq_brochures_download_token
  ON public.brochures (download_token);

DROP TRIGGER IF EXISTS trg_brochures_updated_at ON public.brochures;
CREATE TRIGGER trg_brochures_updated_at
  BEFORE UPDATE ON public.brochures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brochures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "brochures_select_members" ON public.brochures;
CREATE POLICY "brochures_select_members" ON public.brochures
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "brochures_insert_owners_admins" ON public.brochures;
CREATE POLICY "brochures_insert_owners_admins" ON public.brochures
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "brochures_update_owners_admins" ON public.brochures;
CREATE POLICY "brochures_update_owners_admins" ON public.brochures
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "brochures_delete_owners_admins" ON public.brochures;
CREATE POLICY "brochures_delete_owners_admins" ON public.brochures
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- ============================================================
-- TABLE: venue_email_settings
-- ============================================================

CREATE TABLE IF NOT EXISTS public.venue_email_settings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  from_name  text,
  reply_to   citext,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venue_email_settings_venue_unique UNIQUE (venue_id)
);

CREATE INDEX IF NOT EXISTS idx_venue_email_settings_venue_id
  ON public.venue_email_settings (venue_id);

DROP TRIGGER IF EXISTS trg_venue_email_settings_updated_at ON public.venue_email_settings;
CREATE TRIGGER trg_venue_email_settings_updated_at
  BEFORE UPDATE ON public.venue_email_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.venue_email_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venue_email_settings_select_members" ON public.venue_email_settings;
CREATE POLICY "venue_email_settings_select_members" ON public.venue_email_settings
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "venue_email_settings_insert_owners_admins" ON public.venue_email_settings;
CREATE POLICY "venue_email_settings_insert_owners_admins" ON public.venue_email_settings
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "venue_email_settings_update_owners_admins" ON public.venue_email_settings;
CREATE POLICY "venue_email_settings_update_owners_admins" ON public.venue_email_settings
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- ============================================================
-- STORAGE: brochures bucket (private, PDF only, 10 MiB)
-- Files under {venue_id}/... so folder RLS scopes by venue membership.
-- Public delivery is via the download-proxy route using a signed URL minted
-- by the service-role client, so no public bucket policy is needed.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('brochures', 'brochures', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "brochures_obj_select_members" ON storage.objects;
CREATE POLICY "brochures_obj_select_members" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'brochures'
    AND (storage.foldername(name))[1] IN (SELECT (public.current_venue_ids())::text)
  );

DROP POLICY IF EXISTS "brochures_obj_insert_owners_admins" ON storage.objects;
CREATE POLICY "brochures_obj_insert_owners_admins" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'brochures'
    AND (storage.foldername(name))[1] IN (SELECT (public.current_owner_or_admin_venue_ids())::text)
  );

DROP POLICY IF EXISTS "brochures_obj_update_owners_admins" ON storage.objects;
CREATE POLICY "brochures_obj_update_owners_admins" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'brochures'
    AND (storage.foldername(name))[1] IN (SELECT (public.current_owner_or_admin_venue_ids())::text)
  )
  WITH CHECK (
    bucket_id = 'brochures'
    AND (storage.foldername(name))[1] IN (SELECT (public.current_owner_or_admin_venue_ids())::text)
  );

DROP POLICY IF EXISTS "brochures_obj_delete_owners_admins" ON storage.objects;
CREATE POLICY "brochures_obj_delete_owners_admins" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'brochures'
    AND (storage.foldername(name))[1] IN (SELECT (public.current_owner_or_admin_venue_ids())::text)
  );

-- ============================================================
-- Down (rollback)
-- ============================================================
-- DROP POLICY IF EXISTS "brochures_obj_delete_owners_admins" ON storage.objects;
-- DROP POLICY IF EXISTS "brochures_obj_update_owners_admins" ON storage.objects;
-- DROP POLICY IF EXISTS "brochures_obj_insert_owners_admins" ON storage.objects;
-- DROP POLICY IF EXISTS "brochures_obj_select_members" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'brochures';
-- DROP TABLE IF EXISTS public.venue_email_settings;
-- DROP TABLE IF EXISTS public.brochures;
-- DROP TABLE IF EXISTS public.form_submissions;
