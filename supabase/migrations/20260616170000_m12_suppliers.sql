-- Migration: m12_suppliers
-- Date: 2026-06-16
-- Description: M12 Supplier directory and per-wedding supplier assignments.
--
--   * suppliers           — venue-level preferred/approved supplier directory;
--                           owner/admin write (venue config).
--   * wedding_suppliers   — suppliers engaged for a specific wedding; member CRUD.
--                           Couple-scoped SELECT for couple portal (Slice 8).
--   * wedding_documents   — SD-6 resolved: ONE documents table for contracts,
--                           supplier docs, invoices, and couple e-sign records.
--                           Member CRUD for staff; couple-scoped SELECT + UPDATE
--                           (sign their own docs) via couple RLS.
--
-- Cross-migration FK wired here:
--   timeline_events.supplier_id → wedding_suppliers(id): the column was added
--   in M11 as a plain uuid (no FK) because wedding_suppliers did not exist.
--   We wire the FK here via ALTER TABLE now that wedding_suppliers is live.
--
-- RLS helpers used:
--   public.current_venue_ids()                  — any member of the venue
--   public.current_owner_or_admin_venue_ids()   — owner or admin only
--   public.current_couple_wedding_ids()         — active couple session
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS
--             before recreate, ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS.

-- ============================================================
-- TABLE: suppliers
-- Venue-level directory of preferred and approved suppliers.
-- Staff curate this list; couples view the "approved" subset (Slice 8).
-- RLS pattern: OWNER-ADMIN-WRITE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.suppliers (
  id             uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id       uuid           NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name           text           NOT NULL,
  category       text           NOT NULL,
  contact_name   text           NULL,
  email          citext         NULL,
  phone          text           NULL,
  website        text           NULL,
  notes          text           NULL,
  venue_approved boolean        NOT NULL DEFAULT false,
  tags           text[]         NOT NULL DEFAULT ARRAY[]::text[],
  -- not a money column; SD-7 (integer minor units) does not apply — 0.0-5.0 rating scale
  avg_rating     numeric(3,1)   NULL CHECK (avg_rating BETWEEN 0.0 AND 5.0),
  created_at     timestamptz    NOT NULL DEFAULT now(),
  updated_at     timestamptz    NOT NULL DEFAULT now()
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_venue_id ON public.suppliers (venue_id);
-- Category browse query (staff and couple-approved list)
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON public.suppliers (venue_id, category);

DROP TRIGGER IF EXISTS trg_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: suppliers — OWNER-ADMIN-WRITE
-- All members can browse the directory; only owners/admins modify it.
-- ============================================================

DROP POLICY IF EXISTS "suppliers_select_members" ON public.suppliers;
CREATE POLICY "suppliers_select_members" ON public.suppliers
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "suppliers_insert_owners_admins" ON public.suppliers;
CREATE POLICY "suppliers_insert_owners_admins" ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "suppliers_update_owners_admins" ON public.suppliers;
CREATE POLICY "suppliers_update_owners_admins" ON public.suppliers
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

DROP POLICY IF EXISTS "suppliers_delete_owners_admins" ON public.suppliers;
CREATE POLICY "suppliers_delete_owners_admins" ON public.suppliers
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_owner_or_admin_venue_ids()));

