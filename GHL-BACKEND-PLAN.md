# GHL as Backend — Integration Plan

> **Context:** Decisions from the June 16 team call (Kai, Trey, Mervin).  
> **Premise:** VF2 is a "pretty skin" for post-booking. GHL (VenueFlow CRM) remains the pre-sales engine.  
> This plan is **separate from the main VF2 build** — it defines which automations delegate to GHL vs. which stay native.

---

## The Two-System Model

```
PRE-SALES (GHL / VenueFlow CRM)          POST-BOOKING (VF2)
─────────────────────────────────         ───────────────────────────────
Lead capture → nurture sequences          Wedding workspace
WhatsApp / SMS / email threads            Couple portal (guest lists, menu, timeline)
Opportunity pipeline (8 stages)           Payment tracking (mirrored from GHL)
Appointments / viewings                   Run sheets, floor plans, suppliers
Invoicing & payments                      Internal staff notes + tasks
─────────────────────────────────         ───────────────────────────────
                  │
                  │  TRIGGER: Opportunity moved to "Won/Booked"
                  ▼
         GHL Webhook → VF2 API → create Wedding in Supabase
```

**Rule of thumb:** If it involves a cold or warm lead → GHL. If the couple is booked and planning their event → VF2. VF2 surfaces GHL data via API calls; it does not re-implement what GHL already does well.

---

## Integration Points

### 1. The Trigger — Opportunity Won → Wedding Created

**What:** When a GHL opportunity is moved to the "Won/Booked" stage in the VenueFlow pipeline, VF2 automatically creates a wedding workspace and invites the couple.

**GHL side:**
- Webhook event: `opportunity.updated` (filter where `status === "won"` or stage matches the "Booked" column)
- Payload includes: `opportunityId`, `contactId`, `pipelineId`, `stageId`, `monetaryValue`, venue sub-account ID

**VF2 side:**
- New webhook handler: `app/api/webhooks/ghl/route.ts`
- Validates HMAC signature from GHL
- Fires Inngest event: `ghl/opportunity-won`
- Inngest function `opportunity-won.ts`:
  1. Calls `GET /v2/contacts/{contactId}` to fetch couple details
  2. Creates `Wedding` record in Supabase (linked to `Contact` + `Opportunity`)
  3. Creates couple portal accounts (invites both partners via email)
  4. Marks `contacts.ghl_contact_id` + `contacts.ghl_opportunity_id` for future sync

**Supabase changes needed:**
- Add `ghl_contact_id`, `ghl_opportunity_id`, `ghl_account_id` columns to `contacts` and `opportunities`
- New `weddings` table (or promote from existing portal scaffold)
- New `ghl_credentials` table (per-venue API token storage — encrypted)

---

### 2. Contact Sync

**What:** Couple/contact data lives in GHL. VF2 reads it on demand; writes back tags and status updates.

**GHL API:**
```
GET  /v2/contacts/{contactId}          — fetch latest details
PUT  /v2/contacts/{contactId}          — update (e.g. tag as "Portal Active")
POST /v2/contacts/{contactId}/tags     — add tags ("vf2-portal-invited")
```

**VF2 approach:**
- Store `ghl_contact_id` on the VF2 `contacts` row — this is the source of truth link
- On portal invite send: tag contact in GHL as `vf2-portal-invited`
- On venue viewing a contact in VF2: pull fresh data from GHL (do not cache stale data)
- **Do not duplicate all contact fields into Supabase** — only store what VF2 needs locally (name, email, phone, wedding date). Everything else comes from GHL on-demand.

---

### 3. WhatsApp + Messaging Mirror

**What:** Venues are already talking to couples on WhatsApp via GHL. VF2 needs to surface these threads so staff don't need to switch apps.

**GHL API:**
```
GET  /v2/conversations?contactId={id}                    — list threads
GET  /v2/conversations/{conversationId}/messages          — fetch messages
POST /v2/conversations/{conversationId}/messages          — send message (WhatsApp, SMS, email)
```

**VF2 approach:**
- Read-only view in the wedding workspace: "Messages" tab pulls GHL conversation history
- Reply sends via GHL API (VF2 is the UI, GHL does the delivery)
- Real-time: GHL fires `conversation.message.received` webhook → VF2 webhook handler → push to Supabase Realtime channel → update UI without polling
- **No message storage in VF2 Supabase** — GHL is the record of truth. VF2 just renders it.
- This satisfies Trey's requirement: pre-sales WhatsApp nurturing already in GHL; after booking, staff can still reply from VF2's UI without leaving the wedding workspace.

**Note:** This is the biggest blocker. Priority is: get read working first (surface existing threads), send second, real-time third.

---

### 4. Invoices & Payments

**What:** VF2 shows payment status and lets staff send invoices — but the actual payment processing goes through GHL.

**GHL API:**
```
POST /v2/invoices                      — create invoice (link to contactId + opportunityId)
GET  /v2/invoices/{invoiceId}          — get invoice + payment status
POST /v2/invoices/{invoiceId}/send     — send invoice to couple
```

