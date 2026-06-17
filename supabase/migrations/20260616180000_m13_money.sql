-- Migration: m13_money
-- Date: 2026-06-16
-- Description: M13 Proposal and payment milestone data layer.
--
--   * proposals            — formal pricing proposals sent to a couple, linking
--                            contact (pre-booking) and optionally a wedding
--                            (post-booking). Status lifecycle: draft → sent →
--                            viewed → accepted | expired. MEMBER-CRUD for staff;
--                            couple-scoped SELECT (Slice 8).
--   * proposal_line_items  — individual line items on a proposal; one-to-many
--                            with proposals. Snapshot of price at creation time.
--                            MEMBER-CRUD for staff; couple-scoped SELECT (Slice 8).
--   * payment_milestones   — scheduled payment plan (deposit, balance, etc).
--                            In GHL-bundled mode mirrors GHL invoice status.
--                            Staff MEMBER-CRUD (no authenticated DELETE — use
--                            status voiding instead). Couple-scoped SELECT.
--                            ghl_invoice_id stored for Phase 3 GHL invoice sync.
--
-- SD-7 applied throughout: ALL money columns are integer minor units (*_minor int).
--   proposals.discount_value_minor, proposals.subtotal_minor, proposals.total_minor,
--   proposal_line_items.unit_minor, payment_milestones.amount_minor.
--
-- FK ordering: weddings (M8), contacts (M2), packages (M9), package_lines (M9)
--   all exist before this migration — FKs are safe. proposals.template_id refs
--   packages(id) which is M9 (earlier).
--
-- RLS helpers used:
--   public.current_venue_ids()                  — any member of the venue
--   public.current_owner_or_admin_venue_ids()   — owner or admin only
--   public.current_couple_wedding_ids()         — active couple session
--
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY/TRIGGER IF EXISTS
--             before recreate.

-- ============================================================
-- TABLE: proposals
-- A formal pricing proposal — either pre-booking (contact_id only) or
-- post-booking (also wedding_id). SD-7: all money in minor units (pence).
-- RLS pattern: MEMBER-CRUD for staff; couple-scoped SELECT (Slice 8).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.proposals (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id               uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  contact_id             uuid        NULL REFERENCES public.contacts(id) ON DELETE SET NULL,
  wedding_id             uuid        NULL REFERENCES public.weddings(id) ON DELETE SET NULL,
  ghl_opportunity_id     text        NULL,
  status                 text        NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'expired')),
  -- template_id: which package was used to start this proposal (M9, earlier)
  template_id            uuid        NULL REFERENCES public.packages(id) ON DELETE SET NULL,
  discount_type          text        NULL
                           CHECK (discount_type IN ('pct', 'fixed')),
  -- SD-7: discount_value_minor holds percentage (0-100) if type='pct', or
  -- pence if type='fixed'. Integer in both cases (whole-percent discounts).
  discount_value_minor   int         NULL CHECK (discount_value_minor >= 0),
  deposit_pct            int         NOT NULL DEFAULT 25
                           CHECK (deposit_pct BETWEEN 0 AND 100),
  vat_pct                int         NULL CHECK (vat_pct >= 0),
  -- SD-7: sum of line item totals before discount + VAT; recomputed on save
  subtotal_minor         int         NULL CHECK (subtotal_minor >= 0),
  -- SD-7: final total after discount + VAT; recomputed on save
  total_minor            int         NULL CHECK (total_minor >= 0),
  hold_until             date        NULL,
  sent_at                timestamptz NULL,
  sent_channel           text        NULL
                           CHECK (sent_channel IN ('email', 'sms', 'whatsapp')),
  viewed_at              timestamptz NULL,
  accepted_at            timestamptz NULL,
  notes                  text        NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_proposals_venue_id   ON public.proposals (venue_id);