-- ============================================================
-- TABLE: wedding_suppliers
-- Suppliers engaged for a specific wedding — pulled from the venue directory
-- (supplier_id FK) or added ad-hoc (supplier_id NULL). Tracks arrival time,
-- status, and doc-chase counters per wedding.
-- RLS pattern: MEMBER-CRUD for staff; couple-scoped SELECT (Slice 8).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wedding_suppliers (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id       uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  wedding_id     uuid        NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  -- NULL = ad-hoc supplier not in the venue directory
  supplier_id    uuid        NULL REFERENCES public.suppliers(id) ON DELETE SET NULL,
  name           text        NOT NULL,
  category       text        NOT NULL,
  contact_name   text        NULL,
  email          citext      NULL,
  phone          text        NULL,
  status         text        NOT NULL DEFAULT 'enquired'
                   CHECK (status IN ('confirmed', 'pending', 'enquired', 'declined')),
  arrival_time   time        NULL,
  checked_in_at  timestamptz NULL,
  notes          text        NULL,
  docs_required  int         NOT NULL DEFAULT 0 CHECK (docs_required >= 0),
  docs_received  int         NOT NULL DEFAULT 0 CHECK (docs_received >= 0),
  tags           text[]      NOT NULL DEFAULT ARRAY[]::text[],
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_wedding_suppliers_venue_id   ON public.wedding_suppliers (venue_id);
CREATE INDEX IF NOT EXISTS idx_wedding_suppliers_wedding_id ON public.wedding_suppliers (wedding_id);
CREATE INDEX IF NOT EXISTS idx_wedding_suppliers_supplier_id
  ON public.wedding_suppliers (supplier_id) WHERE supplier_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_wedding_suppliers_updated_at ON public.wedding_suppliers;
CREATE TRIGGER trg_wedding_suppliers_updated_at
  BEFORE UPDATE ON public.wedding_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.wedding_suppliers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: wedding_suppliers
-- Staff: MEMBER-CRUD
-- Couple portal: SELECT for their own wedding's supplier list (Slice 8)
-- ============================================================

DROP POLICY IF EXISTS "wedding_suppliers_select_members" ON public.wedding_suppliers;
CREATE POLICY "wedding_suppliers_select_members" ON public.wedding_suppliers
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "wedding_suppliers_insert_members" ON public.wedding_suppliers;
CREATE POLICY "wedding_suppliers_insert_members" ON public.wedding_suppliers
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "wedding_suppliers_update_members" ON public.wedding_suppliers;
CREATE POLICY "wedding_suppliers_update_members" ON public.wedding_suppliers
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "wedding_suppliers_delete_members" ON public.wedding_suppliers;
CREATE POLICY "wedding_suppliers_delete_members" ON public.wedding_suppliers
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- Couple portal: view the supplier list for their own wedding (read-only)
DROP POLICY IF EXISTS "wedding_suppliers_select_couples" ON public.wedding_suppliers;
CREATE POLICY "wedding_suppliers_select_couples" ON public.wedding_suppliers
  FOR SELECT TO authenticated
  USING (wedding_id IN (SELECT public.current_couple_wedding_ids()));

-- ============================================================
-- DEFERRED FK: timeline_events.supplier_id → wedding_suppliers(id)
-- M11 created the column as a plain uuid. Now that wedding_suppliers exists
-- we wire the FK. IF NOT EXISTS prevents re-execution on re-run.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints tc
    JOIN   information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
    WHERE  tc.constraint_type = 'FOREIGN KEY'
    AND    tc.table_schema    = 'public'
    AND    tc.table_name      = 'timeline_events'
    AND    kcu.column_name    = 'supplier_id'
  ) THEN
    ALTER TABLE public.timeline_events
      ADD CONSTRAINT fk_timeline_events_supplier_id
      FOREIGN KEY (supplier_id)
      REFERENCES public.wedding_suppliers(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- Index for the now-live FK on timeline_events
CREATE INDEX IF NOT EXISTS idx_timeline_events_supplier_id
  ON public.timeline_events (supplier_id) WHERE supplier_id IS NOT NULL;

-- ============================================================
-- TABLE: wedding_documents
-- SD-6 resolved: one table for all document types — contracts, supplier
-- compliance docs (PLI/PAT), invoice PDFs, and couple e-sign records.
-- supplier_id is a nullable FK to suppliers (venue directory entry).
-- uploaded_by is intentionally not a FK — it can hold a membership id
-- (staff upload) or a couple_accounts user_id (couple upload); the
-- application layer resolves the source from context.
-- RLS: staff MEMBER-CRUD; couple SELECT + UPDATE (to record signed_at)
--      on their own wedding's documents.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wedding_documents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id        uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  wedding_id      uuid        NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  kind            text        NULL
                    CHECK (kind IN ('contract', 'invoice-pdf', 'supplier-doc', 'other')),
  name            text        NULL,
  storage_path    text        NOT NULL,
  -- supplier_id: optional link to the venue directory entry that relates to this doc
  supplier_id     uuid        NULL REFERENCES public.suppliers(id) ON DELETE SET NULL,
  -- uploaded_by: membership.id for staff, or couple_accounts user_id for couple uploads
  uploaded_by     uuid        NULL,
  expiry_date     date        NULL,
  last_chased_at  timestamptz NULL,
  signed_at       timestamptz NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_wedding_documents_venue_id   ON public.wedding_documents (venue_id);
CREATE INDEX IF NOT EXISTS idx_wedding_documents_wedding_id ON public.wedding_documents (wedding_id);
CREATE INDEX IF NOT EXISTS idx_wedding_documents_supplier_id
  ON public.wedding_documents (supplier_id) WHERE supplier_id IS NOT NULL;
-- Document type query: e.g. "all contracts for this wedding"
CREATE INDEX IF NOT EXISTS idx_wedding_documents_kind
  ON public.wedding_documents (wedding_id, kind) WHERE kind IS NOT NULL;
-- Expiry chase: upcoming expiry across a venue
CREATE INDEX IF NOT EXISTS idx_wedding_documents_expiry
  ON public.wedding_documents (venue_id, expiry_date) WHERE expiry_date IS NOT NULL;

DROP TRIGGER IF EXISTS trg_wedding_documents_updated_at ON public.wedding_documents;
CREATE TRIGGER trg_wedding_documents_updated_at
  BEFORE UPDATE ON public.wedding_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.wedding_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: wedding_documents
-- Staff: MEMBER-CRUD
-- Couple portal: SELECT documents for their own wedding; UPDATE to record
--                signed_at (couples cannot delete or create docs — staff owns
--                the document lifecycle)
-- ============================================================

DROP POLICY IF EXISTS "wedding_documents_select_members" ON public.wedding_documents;
CREATE POLICY "wedding_documents_select_members" ON public.wedding_documents
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "wedding_documents_insert_members" ON public.wedding_documents;
CREATE POLICY "wedding_documents_insert_members" ON public.wedding_documents
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "wedding_documents_update_members" ON public.wedding_documents;
CREATE POLICY "wedding_documents_update_members" ON public.wedding_documents
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "wedding_documents_delete_members" ON public.wedding_documents;
CREATE POLICY "wedding_documents_delete_members" ON public.wedding_documents
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- Couple portal: view documents for their own wedding
DROP POLICY IF EXISTS "wedding_documents_select_couples" ON public.wedding_documents;
CREATE POLICY "wedding_documents_select_couples" ON public.wedding_documents
  FOR SELECT TO authenticated
  USING (wedding_id IN (SELECT public.current_couple_wedding_ids()));

-- Couple portal: update to record signed_at (e-sign flow)
DROP POLICY IF EXISTS "wedding_documents_update_couples" ON public.wedding_documents;
CREATE POLICY "wedding_documents_update_couples" ON public.wedding_documents
  FOR UPDATE TO authenticated
  USING (wedding_id IN (SELECT public.current_couple_wedding_ids()))
  WITH CHECK (wedding_id IN (SELECT public.current_couple_wedding_ids()));

-- ============================================================
-- Down (rollback — not run automatically, for reference)
-- ============================================================
-- ALTER TABLE public.timeline_events DROP CONSTRAINT IF EXISTS fk_timeline_events_supplier_id;
-- DROP TABLE IF EXISTS public.wedding_documents;
-- DROP TABLE IF EXISTS public.wedding_suppliers;
-- DROP TABLE IF EXISTS public.suppliers;
