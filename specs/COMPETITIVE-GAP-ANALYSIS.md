# Competitive Gap Analysis — VenueFlow v2 vs the wedding-venue software field

> **Status:** living analysis · generated 2026-06-26 from a multi-agent research workflow (9 product
> inventories + a code-grounded VF2 audit → consolidated coverage matrix → synthesis). **VF2 status is
> grounded in source file paths, trusted over docs.** Visual version: [`../reports/competitive-gap-analysis.html`](../reports/competitive-gap-analysis.html).
>
> Compared against: Sonas, Perfect Venue, Tripleseat, Planning Pod, HoneyBook, Dubsado, Aisle Planner,
> EventTemple, Prismm. Authority: where this disagrees with older docs, the **code** wins — but read the
> two corrections below first.

> **🏗️ Architecture (how to read this):** VenueFlow is an UPPER LAYER on top of GoHighLevel — GHL's API is the backend for CRM, communications, and pipeline. All wedding-planning data, INCLUDING contacts, lives in VenueFlow's own Supabase DB (each contact is a first-class VF2 record linked to its GHL contact). So native comms / SMS / WhatsApp / nurture / marketing and SaaS billing are intentionally NOT VF2's job; where the matrix marks them missing or cut, that is the architecture by design, not a gap to close.

> **⚠️ Correction (2026-06-26):** VenueFlow will NOT use Stripe or Resend (confirmed 2026-06-26). Email moves to Gmail 2-way sync; SaaS billing is handled outside VF2. The research below is code-grounded and mentions Stripe (venue billing) and Resend (email rail) as built — treat those as LEGACY CODE BEING RETIRED, not strengths, and do not build new features on them.

## Executive summary

VF2 is far past MVP: it ships a complete post-booking wedding workspace (run-sheet, 2D floor-plan + drag-drop seating, guest/RSVP/dietary, menu, suppliers, payments-as-milestones), a magic-link couple portal with self-service editing, a proposal builder with discounts/VAT, a rule-based AI copilot no competitor has, and a genuinely deep GHL pre-sales integration (~2,700 lines, OAuth, AES-256-GCM tokens, bidirectional contact sync, opportunity-won → wedding webhook). Its Postgres-RLS multi-tenant spine and guided onboarding wizard are real architectural advantages over Sonas/Tripleseat's "fiddly setup" reputation. Two things I verified change the strategic picture versus the matrix and the stored memory: (1) Stripe IS built — for VENUE subscription billing (checkout + customer portal + signature-verified, idempotent webhook + a working trialing/active/expired read-only gate in tenant.ts), so the "no Stripe / gate needs changing" memory is stale; (2) Resend IS the live email rail and already powers the lead auto-responder, a cron-driven native sequence runner, and a daily brief — so several email capabilities the matrix marks "cut to GHL" are actually native-capable today. The real, honest gaps cluster in contracts-to-cash: sendProposal is a verified 3-line no-op (couple never notified), contract e-sign is a toast placeholder with no provider, and there is no accounting/Xero sync. Secondary gaps are CRM/ops hygiene (CSV import unwired, no two-way calendar sync, couple cannot message staff back) and reporting depth (no forecasting, no custom report builder, no cross-venue roll-up). The through-line: the data models are almost all there and best-in-class in breadth — the gaps are delivery/notification edges and a few integrations, most of which are cheap to close because the email and payment rails already exist.

[CORRECTION 2026-06-26 — VenueFlow will NOT use Stripe or Resend (confirmed 2026-06-26). Email moves to Gmail 2-way sync; SaaS billing is handled outside VF2. The research below is code-grounded and mentions Stripe (venue billing) and Resend (email rail) as built — treat those as LEGACY CODE BEING RETIRED, not strengths, and do not build new features on them.]

**Scoreboard (125 capabilities mapped):** 52 built · 23 partial/stub · 36 missing · 1 planned · 13 cut by design.

## Where VenueFlow already wins

- Complete post-booking wedding workspace in one product: run-sheet (reorder, supplier assignment, event-day check-in), 2D floor-plan editor + drag-drop guest-to-seat, guest/RSVP/dietary/meal-choice, menu library + per-wedding selection, suppliers + document hub, payment milestones. Breadth matches or exceeds every single competitor; only Sonas is comparably wide.
- Magic-link couple portal with real two-way self-service (couples edit guests, RSVPs, +1s, per-course meal choices with live chosen-by lists, see timeline/seating/payment-progress/docs) — EventTemple and Prismm have no couple portal at all.
- Rule-based AI copilot (at-risk weddings, overdue payments, quiet leads, upcoming run-sheets) — a triage layer NO competitor in this set has, including Sonas which has zero AI. A concrete differentiator even though it is rules, not an LLM.
- Deepest pre-sales integration in the field: the entire CRM/comms layer is GHL via ~2,700 lines (OAuth 2.0, AES-256-GCM encrypted tokens, bidirectional contact sync, opportunity-won webhook → auto-create wedding, GHL invoice status enrichment). This is an architectural moat, not an add-on connector.
- Postgres RLS tenant isolation (venue_id scoping on every table, security_invoker report views) + agency-owner tier seeing all venues — a security/architecture strength competitors don't expose.
- Guided onboarding wizard (venue → space → hours with seeding) and full venue brand/profile/package/menu/custom-field configuration — directly counters the 'setup is fiddly' complaints leveled at Sonas and Tripleseat.
- Strong reporting baseline already shipped: KPI cards (conversion, booked revenue YTD, on-time payments, portal adoption, AOV), leads-by-stage funnel + source pie, payment-health, and a live GHL pipeline-value aggregate that degrades gracefully when disconnected.

## Biggest gaps (ranked)