CREATE INDEX IF NOT EXISTS idx_proposals_contact_id
  ON public.proposals (contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_wedding_id
  ON public.proposals (wedding_id) WHERE wedding_id IS NOT NULL;
-- Pipeline status list: all proposals at a given status for a venue
CREATE INDEX IF NOT EXISTS idx_proposals_status
  ON public.proposals (venue_id, status);
-- GHL opportunity lookup (Phase 3 invoice sync)
CREATE INDEX IF NOT EXISTS idx_proposals_ghl_opportunity_id
  ON public.proposals (ghl_opportunity_id) WHERE ghl_opportunity_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_proposals_updated_at ON public.proposals;
CREATE TRIGGER trg_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: proposals
-- Staff: MEMBER-CRUD
-- Couple portal: SELECT for their own wedding's proposals (Slice 8)
-- ============================================================

DROP POLICY IF EXISTS "proposals_select_members" ON public.proposals;
CREATE POLICY "proposals_select_members" ON public.proposals
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "proposals_insert_members" ON public.proposals;
CREATE POLICY "proposals_insert_members" ON public.proposals
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "proposals_update_members" ON public.proposals;
CREATE POLICY "proposals_update_members" ON public.proposals
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "proposals_delete_members" ON public.proposals;
CREATE POLICY "proposals_delete_members" ON public.proposals
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- Couple portal: view proposals for their own wedding
DROP POLICY IF EXISTS "proposals_select_couples" ON public.proposals;
CREATE POLICY "proposals_select_couples" ON public.proposals
  FOR SELECT TO authenticated
  USING (wedding_id IN (SELECT public.current_couple_wedding_ids()));

-- ============================================================
-- TABLE: proposal_line_items
-- Individual line items on a proposal. Prices are snapshotted at creation
-- time from the package library (not live-linked). SD-7: unit_minor.
-- RLS pattern: MEMBER-CRUD for staff; couple-scoped SELECT (Slice 8).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.proposal_line_items (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id          uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  proposal_id       uuid        NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  -- package_line_id: source library item if pre-populated from a package
  package_line_id   uuid        NULL REFERENCES public.package_lines(id) ON DELETE SET NULL,
  label             text        NOT NULL,
  qty               int         NOT NULL DEFAULT 1 CHECK (qty > 0),
  -- SD-7: price per unit in minor units (pence), snapshot at creation time
  unit_minor        int         NOT NULL CHECK (unit_minor >= 0),
  unit_type         text        NOT NULL DEFAULT 'flat'
                      CHECK (unit_type IN ('flat', 'per_head', 'per_evening')),
  qty_tied_to_guests boolean    NOT NULL DEFAULT false,
  category          text        NOT NULL DEFAULT 'package'
                      CHECK (category IN ('package', 'addon')),
  discount_pct      int         NULL CHECK (discount_pct BETWEEN 0 AND 100),
  sort_order        int         NOT NULL DEFAULT 1000,
  created_at        timestamptz NOT NULL DEFAULT now()
  -- No updated_at: line items are deleted + re-inserted on proposal edit,
  -- not updated in place (matches the proposal builder UX pattern).
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_proposal_line_items_venue_id
  ON public.proposal_line_items (venue_id);
CREATE INDEX IF NOT EXISTS idx_proposal_line_items_proposal_id
  ON public.proposal_line_items (proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_line_items_package_line_id
  ON public.proposal_line_items (package_line_id) WHERE package_line_id IS NOT NULL;

-- No updated_at trigger (column intentionally omitted — see above).

ALTER TABLE public.proposal_line_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: proposal_line_items
-- Staff: MEMBER-CRUD
-- Couple portal: SELECT (line items are read alongside their parent proposal)
-- ============================================================

DROP POLICY IF EXISTS "proposal_line_items_select_members" ON public.proposal_line_items;
CREATE POLICY "proposal_line_items_select_members" ON public.proposal_line_items
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "proposal_line_items_insert_members" ON public.proposal_line_items;
CREATE POLICY "proposal_line_items_insert_members" ON public.proposal_line_items
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "proposal_line_items_update_members" ON public.proposal_line_items;
CREATE POLICY "proposal_line_items_update_members" ON public.proposal_line_items
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "proposal_line_items_delete_members" ON public.proposal_line_items;
CREATE POLICY "proposal_line_items_delete_members" ON public.proposal_line_items
  FOR DELETE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

-- Couple portal: view line items for proposals on their own wedding.
-- Join through proposals: line items are accessible when the parent proposal
-- belongs to the couple's wedding.
DROP POLICY IF EXISTS "proposal_line_items_select_couples" ON public.proposal_line_items;
CREATE POLICY "proposal_line_items_select_couples" ON public.proposal_line_items
  FOR SELECT TO authenticated
  USING (
    proposal_id IN (
      SELECT id FROM public.proposals
      WHERE wedding_id IN (SELECT public.current_couple_wedding_ids())
    )
  );

-- ============================================================
-- TABLE: payment_milestones
-- Scheduled payment plan for a wedding. In GHL-bundled mode, ghl_invoice_id
-- is set and status is synced by Inngest. In standalone mode, staff manage
-- status manually. SD-7: amount_minor.
-- RLS: MEMBER-CRUD for staff (no authenticated DELETE — void via status change);
--      couple-scoped SELECT.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_milestones (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id            uuid        NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  wedding_id          uuid        NOT NULL REFERENCES public.weddings(id) ON DELETE CASCADE,
  proposal_id         uuid        NULL REFERENCES public.proposals(id) ON DELETE SET NULL,
  ghl_invoice_id      text        NULL,
  label               text        NOT NULL,
  -- SD-7: amount in minor units (pence)
  amount_minor        int         NOT NULL CHECK (amount_minor >= 0),
  due_date            date        NOT NULL,
  status              text        NOT NULL DEFAULT 'upcoming'
                        CHECK (status IN ('paid', 'due', 'upcoming', 'overdue')),
  paid_on             date        NULL,
  reminder_sent       boolean     NOT NULL DEFAULT false,
  reminder_sent_at    timestamptz NULL,
  receipt_url         text        NULL,
  sort_order          int         NOT NULL DEFAULT 1000,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- FK backing indexes
CREATE INDEX IF NOT EXISTS idx_payment_milestones_venue_id   ON public.payment_milestones (venue_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_wedding_id ON public.payment_milestones (wedding_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_proposal_id
  ON public.payment_milestones (proposal_id) WHERE proposal_id IS NOT NULL;
-- Payment health report: upcoming + overdue milestones across a venue
CREATE INDEX IF NOT EXISTS idx_payment_milestones_venue_due
  ON public.payment_milestones (venue_id, due_date)
  WHERE status IN ('due', 'upcoming', 'overdue');
-- GHL invoice lookup without join (Phase 3 sync)
CREATE INDEX IF NOT EXISTS idx_payment_milestones_ghl_invoice
  ON public.payment_milestones (ghl_invoice_id) WHERE ghl_invoice_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_payment_milestones_updated_at ON public.payment_milestones;
CREATE TRIGGER trg_payment_milestones_updated_at
  BEFORE UPDATE ON public.payment_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payment_milestones ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: payment_milestones
-- Staff: MEMBER-CRUD without DELETE (milestones are voided via status change,
--        never hard-deleted, to preserve payment history and audit trail).
-- Couple portal: SELECT for their own wedding's payment schedule (Slice 8).
-- ============================================================

DROP POLICY IF EXISTS "payment_milestones_select_members" ON public.payment_milestones;
CREATE POLICY "payment_milestones_select_members" ON public.payment_milestones
  FOR SELECT TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "payment_milestones_insert_members" ON public.payment_milestones;
CREATE POLICY "payment_milestones_insert_members" ON public.payment_milestones
  FOR INSERT TO authenticated
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

DROP POLICY IF EXISTS "payment_milestones_update_members" ON public.payment_milestones;
CREATE POLICY "payment_milestones_update_members" ON public.payment_milestones
  FOR UPDATE TO authenticated
  USING (venue_id IN (SELECT public.current_venue_ids()))
  WITH CHECK (venue_id IN (SELECT public.current_venue_ids()));

-- No DELETE policy for authenticated staff: hard deletion is blocked.
-- Milestones are voided by setting status appropriately. Service role can
-- hard-delete only if needed (e.g. cascade from wedding deletion).

-- Couple portal: view payment schedule for their own wedding
DROP POLICY IF EXISTS "payment_milestones_select_couples" ON public.payment_milestones;
CREATE POLICY "payment_milestones_select_couples" ON public.payment_milestones
  FOR SELECT TO authenticated
  USING (wedding_id IN (SELECT public.current_couple_wedding_ids()));

-- ============================================================
-- Down (rollback — not run automatically, for reference)
-- ============================================================
-- DROP TABLE IF EXISTS public.payment_milestones;
-- DROP TABLE IF EXISTS public.proposal_line_items;
-- DROP TABLE IF EXISTS public.proposals;