**VF2 approach:**
- "Payments" tab in wedding workspace: lists invoices fetched from GHL
- "Send Invoice" button: calls GHL API to create + dispatch invoice
- Payment tracking: fetch invoice status from GHL; display as "Awaiting Deposit", "Deposit Paid", "Balance Due", "Paid in Full"
- **No Stripe integration for couple-facing payments** (venues prefer bank transfer; no appetite for payment processor fees on large sums)
- GHL invoices support bank-transfer instructions in the invoice body — use that

---

### 5. Daily Brief — Pipeline + Activity Report

**What:** Kai's "Daily Brief" feature — venues get an email every morning with a summary of their account.

**Data sources:**
- GHL: `GET /v2/opportunities?pipelineId={id}` — count by stage, revenue in pipeline
- GHL: recent contacts added, recent messages received
- VF2 (Supabase): couples who logged into portal today, payments received, upcoming run sheet deadlines

**VF2 approach:**
- Inngest scheduled function: `daily-brief.ts` fires at 7am venue-local time
- Fetches from GHL + Supabase, assembles digest
- Sends via Resend (already in stack)
- Template: "Here's your venue at a glance" — pipeline count, this week's viewings, portal activity, upcoming events

---

## What Stays Native in VF2 (NOT through GHL)

| Feature | Approach | Reason |
|---|---|---|
| Email (enquiry replies) | Two-way Gmail/Outlook sync | GHL has spam/deliverability issues; two-way sync is a clean mirror |
| Wedding planning tools | Native in VF2 | GHL has no concept of floor plans, guest lists, menus, run sheets |
| Couple portal | Native in VF2 | Post-booking, self-service; no GHL equivalent |
| Calendar / appointments | Native in VF2 | Already built; appointment booking widget exists |
| Staff tasks & notes | Native in VF2 | Internal workflow; no GHL needed |
| Supplier management | Native in VF2 | Venue-specific ops |

---

## Token & Auth Architecture

Each venue's GHL sub-account credentials need to be stored per-venue in VF2.

```
ghl_credentials table:
  id              uuid PK
  venue_id        uuid FK → venues.id
  location_id     text        (GHL sub-account location ID)
  access_token    text        (encrypted at rest)
  refresh_token   text        (encrypted at rest)
  token_expires_at timestamptz
  created_at      timestamptz
```

- OAuth 2.0 flow: venue connects GHL in VF2 Settings → stores tokens here
- Token refresh handled by Inngest scheduled function (before expiry)
- All GHL API calls go through a `ghlClient(venueId)` server-side helper that auto-refreshes

---

## Implementation Phases

### Phase 0 — Foundation (do first)
- [ ] `ghl_credentials` table + encrypted token storage
- [ ] `ghlClient(venueId)` server helper with auto-refresh
- [ ] GHL webhook handler (`api/webhooks/ghl/route.ts`) with HMAC validation
- [ ] Add `ghl_contact_id`, `ghl_opportunity_id` columns to existing tables
- [ ] GHL Settings page: venue connects their GHL account (OAuth)

### Phase 1 — The Trigger (most valuable single feature)
- [ ] Inngest function `ghl/opportunity-won`:
  - Fetch contact from GHL
  - Create wedding record in Supabase
  - Send couple portal invites

### Phase 2 — Messaging Mirror (biggest blocker per Trey + Kai)
- [ ] Messages tab: read GHL conversation threads (read-only first)
- [ ] Reply from VF2 (sends via GHL API)
- [ ] Inbound webhook → Supabase Realtime (new message notification)

### Phase 3 — Invoices & Payments
- [ ] Payments tab: list invoices from GHL
- [ ] Send invoice button → GHL API
- [ ] Payment status display

### Phase 4 — Daily Brief
- [ ] Inngest scheduled job
- [ ] GHL pipeline data + VF2 portal activity
- [ ] Resend email template

### Phase 5 — Contact Sync Polish
- [ ] Tag management (portal-invited, portal-active)
- [ ] Sync webhook for contact updates (GHL → VF2)

---

## Open Questions

1. **WhatsApp API approval** — Does the current TWM GHL account have WhatsApp Business API approved? If not, Phase 2 messaging is SMS-only until approved.
2. **GHL OAuth scope** — Which OAuth scopes does VF2 need? Minimum: `contacts.readonly`, `contacts.write`, `conversations.readonly`, `conversations.write`, `opportunities.readonly`, `invoices.write`.
3. **Webhook registration** — GHL webhooks are registered per-location (sub-account). Each venue onboarding needs to auto-register the VF2 webhook URL against their location.
4. **Standalone product question** — If VF2 becomes a standalone product (not bundled with VenueFlow/GHL), Phases 1-3 need fallback implementations. Design the GHL integration as an optional plugin layer, not a hard dependency.

---

## Files to Create

```
src/
  lib/
    ghl/
      client.ts          — ghlClient(venueId): GHL API wrapper with auth
      types.ts           — GHL API response types
      webhooks.ts        — HMAC validation helper
  inngest/
    functions/
      opportunity-won.ts — GHL opp won → create wedding
      daily-brief.ts     — morning digest email
  app/
    api/
      webhooks/
        ghl/
          route.ts       — inbound GHL webhook handler
      ghl/
        connect/route.ts  — OAuth initiation
        callback/route.ts — OAuth token exchange
```

---

*Plan written from June 16 team call transcript. Review with Kai + Trey before Phase 0 starts.*