| Gap | VF2 | Severity | Who has it | Recommendation |
|---|---|---|---|---|
| **Proposal delivery (send to couple)** | partial | high | all 8 CRM competitors (sonas, perfectVenue, tripleseat, planningPod, honeybook, dubsado, aislePlanner, eventTemple) | sendProposal is a verified 3-line DB status='sent' no-op — the couple is never notified. The fix is cheap and not blocked: the Resend rail (src/lib/email/send.ts) already sends lead auto-responders and sequence emails. Wire sendProposal to render a proposal email (portal/PDF link) through sendEmail, set sent_at, and add a viewed_at timestamp on portal open. This is the single highest-leverage gap to close: low effort, closes a 'send is fake' credibility hole that any demo will expose. |
| **Contract e-signature** | partial | high | 7 competitors (all but sonas — perfectVenue, tripleseat, planningPod, honeybook, dubsado, aislePlanner, eventTemple) | Portal 'sign contract' is a toast placeholder ('opens your e-signature document') with no provider in src/. Either integrate a real e-sign provider (Dropbox Sign / SignWell are cheapest to embed) OR ship a lightweight native typed/drawn-signature-on-PDF stored to wedding_documents with a signed_at + IP/audit row. Note for sales: Sonas also lacks true e-sign, so a native magic-link sign-in-portal flow leapfrogs Sonas while matching the rest of the field. This is the second-highest priority in contracts-to-cash. |
| **Accounting sync (Xero / QuickBooks / Sage)** | missing | medium | sonas (Xero/Sage), perfectVenue, planningPod, dubsado (QBO/Xero), eventTemple | No Xero/QBO/Sage client exists (verified). Real gap for finance-conscious venues, but heavier than the two above and partially mitigated because GHL invoices carry the payment rail. Recommend deferring to Later; when built, a Xero one-way invoice/payment push (not full two-way reconciliation) covers 80% of the demand. Frame in sales as 'on the roadmap; GHL invoicing handles collection today.' |
| **Two-way calendar sync (Google/Outlook/iCal)** | missing | high | sonas, perfectVenue, tripleseat, planningPod, honeybook, dubsado, aislePlanner | Near-universal among competitors; VF2 stores appointments natively only. Start with one-way iCal feed export of appointments (cheap, covers 'see it in my Google Calendar') then layer Google two-way via the same Google OAuth that the planned Gmail sync needs. High severity because 'does it sync to my calendar' is a near-default buyer question. |
| **CSV contact import** | partial | low | planningPod, aislePlanner | Export is wired (toCsv/csvCell on the contacts list) but there is NO parser/import — verified only toCsv is exported. Cheap win: add a CSV parse + upsert-contact mapping reusing the existing upsert-contact.ts GHL field mapping. Low competitor coverage but it's a frequent onboarding ask ('import my existing leads') and unblocks switching venues off a competitor. |
| **Couple → staff two-way messaging** | partial | high | sonas, tripleseat, planningPod, honeybook, dubsado | The portal 'Contact venue' tab is a footer placeholder — couples cannot DM staff; staff only see mirrored GHL conversations. 5 competitors have in-portal couple↔staff chat. Lowest-effort path: route couple portal messages into the existing GHL conversation thread for that contact (the mirror already exists one-way) so staff reply in GHL and it appears in-portal. Closes a visible portal hole without building a new messaging stack. |
| **Banquet Event Order (BEO) generation** | missing | medium | sonas, perfectVenue, tripleseat, planningPod, aislePlanner, eventTemple | No consolidated BEO export, though all the source data (menu, guests, dietary, run-sheet, floor plan) already exists. This is a doc-assembly task, not new data modeling — generate a single printable/PDF BEO from existing wedding relations. Medium severity: it's table-stakes for venue ops handoff to kitchen/staff and a common RFP checkbox. |
| **Reporting depth (forecasting, custom report builder, cross-venue roll-up)** | missing | medium | tripleseat (Insights, 25+ reports, forecasting), perfectVenue, eventTemple, planningPod | VF2 reports are solid current-state KPIs but have no pace/forecast/YoY, no user-defined report builder, and no agency roll-up despite the agency-owner RLS tier existing. Prioritize a cross-venue roll-up first (foundations already present via RLS union — highest value for the agency-owner buyer), then simple pace/forecast off booked-revenue trend. Defer a full custom report builder. |
| **Multi-stakeholder contacts per event** | missing | medium | tripleseat, aislePlanner, planningPod | weddings.contact_id is 1:1 — no roster for partner/family/planner/vendors on a wedding. Medium severity for the wedding vertical (a couple is two people + often a planner). Add a wedding_contacts join with role, reusing the contacts table; modest schema change with real day-to-day value. |
| **Provisional date holds** | missing | medium | sonas, perfectVenue, tripleseat, planningPod | No hold-with-expiry concept; only confirmed appointments. A standard pre-sales lock for venues juggling enquiries on the same date. Add a tentative-hold status with an expiry on the availability/appointment model. Medium effort, clearly expected by venue sales teams. |

## Modern edge — how to beat the field, not just match it

- Magic-link contracts-to-cash in one couple flow: VF2 already has the portal, proposal builder, milestones, the Resend email rail, AND verified venue Stripe plumbing. Chaining propose → e-sign (native magic-link signature) → deposit-pay into a single passwordless couple journey would BEAT the field, where these are typically 2-3 disjointed tools. This is VF2's sharpest wedge.
- Lean into the AI copilot as a comms-action layer, not just triage: it already detects at-risk/overdue/quiet — add one-click AI-drafted replies/nudges (Perfect Venue's 'AI Reply' and HoneyBook's AI builder are the only comparables, and neither pairs it with this depth of wedding data). 'AI tells you who's slipping AND drafts the message' beats both.
- Lead scoring on top of the existing quiet-lead rule: convert the binary quiet-lead flag into a 0-100 score (recency, budget, source, stage velocity) surfaced in the contacts list. No competitor in this set scores leads; it's a credible 'we're the smart one' headline.
- Native magic-link e-signature beats Sonas (which lacks e-sign) and differentiates from the DocuSign-bolt-on crowd: couples sign inside the portal they already use, no second login, audit row stored in wedding_documents. Sell as 'sign in the same place you plan.'
- Mobile event-day mode: the run-sheet, supplier check-in board, and live timeline-status toggle already work on mobile web. Polish them into a dedicated event-day view (large tap targets, offline-tolerant, 'mark done') — Tripleseat/Planning Pod gesture at this; a purpose-built wedding-day cockpit on mobile web (no app-store friction) is a winnable edge over the no-native-app competitors (Sonas, Planning Pod, Aisle Planner).
- Chef/kitchen overview from data VF2 already holds: guests × menu choice × dietary/allergen in one printable kitchen sheet. Sonas's chef overview is a noted standout; VF2 has all the data and merely lacks the view — a cheap way to match a best-in-class Sonas feature.
- Cross-venue agency roll-up reporting: the agency-owner RLS union already exists; a single aggregated dashboard across all owned venues is a feature Tripleseat/EventTemple charge enterprise money for, and VF2's tenancy model makes it nearly free to build — a strong differentiator for the agency-owner ICP.

