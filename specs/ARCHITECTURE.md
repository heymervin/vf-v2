# VenueFlow v2 — Data Architecture & Process Flow

> The single-page mental model: where data lives, how the two systems connect, and how a couple
> flows from cold lead to wedding day. Companion to [`../BUILD-ROADMAP.md`](../BUILD-ROADMAP.md)
> (the build order) and [`data-model.md`](./data-model.md) (the table-level schema).
>
> **One-line summary:** GHL is the pre-sales database VF2 *reads through*; Supabase is the
> post-booking database VF2 *owns*; a single won-opportunity webhook is the bridge; four link-key
> IDs are the only GHL data ever stored.

---

## 1. The big picture — two stores, one bridge

VF2 is **not** one database. It is two systems of record with a single bridge between them.

```
   GHL  (system of record: PRE-SALES)            SUPABASE  (system of record: POST-BOOKING + config)
 ┌──────────────────────────────────┐          ┌──────────────────────────────────────────────┐
 │ • contacts (leads)               │          │ • venues, memberships (tenancy)               │
 │ • opportunities / pipeline       │          │ • weddings  ← the hub record                  │
 │ • conversations (WhatsApp/SMS/   │          │ • couple_accounts (portal users)             │
 │   email threads)                 │          │ • planning tools (guests, menu, run sheet,    │
 │ • invoices / payments            │          │   floor plan, suppliers, documents)           │
 └──────────────────────────────────┘          │ • venue libraries (menu_items, packages,      │
              ▲      │                          │   floor_templates, spaces)                    │
              │      │ webhook: opportunity WON │ • ghl_credentials (the keys to reach GHL)     │
   ghlClient  │      ▼                          └──────────────────────────────────────────────┘
  (read live) │   ┌─────────── THE BRIDGE ───────────┐                  ▲
              │   │ /api/webhooks/ghl → Inngest →     │                  │ couple magic-link (RLS)
              └───┤ create weddings + couple_accounts ├──────────────────┘
                  └───────────────────────────────────┘
```

**The rule:** GHL owns everything *before* the booking. Supabase owns everything *after*. VF2 never
copies GHL data into Supabase — it stores a **link key** and fetches live when needed.

---

## 2. Where every piece of data lives

| Data | System of record | How VF2 gets it |
|---|---|---|
| Leads / contacts | **GHL** | `ghlClient.getContact(ghl_contact_id)` — live, on demand |
| Sales pipeline / stages | **GHL** | live read (a mirror view in bundled mode) |
| WhatsApp/SMS/email threads | **GHL** | live read + send; **never stored** in VF2 |
| Invoices / payments | **GHL** | live read; status cached on `payment_milestones.ghl_invoice_id` |
| **Wedding** (the booked event) | **Supabase** | native — `weddings` table |
| Couple portal accounts | **Supabase** | native — `couple_accounts` |
| Guests, menu choices, run sheet, floor plan, suppliers, docs | **Supabase** | native — per-wedding tables |
| Venue config (spaces, menu library, packages, team) | **Supabase** | native |
| GHL API tokens | **Supabase** | `ghl_credentials`, encrypted (app-layer AES-256), service-role only |

---

## 3. The link keys (how the two stores stay connected)

```
GHL contact  ──ghl_contact_id──►  contacts row  ──┐
GHL opp      ──ghl_opportunity_id─► opportunities ─┼──► weddings.ghl_opportunity_id
GHL sub-acct ──location_id───────► ghl_credentials.location_id (per venue)
GHL invoice  ──ghl_invoice_id────► payment_milestones.ghl_invoice_id
```

These four IDs are the *only* GHL data persisted in Supabase. Everything else is fetched live through
`ghlClient(venueId)` (`src/lib/ghl/client.ts`), which loads the venue's token from `ghl_credentials`,
decrypts it, and calls `services.leadconnectorhq.com` with `Version: 2021-07-28`.

---

## 4. Supabase schema — the table groups

