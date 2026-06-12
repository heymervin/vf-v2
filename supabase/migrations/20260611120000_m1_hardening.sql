-- Migration: m1_hardening
-- Date: 2026-06-11
-- Description: Two security hardening items identified in M1 review:
--
--   1. venues.slug CHECK constraint — the RPC create_venue_with_owner
--      validates slug format in application code, but a direct UPDATE via
--      any client (anon key bypass, service-role script, future RPC) can
--      write an arbitrary string. This constraint moves the validation to
--      the database layer so it is enforced unconditionally on every write.
--
--      Regex: ^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$
--      — must start and end with an alphanumeric character
--      — middle chars may be alphanumeric or hyphen
--      — total length 3–50 characters
--      Note: slug column is citext; the cast to text is required because
--      PostgreSQL does not apply regex operators to citext directly in
--      CHECK expressions on all versions.
--
--      Idempotent: wrapped in a DO block that skips if the constraint
--      already exists (pg_constraint lookup).
--
--   2. venue-assets storage bucket limits — the bucket was created with
--      file_size_limit = NULL and allowed_mime_types = NULL, meaning the
--      Storage API accepted any MIME type and any file size. A client with
--      the anon key could upload an arbitrary file (text/plain, SVG, video,
--      etc.) to any path in their venue folder that the RLS INSERT policy
--      allows. These limits are now server-enforced:
--
--      file_size_limit   = 2097152 bytes (2 MiB) — sufficient for logos
--      allowed_mime_types = {image/png, image/jpeg, image/webp}
--      SVG is deliberately excluded: the app is dropping SVG upload support.
--
--      Idempotent: UPDATE with WHERE guards (only touches the row if the
--      values differ from what is already stored).

-- ============================================================
-- 1. venues.slug format CHECK constraint
-- ============================================================

-- Pre-flight check (informational — migration was written after confirming
-- zero rows in venues on 2026-06-11; constraint added without NOT VALID).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'venues_slug_format'
      AND conrelid = 'public.venues'::regclass
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_slug_format
      CHECK (slug::text ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$');

    RAISE NOTICE 'venues_slug_format constraint added';
  ELSE
    RAISE NOTICE 'venues_slug_format constraint already exists — skipped';
  END IF;
END;
$$;

-- ============================================================
-- 2. venue-assets bucket server-enforced limits
-- ============================================================

UPDATE storage.buckets
SET
  file_size_limit    = 2097152,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE
  id = 'venue-assets'
  AND (
    file_size_limit    IS DISTINCT FROM 2097152
    OR allowed_mime_types IS DISTINCT FROM ARRAY['image/png', 'image/jpeg', 'image/webp']
  );

-- ============================================================
-- Down (rollback)
-- ============================================================
-- -- Remove slug format constraint
-- ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_slug_format;
--
-- -- Revert bucket to unbounded / unrestricted (matches original INSERT state)
-- UPDATE storage.buckets
-- SET
--   file_size_limit    = NULL,
--   allowed_mime_types = NULL
-- WHERE id = 'venue-assets';