## Roadmap

### Now / quick wins (days, not weeks)

- Make sendProposal real: render + send a proposal email via the existing src/lib/email/send.ts Resend rail, set sent_at, add viewed_at on portal open (closes the verified 3-line no-op).
- Wire CSV import: add a parser to contacts/csv.ts (currently export-only) and reuse upsert-contact.ts field mapping for the upsert.
- Retire the legacy Stripe (billing) and Resend (email) code — VenueFlow will not use them. Email moves to Gmail 2-way sync; SaaS billing is handled outside VF2. Re-scope any item that assumed those rails.
- Add proposal/contract status enrichment: surface viewed/opened on the existing draft/sent fields now that delivery exists.

_These are low-effort, high-credibility fixes that sit on rails already in the codebase (Resend, Stripe, upsert-contact). They close the most demo-exposing holes (a 'Send' button that doesn't send, no import) and stop the team from rebuilding things that already exist._

### Next (this quarter)

- Native magic-link contract e-sign in the portal (typed/drawn signature → wedding_documents + signed_at/audit) — replaces the toast placeholder and leapfrogs Sonas.
- Couple → staff messaging by routing portal messages into the existing GHL conversation thread (one-way mirror already exists) so staff reply in GHL and it appears in-portal.
- One-way iCal feed export of appointments as the first calendar-sync step; scope Google two-way to ride the planned Gmail OAuth.
- BEO generator: assemble a printable/PDF BEO from existing menu/guests/dietary/run-sheet/floor-plan data.
- AI copilot → one-click AI-drafted replies for at-risk/quiet leads, sent via the Resend rail.

_These convert existing data and rails into the contracts-to-cash and ops completeness that buyers compare directly against the field, while each reuses infrastructure already present (portal, GHL conversations, Resend, wedding relations) to keep effort contained._

### Later (strategic, heavier lift)

- Accounting integration: one-way Xero/QBO invoice + payment push (defer full two-way reconciliation).
- Google/Outlook two-way calendar sync (full bidirectional, on the Gmail-sync OAuth).
- Couple deposit payment in-portal via a couple-facing Stripe checkout (the venue-side Stripe plumbing is a template; couple flow is currently a toast stub — only build if the 'cut to GHL' decision is revisited).
- Cross-venue agency roll-up reporting on the existing RLS union + lightweight pace/forecast off booked-revenue trend.
- Multi-stakeholder wedding_contacts roster (partner/family/planner) and provisional date-holds with expiry.
- Lead scoring (0-100) layered on the existing quiet-lead rule.
- 3D floor-plan / native mobile app — only if moving up-market to high-end venues warrants it; both are large and have viable web/2D substitutes today.

_Higher-effort or lower-frequency items, or ones that touch deliberate cut decisions (couple Stripe). Each is a real competitive gap but none blocks core sales; sequence by ICP value — agency roll-up and accounting first for the agency-owner and finance buyers respectively._

## Deliberately cut — do not build (frame in sales)

- Couple online card payments (Stripe/Square) in-portal — deliberately cut; couples pay via GHL invoice links. Frame in sales as: 'Payments are collected through your GHL invoicing, so you keep one billing rail and one reconciliation point — VenueFlow tracks status, milestones, and payment health on top.' (Note: venue-side Stripe for VF2 subscription billing IS built — don't conflate the two.)
- Automated payment reminders, marketing email sequences, SMS, Mailchimp export, supplier bulk comms — delegated to GHL. Frame as: 'Your nurture, reminders, and broadcasts run in GHL where your whole marketing engine already lives; VenueFlow configures and triggers them rather than creating a second siloed comms tool.' (Caveat: a native Resend sequence runner DOES exist for transactional/auto-responder email — so 'we have native comms too' is fair to say.)
- Customizable event statuses / workflow stages — intentionally a fixed spine. Frame as: 'The wedding workflow is opinionated and proven so every venue and every couple gets a consistent, no-setup-required process; you customize content and brand, not the plumbing.' This is the anti-GHL moat — say it as a strength.
- Kitchen stock / provisioning / catering-ERP — out of scope. Frame as: 'VenueFlow is a wedding-venue workspace, not a catering ERP; we give your chef the menu/guest/allergen overview they need without forcing inventory software on you.'
- Multi-event-type (non-wedding) abstraction, PMS connectors, guest QR check-in/ticketing, public API/Zapier — out of scope for the wedding-venue ICP. Frame as: 'Purpose-built for wedding venues, not a generic events platform — that focus is why the workflow needs zero configuration.' Mention GHL as the automation/integration hub when a Zapier-style ask comes up.

## Full coverage matrix

Legend: ● = competitor has it · · = doesn't. Columns: **Son** Sonas · **PV** Perfect Venue · **Tri** Tripleseat · **PPod** Planning Pod · **HB** HoneyBook · **Dub** Dubsado · **AP** Aisle Planner · **ET** EventTemple · **Pri** Prismm.

### CRM / Enquiries

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| Centralized inbox / lead capture inbox for all inquiries | ● ● ● ● ● ● ● ● · | **partial** | medium | /src/app/(app)/contacts/page.tsx — contact list with RLS-scoped queries; no unified inbox (comms delegated to GHL) — VF2 has a contacts list but no native unified messaging inbox; live conversations mirror from GHL only. |
| Embeddable web inquiry / lead capture forms on venue website | ● ● ● ● ● ● ● ● · | **built** | low | /src/app/(public)/f/[venueSlug]/page.tsx + actions.ts — public enquiry form; embed code generation in /settings/forms |
| Lead status / pipeline stage management (enquiry → booked) | ● ● ● ● ● ● ● ● · | **partial** | low | /src/app/(app)/pipeline/page.tsx — native 5-stage Kanban for standalone venues only; bundled venues redirect to /weddings (live pipeline owned by GHL) — Live pipeline is GHL's job in bundled mode; VF2 status derived from wedding join. |
| Lead source tracking & attribution reporting | ● ● ● ● ● ● ● ● · | **built** | low | /src/app/(app)/reports/page.tsx — Leads by source pie chart; contact source filtering in contacts list |
| Automated lead auto-responder / inquiry confirmation email | ● ● ● ● ● ● ● ● · | **cut** | low | delegated to GHL — native comms/nurture sequences run in GHL (settings/sequences configures GHL) — Auto-responders are GHL's domain in VF2's architecture. |
| Inactive / stalled lead alerts to prevent lead loss | ● · ● · · · · ● · | **built** | low | /src/lib/copilot/insights.ts — quiet-lead detection (couple invited >7 days ago, never logged in) |
| Conversion analytics (enquiry→viewing, viewing→booking) | ● ● ● ● · · · ● · | **built** | low | /src/app/(app)/reports/page.tsx — stage conversion rates table (enquiry → responded → viewing → appointment → booked) |
| Multi-contact per event (couple, family, planner, vendors) | · · ● ● · · ● · · | **missing** | medium | weddings link single contact_id; no multi-stakeholder contact roster per wedding — VF2 weddings.contact_id is 1:1; no secondary stakeholders on a wedding. |
| Lead tagging / filtering by event type, budget, season | · ● ● ● ● ● ● · · | **partial** | low | /src/app/(app)/contacts/page.tsx — source/status filtering; custom fields supported; no rich budget/season tag faceting |

### Calendar & Availability

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| Centralized color-coded event/booking calendar | ● ● ● ● · · ● · · | **partial** | medium | /src/app/(app)/appointments/page.tsx — weekly appointment calendar (booked/attended/no_show/cancelled); appointment-centric, not a full booking calendar — VF2 calendar is appointment-focused (viewings/calls), not a full multi-space event-availability board. |
| External calendar sync (Google / Outlook / iCal) | ● ● ● ● ● ● ● · · | **missing** | high | no Google/Outlook/iCal sync in codebase; appointments stored natively only — Two-way calendar sync is near-universal among competitors; VF2 has none. Per memory, email=Google sync planned but calendar sync not built. |
| Double-booking prevention / conflict alerts | ● ● ● ● · · · · · | **partial** | medium | /src/app/(public)/book/actions.ts — slot generation from venue_hours + meeting_type durations/buffers prevents overlap on booking widget |
| Provisional date holds / tentative reservations before confirmation | ● ● ● ● · · · · · | **missing** | medium | no provisional date-hold mechanism; only confirmed appointments — Date holds are a standard pre-sales lock; VF2 lacks a hold-with-expiry concept. |
| Multi-venue / multi-space availability management | ● ● ● ● · · ● ● · | **partial** | medium | /src/app/(app)/settings/spaces/page.tsx — spaces with capacity + availability block-out dates (settings/availability) |
| Public self-service booking widget (book a viewing/call online) | · ● ● · ● ● ● · · | **built** | low | /src/app/(public)/book/[venueSlug]/[meetingType]/page.tsx — calendar picker + form submit; slot generation in book/actions.ts |
| Block-out / availability calendar for venue closures | ● · · ● · · · ● · | **built** | low | /src/app/(app)/settings/availability — block-out dates for functions |

### Bookings Lifecycle

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| Event creation & lifecycle management (inquiry→confirmed→completed) | ● ● ● ● ● ● ● ● · | **built** | low | /src/app/(app)/weddings/[id]/page.tsx — wedding record is core post-booking entity; created via GHL opportunity-won webhook (/src/lib/ghl/webhooks.ts) |
| Customizable event statuses / workflow stages | ● ● ● ● · · ● ● · | **partial** | medium | weddings carry status (planning, etc.); statuses are fixed spine, not venue-customizable per memory (configurability = content not workflow) — Deliberate: VF2 fixes the workflow spine; venues configure content/identity not stages. |
| Event detail capture (date, headcount, budget, areas, type) | ● ● ● ● ● ● ● ● · | **built** | low | /src/app/(public)/f/[venueSlug]/actions.ts — captures names, date, guest count, budget; wedding detail editable |
| Multi-event-type support (non-wedding events on same workflow) | ● ● ● ● ● ● ● ● · | **missing** | low | product is wedding-specific (weddings table); no generic event-type abstraction — VF2 is intentionally wedding-venue focused. |
| Booking status automation driven by payment activity | · ● · ● · · · · · | **partial** | low | /src/app/(app)/weddings/[id]/payments/actions.ts — milestone status enriched from GHL invoice status; no auto-transition of wedding status |
| Express/Direct self-service end-to-end booking with deposit | · ● ● · · · · · · | **missing** | low | booking widget creates appointment only; no self-serve confirm+pay-deposit flow — Couple payment is a stub; cut to GHL. |

### Proposals / Contracts / E-sign

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| Proposal builder with line items, discounts, pricing | ● ● ● ● ● ● ● ● · | **built** | low | /src/app/(app)/money/proposals/[id]/build/actions.ts saveProposalDraft (180–276); /src/lib/money/proposal.ts computeProposalTotals (53–112) — line-item CRUD, per-item + proposal-level discount, VAT |
| Send proposal to client (email delivery / notification) | ● ● ● ● ● ● ● ● · | **partial** | high | /src/app/(app)/money/proposals/[id]/build/actions.ts:286–313 sendProposal — DB status='sent' update only, no email send (verified: 3-line update) — Send is a no-op beyond status flag; couple is not notified. Most competitors deliver+track. Likely intended via GHL. |
| Banquet Event Order (BEO) generation | ● ● ● ● · · ● ● · | **missing** | medium | no BEO document generator; run-sheet + menu + guests exist as separate views but no consolidated BEO export — Data to build a BEO exists (menu/guests/runsheet) but no BEO doc artifact. |
| Customizable contract templates | · ● ● ● ● ● ● ● · | **missing** | medium | documents table stores contract files (kind='contract') but no template builder |
| Digital e-signature on contracts | · ● ● ● ● ● ● ● · | **partial** | high | /src/app/(portal)/portal/portal-client.tsx:1010 — contract sign is a toast placeholder ('opens your e-signature document'); contract status field exists; no DocuSign/HelloSign integration (verified: no e-sign provider in src/) — Sonas also lacks true e-sign, but 7 competitors have it. VF2 button is non-functional. |
| Contract/proposal status tracking (sent, viewed, signed) | · ● ● ● ● ● ● · · | **partial** | medium | proposal status (draft/sent) + document status (pending/signed) fields exist; no viewed/opened tracking |
| Document storage / hub per event | ● ● ● ● ● ● ● ● · | **built** | low | /src/app/(app)/weddings/[id]/suppliers/actions.ts upsertDocument — wedding_documents (kind: contract/insurance/invoice/supplier/other, storage_path, status) |

### Payments / Invoicing / Accounting

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| Invoice generation & delivery | ● ● ● ● ● ● ● ● · | **built** | low | /src/app/(app)/weddings/[id]/payments/actions.ts upsertMilestone — milestone sent as GHL invoice; GHL handles delivery (/src/lib/ghl/invoices) |
| Payment milestones / installment schedules with deposit calc | ● ● ● ● ● ● ● ● · | **built** | low | /src/app/(app)/weddings/[id]/payments/actions.ts — milestone CRUD with due_date + status (upcoming/due/paid/overdue); milestoneStatus in /src/lib/money/proposal.ts:165–210 |
| Online card payment processing for couples (Stripe/Square) | ● ● ● ● ● ● ● ● · | **cut** | low | /src/app/(portal)/portal/portal-client.tsx:941,1734 — couple payment is a toast stub ('opens your secure payment page'); no Stripe in src/ (verified). Couples pay via GHL invoices. — Deliberately cut — couple Stripe dropped; payment collection delegated to GHL invoices. |
| Automated payment reminders | ● ● ● ● ● ● ● ● · | **cut** | low | no scheduled reminder logic in src/; reminders delegated to GHL — Automated reminders are GHL's job; VF2 has no native scheduler beyond Vercel Cron. |
| Payment status tracking / progress visibility | ● ● ● ● ● ● ● · · | **built** | low | /src/app/(portal)/portal/(authed)/page.tsx — couple portal payment progress bar + milestone breakdown; reports payment health section |
| Accounting sync (Xero / QuickBooks / Sage) | ● ● · ● · ● · ● · | **missing** | medium | no Xero/QuickBooks client in src/ (verified: no xero match) — Sonas (Xero/Sage), Planning Pod & Dubsado (QBO/Xero) have it; VF2 has none. |
| Refund processing | · ● ● ● · · · · · | **cut** | low | no native payment rail; refunds handled in GHL/Stripe upstream |
| Gratuity / service-charge / security-deposit handling | ● · · · · · · · · | **missing** | low | no gratuity or escrow accounting in proposal/milestone model |

### Run-sheet / Timeline

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| Customizable event timeline / run-sheet with items | ● ● ● ● ● · ● ● · | **built** | low | /src/app/(app)/weddings/[id]/runsheet/actions.ts addEvent/updateEvent — title, time, duration_min, category, owner, notes, supplier link |
| Timeline item ordering / reordering (chronological) | ● · ● ● · · ● · · | **built** | low | /src/app/(app)/weddings/[id]/runsheet/actions.ts reorderEvent — sort_order for chronological display |
| Vendor/staff assignment per timeline item | ● · ● ● · · ● · · | **built** | low | /src/app/(app)/weddings/[id]/runsheet — event.owner + event.supplier_id FK links suppliers to items |
| Timeline sharing / PDF download to vendors & couple | ● · · ● · · ● · · | **partial** | low | /src/app/(portal)/portal/(authed)/page.tsx — couple sees read-only run-sheet; no PDF export of timeline |
| Auto-update timeline when supplier details change | ● · · · · · · · · | **missing** | low | supplier link is static FK; no auto-propagation of supplier changes into timeline notes |
| Automated timeline reminders to vendors/staff during event | · · · ● · · · · · | **cut** | low | no scheduled reminder logic; comms delegated to GHL |

### Floor plan / Seating

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| 2D floor plan editor (drag-and-drop, to-scale) | ● · ● ● · · ● · ● | **built** | low | /src/app/(app)/settings/spaces/[id]/floor/page.tsx — floor template editor; /src/app/(app)/weddings/[id]/floorplan/floorplan-client.tsx — interactive canvas; /src/lib/floorplan/types.ts |
| Drag-and-drop guest-to-table/seat assignment | ● · ● ● · · ● · ● | **built** | low | /src/app/(app)/weddings/[id]/floorplan/actions.ts upsertGuestSeat — guest drag-drop with optimistic updates; seated count tracking |
| 3D / photorealistic floor plan visualization | ● · ● · · · · · ● | **missing** | medium | floorplan/types.ts is 2D layout (Table, RoomElement); no 3D rendering — Sonas/Tripleseat/Prismm offer 3D; VF2 is 2D only. Differentiator for high-end venues. |
| Multiple layout variations per event (ceremony/reception) | ● · ● ● · · ● · ● | **partial** | low | /src/app/(app)/weddings/[id]/floorplan — per-wedding seeded from space template; one active layout per wedding |
| Client/couple access to view/edit seating | ● · ● ● · · ● · · | **built** | low | /src/app/(portal)/portal/portal-client.tsx — seating tab in couple portal; floor plan data loaded RLS-scoped |
| Floor plan locked until space has a template (gating) | · · · · · · · · · | **built** | low | /src/app/(app)/weddings/[id]/floorplan/page.tsx:112–145 — gating until space has floor template — VF2-specific UX guard; not a competitor capability. |
| Pre-built furniture/decor object library | · · ● ● · · ● · ● | **partial** | low | RoomElement supports walls/bars/stages from template; limited object library vs Prismm's thousands |
| Virtual tours / VR venue walkthroughs | · · ● · · · · · ● | **missing** | low | no 3D/VR/Matterport walkthrough |

### Guest list / RSVP / Dietary

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| Guest list CRUD (add/edit/delete, bulk) | ● ● ● ● · · ● · ● | **built** | low | /src/app/(app)/weddings/[id]/guests/actions.ts addGuest/updateGuest/deleteGuest/bulkUpdateRsvp — HoneyBook/Dubsado/EventTemple lack native guest lists. |
| RSVP status tracking (invited/yes/no/pending) | ● ● ● ● · · ● · ● | **built** | low | /src/app/(app)/weddings/[id]/guests — RSVP status + session_type (day/evening/both); buildRsvpCounts in /src/lib/guests/summary.ts |
| Guest self-serve online RSVP (form / QR / event website) | · ● · ● · · ● · · | **missing** | medium | guest RSVP edited by couple in portal, not by individual guests; no per-guest RSVP form/QR or event website — Aisle Planner/Planning Pod let guests self-RSVP; VF2 couple manages all RSVPs. |
| Dietary requirements / allergen tracking per guest | ● ● ● ● · · ● · ● | **built** | low | /src/app/(app)/weddings/[id]/guests/page.tsx dietaryBreakdown (33–63); dietary as tag array per guest; buildDietaryBreakdown in /src/lib/guests/summary.ts |
| Per-guest meal/menu choice selection & aggregation | ● ● ● ● · · ● · · | **built** | low | /src/app/(portal)/portal/(authed)/page.tsx — per-guest, per-course meal choice (menu_item_id JSONB); chosenByMap aggregation (115–142) |
| Plus-one / partner / children management | · ● · ● · · ● · · | **built** | low | /src/app/(portal)/portal — +1 partner name editable per guest in couple portal |
| Guest stat cards (total/confirmed/pending/needs table) | · · · ● · · ● · · | **built** | low | /src/app/(app)/weddings/[id]/guests/page.tsx — stat cards + dietary breakdown summary |
| Name badge / place card generation | · · · ● · · ● · · | **missing** | low | no badge/place-card PDF generation |

### Menu / Catering

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| Menu library CRUD (dishes, course, price, allergens, tags) | ● ● ● ● · · ● · · | **built** | low | /src/app/(app)/settings/menu/page.tsx — menu library; price_per_head_minor, allergens, dietary_tags, sort_order |
| Per-wedding menu selection (course → item mapping) | ● ● ● ● · · ● · · | **built** | low | /src/app/(app)/weddings/[id]/menu/actions.ts addMenuSelection/removeMenuSelection; gating until library has active item (menu/page.tsx:204–207) |
| Multi-service menu (arrival/reception/main/evening) with per-head/guest-type pricing | ● · · ● · · · · · | **partial** | low | course-based selection + price_per_head_minor; no per-guest-type (adult/child) pricing tiers — Sonas has adult/child per-head tiers; VF2 single per-head price. |
| Automatic allergen cross-check against menu selections | ● · · · · · · · · | **partial** | medium | allergens stored on items + dietary tags on guests; no automated cross-check/flagging engine — Sonas's auto allergen cross-check is industry-leading; VF2 surfaces data but no auto-conflict alerts. |
| Couple portal menu self-selection with live chosen-by list | ● ● ● ● · · ● · · | **built** | low | /src/app/(portal)/portal/(authed)/page.tsx groupMenuByCourse (115–142) — couple picks one item/course with live chosen-by guest list |
| Chef/kitchen overview (full menu+table+guest+allergen view) | ● · ● · · · · · · | **partial** | medium | data exists (guests + menu + dietary) but no dedicated chef/kitchen display view — Sonas's chef overview is a standout; VF2 has the data, no kitchen view. |
| Provisioning / stock calc from menu selections | ● · · · · · · · · | **cut** | low | kitchen stock/inventory deliberately CUT (catering-ERP out of scope per inventory) — Deliberately cut — VF2 is not a catering ERP. |
| Food/wine tasting scheduling & booking | ● · · · · · · · · | **missing** | low | no tasting-booking flow; generic appointment booking only (viewing/call) |

### Bar / Drinks

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| Bar / beverage menu setup & pricing | ● · ● ● · · · · · | **missing** | low | no dedicated bar/drinks module; would live in menu library only as items — Most competitors also weak here; Sonas/Planning Pod strongest. Low priority. |
| Bar packages / tab management / prepaid bar | ● · ● · · · · · · | **missing** | low | no bar-tab or drinks-package concept |
| Couple selection of arrival/reception drinks | ● · · · · · · · · | **missing** | low | no drinks selection in couple portal (menu only) |

### Suppliers / Docs

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| Supplier / vendor directory & per-event roster | ● · ● ● · · ● ● · | **built** | low | /src/app/(app)/weddings/[id]/suppliers/actions.ts upsertSupplier — per-wedding suppliers + venue-level reusable directory |
| Supplier document / paperwork storage (contracts, insurance) | ● · ● ● · · ● ● · | **built** | low | /src/app/(app)/weddings/[id]/suppliers — wedding_documents with kind classification + status |
| Supplier event-day check-in board | · · ● · · · · · · | **built** | low | /src/app/(app)/weddings/[id]/runsheet — supplier check-in (name, contact, phone, checked_in_at) |
| Supplier collaboration portal (vendors access event details) | · · ● ● · · · · ● | **missing** | medium | suppliers are internal records; no vendor-facing login/portal — Tripleseat/Planning Pod give vendors portal access; VF2 has none (and Sonas/PV also lack a true vendor portal). |
| Supplier bulk email/SMS outreach | ● · ● ● · · · · · | **cut** | low | supplier bulk comms via GHL when connected; no native send — Delegated to GHL. |
| Vendor invoice / payment tracking | ● · · ● · · ● · · | **missing** | low | supplier docs can store invoices but no payable tracking/budget vs vendor |

### Couple / Client portal

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| Branded couple/client portal with authentication | ● ● ● ● ● ● ● · · | **built** | low | /src/app/(portal)/portal/login/page.tsx magic-link; resolveCoupleContext in portal-data.ts (auth_token → couple_accounts → wedding_id), RLS-gated — EventTemple/Prismm lack a couple portal. |
| Couple self-service editing (guests, menu, RSVP, +1) | ● ● ● ● · · ● · · | **built** | low | /src/app/(portal)/portal/actions.ts — couple-scoped addGuest/updateMenuSelection with optimistic updates + server validation |
| Portal tabs (timeline, menu, guests, seating, payments, docs) | ● · ● ● · · · · · | **built** | low | /src/app/(portal)/portal/portal-client.tsx — wedding/timeline/menu/guests/seating/payments/docs/contact tabs |
| Couple→staff two-way secure messaging / DM | ● · ● ● ● ● · · · | **partial** | high | /src/app/(portal)/portal/portal-client.tsx:1046–1065 — 'Contact venue' tab is footer placeholder; couples cannot DM staff (verified stub) — 5 competitors have in-portal couple↔staff messaging; VF2 couples cannot message back. Staff can view/reply via GHL mirror only. |
| Couple task / progress checklist (visible-to-couple filtered) | ● · · ● ● · ● · · | **built** | low | /src/app/(portal)/portal/(authed)/page.tsx — progress bar for couple tasks (visible_to_couple filtered) |
| Couple document access & download (contracts/invoices) | ● ● ● ● ● ● ● · · | **built** | low | /src/app/(portal)/portal/portal-client.tsx:1020–1037 — docs tab |
| Couple online payment within portal | ● ● ● ● ● ● ● · · | **cut** | low | /src/app/(portal)/portal/portal-client.tsx:941 — payment is toast stub; couples pay via GHL invoice link, not VF2 — Cut — couple Stripe dropped. |
| Event website builder (couple-facing public site + RSVP) | · · · ● · · ● · · | **missing** | low | no event-website builder |

### Reporting / Analytics

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| KPI dashboard (conversion, revenue, bookings, AOV) | ● ● ● ● ● · · ● · | **built** | low | /src/app/(app)/reports/page.tsx:129–356 — KpiCards (conversion, booked revenue YTD, on-time payments, portal adoption, avg booking value) |
| Leads-by-stage funnel & leads-by-source charts | ● ● ● ● · · · ● · | **built** | low | /src/app/(app)/reports/reports-charts.tsx LeadsByStageChart + source pie |
| Payment health (collected/outstanding/overdue + upcoming) | ● ● ● ● · · · · · | **built** | low | /src/app/(app)/reports/reports-charts.tsx PaymentHealthSection; top-10 upcoming milestones |
| Live pipeline value aggregate from CRM | · · ● · · · · ● · | **built** | low | /src/lib/ghl/reports.ts getPipelineAggregate — sum of opportunity values by stage from GHL; graceful degrade when disconnected |
| Revenue forecasting / predictive analytics / pace reporting | · ● ● · · · · ● · | **missing** | medium | reports are current-state KPIs; no forecasting/pace/YoY projection — Tripleseat Insights (25+ reports, forecasting) is best-in-class; VF2 has no forecasting. |
| Custom report builder with filtering & export | · · ● ● · · · ● · | **missing** | medium | fixed report views (report_* RLS views); no user-defined report builder |
| Multi-venue / chain roll-up reporting | ● · ● ● · · · ● · | **missing** | medium | reports are single-venue scoped; agency-owner sees all venues per memory but no cross-venue roll-up report — Agency-owner tier exists (RLS union) but reporting not aggregated across venues. |

### Marketing / Automation

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| Automated email workflows / sequences by event stage | ● ● ● ● ● ● ● ● · | **cut** | low | /src/app/(app)/settings/sequences — configures GHL nurture; native sequences delegated to GHL — Deliberately delegated to GHL; VF2 configures but GHL executes. |
| Email template library with merge fields | ● ● ● ● ● ● ● ● · | **cut** | low | no native template library; email = Google 2-way sync + GHL templates per memory |
| Two-way email inbox / Gmail sync | · ● · · ● ● ● · · | **planned** | medium | email = Google 2-way sync per memory (venueflow-email-and-brochure); not yet in src/ — Planned per product decision (Google sync, not Resend); not built. |
| SMS reminders / notifications | · ● · ● · · · · · | **cut** | low | SMS delegated to GHL; no native SMS |
| Mailchimp / newsletter export integration | ● · ● ● · · · · · | **cut** | low | email marketing is GHL's domain |
| Brochure generation & delivery | · · · · · · ● · · | **partial** | low | /src/app/(app)/settings/brochure — generate PDF or custom URL; delivery is GHL's job per memory |

### AI / Intelligence

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| AI-driven engagement / triage insights (at-risk, overdue, quiet leads) | · · · · · · · · · | **built** | low | /src/lib/copilot/insights.ts computeInsights — 4 rules (at-risk weddings, overdue payments, quiet leads, upcoming run-sheet); /src/app/(app)/copilot/page.tsx — VF2 differentiator — no competitor has this. Rule-based, not LLM, but a clear gap-filler vs Sonas's zero AI. |
| AI email reply / drafting assistant | · ● · · ● · · · · | **missing** | medium | /src/app/(app)/copilot/copilot-answer-sheet.tsx exists (Q&A) but no AI email composer; copilot is insight-triage not email gen — Perfect Venue's AI Reply + HoneyBook AI builder are standouts; VF2 has triage AI but no comms AI. |
| AI workflow / automation builder (natural language) | · · · · ● · · · · | **missing** | low | no automation builder (automations cut to GHL) — HoneyBook-only; niche. |
| AI meeting notetaker / summaries | · · · · ● · · · · | **missing** | low | not present |
| AI diagram / floor-plan generation from BEO | · · · · · · · · ● | **missing** | low | no AI diagram auto-generation (Social Tables/CventIQ feature) |

### Integrations

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| CRM integration / OAuth-backed bidirectional contact sync | · · ● ● · · · ● · | **built** | low | /src/lib/ghl/client.ts (380 lines) + contacts-sync.ts + crypto.ts (AES-256-GCM) — OAuth 2.0, encrypted tokens, bidirectional GHL contact sync (~2,700 lines total) — VF2's entire pre-sales layer is GHL — deeper than competitors' add-on connectors. |
| Webhook listener for inbound events (e.g. opportunity-won) | · ● ● ● · · · · · | **built** | low | /src/app/api/ghl/webhooks/route.ts + /src/lib/ghl/webhooks.ts — opportunity-won → create wedding; invoice status updates |
| Payment gateway integration (Stripe/Square/PartyPay) | ● ● ● ● ● ● ● ● · | **cut** | low | no native Stripe; payments via GHL invoices (verified: no stripe in src/) — Cut — payment rail is GHL's. |
| Accounting integration (Xero / QuickBooks) | ● ● · ● · ● · ● · | **missing** | medium | no Xero/QBO client (verified) |
| Zapier / no-code automation bridge | · ● ● ● ● ● ● · · | **missing** | low | no Zapier/public webhook surface; GHL is the automation hub |
| PMS integration (Opera/Mews/Stayntouch) for hotel venues | · · ● · · · · ● · | **missing** | low | no PMS connectors — Hotel-vertical only; not VF2's market. |
| Public API for custom integrations | · ● ● · ● ● · ● · | **missing** | low | no public API surface beyond GHL webhooks |

### Roles / Multi-venue

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| Role-based access control (owner/admin/staff/read-only) | ● ● ● ● ● ● ● ● · | **built** | low | /src/lib/tenant.ts getTenantContext — staff role hierarchy via memberships; /src/app/(app)/settings/team/page.tsx role assignment |
| Staff invitation / account creation | ● ● ● ● ● ● ● ● · | **built** | low | /src/app/(app)/settings/team/actions.ts:168 inviteMember — auth.admin.inviteUserByEmail, redirect to /api/invite/accept (CORRECTION: inventory marked this 'not implemented' but it IS built) — Verified: inviteMember exists with invited/active/disabled status. Inventory's 'Staff Account Creation: stub' is outdated. |
| Custom role creation with bespoke permissions | ● · ● ● · · · · · | **missing** | low | fixed role set (owner/admin/staff/read-only); no custom-role builder |
| RLS / tenant isolation (venue_id scoping) | · · · · · · · · · | **built** | low | /src/lib/supabase/server.ts RLS session client; venue_id scoping on all tables; report_* views security_invoker=on — VF2 architectural strength (Postgres RLS); competitors don't expose this. |
| Multi-venue management under one account | ● ● ● ● ● ● · ● · | **partial** | medium | agency-owner tier sees ALL venues (platform_admins + RLS union per memory); per-venue config exists but no in-app venue-switcher roll-up surface verified — Foundations present (agency-owner RLS) but multi-venue UX/reporting shallow vs Tripleseat/EventTemple chain management. |
| Custom fields to extend contact/wedding data | ● ● ● ● · · ● · · | **built** | low | /src/app/(app)/settings/custom-fields — extend contact/wedding fields; GHL custom-field mapping in upsert-contact.ts |

### Mobile / Event-day

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| Responsive web access on mobile devices | ● ● ● ● ● ● ● ● ● | **partial** | low | Next.js 16 app is web-responsive by default; no mobile-specific optimization claimed/verified |
| Native mobile app (iOS / Android) | · ● ● · ● ● · · · | **missing** | medium | no native app; web-only (same gap as Sonas/Planning Pod/Aisle Planner) — Perfect Venue/Tripleseat/HoneyBook have native apps; VF2 web-only. Sonas/PP/AP also lack one. |
| Event-day execution tools (supplier check-in, live run-sheet) | · · ● ● · · · · · | **built** | low | /src/app/(app)/weddings/[id]/runsheet — supplier check-in board + timeline status toggle (mark done); usable on mobile web |
| Guest check-in / QR scanning at event | · · · ● · · · · · | **missing** | low | no guest check-in/QR scan (Planning Pod ticketing feature) — Ticketing-adjacent; not core wedding-venue need. |
| Push notifications for urgent items | · ● ● · · · · · · | **missing** | low | no push notification infra (no native app) |

### Onboarding & Configuration

| Capability | Son PV Tri PPod HB Dub AP ET Pri | VF2 | Sev | Evidence / note |
|---|---|---|---|---|
| Guided onboarding wizard (venue → space → hours) | · ● · · ● · · · · | **built** | low | /src/app/onboarding/wizard.tsx + step1-venue/step2-space/step3-hours — wizard with progress + initial seeding — VF2 strength vs Sonas/Tripleseat's 'fiddly' setup complaints. |
| Venue profile & brand configuration (name, tagline, accent, timezone) | ● ● · ● · · ● · · | **built** | low | /src/app/(app)/settings/profile/page.tsx — venue name, legal_name, tagline, address, accent_seed, timezone + hours CRUD |
| Package / bundle library configuration | ● · ● ● · · ● · · | **built** | low | /src/app/(app)/settings/packages/page.tsx — package bundles with line items |
| CSV import of contacts/guests | · · · ● · · ● · · | **partial** | low | /src/app/(app)/contacts/csv.ts — toCsv EXPORT wired to contacts-list.tsx:416; CSV IMPORT/parse not in UI (verified: only toCsv exported, no parse fn) — CORRECTION vs inventory: export IS wired (downloadCsv button); import parsing is the unwired part. |
| Billing / plan & subscription management | ● ● ● ● ● ● ● · · | **partial** | medium | /src/app/(app)/settings/billing — tier/usage UI + assertCanMutate gating; no in-app Stripe billing (per memory venue goes read-only after trial) — No Stripe billing (dropped); gate logic needs change per memory — venue read-only after trial not yet reconciled. |