| Group | Tables | Status |
|---|---|---|
| Tenancy | `venues`, `memberships`, `spaces`, `venue_hours` | built (M1) |
| Pre-sales native (standalone fallback / bundled read-mirror) | `contacts` (+`ghl_contact_id`), `opportunities` (+`ghl_opportunity_id`), `stage_events`, `form_submissions`, `sequences*`, `appointments`, `availability_rules`, `meeting_types`, `brochures` | built (M2–M5); GHL columns added M7 |
| GHL link | `ghl_credentials`, `venues.mode` | new (M7) |
| Wedding core | `weddings`, `couple_accounts` | new (M8) |
| Venue libraries | `menu_items`, `menus`, `menu_item_selections`, `floor_templates`, `packages`, `package_lines`, `suppliers` | new (M9–M10, M12) |
| Per-wedding planning | `wedding_guests`, `wedding_menu_selections`, `timeline_events`, `floor_plans`, `wedding_suppliers`, `wedding_documents` | new (M11–M12) |
| Money | `proposals`, `proposal_line_items`, `payment_milestones` | new (M13) |
| Billing (VF2 SaaS) | `billing_subscriptions`, `stripe_events` | built (M6) |

> Final column shapes for the new tables are settled in [`SCHEMA-DECISIONS.md`](./SCHEMA-DECISIONS.md)
> (SD-1…SD-8), which overrides any conflicting inline DDL.

---

## 5. Process flow — the wedding lifecycle

```
 ┌─ GHL (pre-sales) ──────────────────────────────────┐   ┌─ VF2 / Supabase (post-booking) ──────────────┐
 │                                                    │   │                                              │
 │  Lead   →  Nurture   →  Viewing  →  Opportunity    │   │  Wedding  →  Planning   →  Wedding   →  (post │
 │  capture   sequences    booked      marked WON ────┼─► │  created     (guests,      day         event)│
 │  (form,    (email/SMS)  (calendar)  ▲              │   │  + couple    menu, run    (run sheet         │
 │   WhatsApp)                          │             │   │  invited     sheet,        live mode)         │
 │                                      │             │   │              floor plan)                     │
 └──────────────────────────────────────┼─────────────┘   └──────────────────────────────────────────────┘
                                        │                                    ▲
                                  the ONE trigger                  couple portal (magic link,
                                  (webhook bridge)                 sees/edits only their wedding)
```

---

## 6. The bridge in detail — "opportunity won → wedding"

```
1. Staff drags opp to "Booked" in GHL
2. GHL fires webhook  ──►  POST /api/webhooks/ghl   (HMAC-verified)
3. Route emits Inngest event  ghl/opportunity-won  (idempotent on ghl_opportunity_id)
4. Inngest function opportunity-won.ts:
     a. ghlClient.getContact(contactId)        ← pull couple details from GHL
     b. INSERT weddings (source='ghl_webhook', ghl_opportunity_id, couple_names, date…)
     c. INSERT couple_accounts (status='invited')
     d. ghlClient.addTag(contactId, 'vf2-portal-invited')   ← write back to GHL
     e. Resend → portal invite email to the couple
```

**Standalone fallback (D6):** the same inserts run from a staff "Create wedding" button — no GHL
needed. GHL is an *optional plugin layer*, not a hard dependency. The per-venue `venues.mode` flag
(`bundled` | `standalone`) selects which path is primary.

---

## 7. The read-through pattern (GHL data shown inside VF2)

The Messages and Payments tabs in the Wedding Workspace hold **no data** — they are live windows into GHL:

```
Staff opens Wedding Workspace → Messages tab
  → VF2 has weddings.contact_id → contacts.ghl_contact_id
  → ghlClient.getConversations(ghl_contact_id)   [live GHL call]
  → render threads.  Reply → ghlClient.sendMessage()  → GHL delivers (WhatsApp/SMS)
  → inbound reply → GHL webhook → Supabase Realtime channel → UI updates live
  Nothing is stored. GHL stays the record of truth.
```

---

## 8. Tenancy & access (RLS)

```
Every table has venue_id.
  Staff      → RLS via current_venue_ids()           (sees their whole venue)
  Couples    → RLS via current_couple_wedding_ids()  (sees ONLY their wedding_id)
  GHL tokens → ghl_credentials: service-role only    (no one reads tokens via the app)
  Webhooks/Inngest → write via service role (bypass RLS, scoped by venue_id in code)
```
