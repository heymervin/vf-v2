# GHL Integration Spec — The Backend Layer

> **Status:** Build-ready design. Deepens `GHL-BACKEND-PLAN.md` (the authoritative phase plan) into implementable detail for the builders (Mervin building; Mando/Andres on GHL config).
> **Scope:** Everything in `src/lib/ghl/*`, `src/app/api/webhooks/ghl/route.ts`, the GHL-touching Inngest functions, and the `ghl_credentials` table. Does **not** cover the post-booking planning tools themselves (those are separate slice specs) — only how GHL data flows in and out.
> **Read first:** `AGENTS.md` (this is Next.js 16 — verify APIs against `node_modules/next/dist/docs/` before writing route handlers).

---

## 0. TL;DR for Kai / Trey (non-developer summary)

- GHL is the **engine room** for everything before a booking. VF2 is the **showroom** for everything after. This spec is the set of pipes between them.
- **One wire matters most:** when a venue marks a deal "Won" in GHL, VF2 automatically spins up a Wedding and emails the couple their portal invite. Everything else (messages, invoices, the morning brief) is VF2 *reading* GHL and *re-rendering* it so staff never have to leave the wedding screen.
- **GHL is optional.** A venue with no GHL connection still gets a fully working VF2 — they just create weddings by hand instead of automatically. We never hard-fail because GHL is missing. (Locked decision **D6**.)
- **Two corrections to the original plan** that the builder must know (details in §11): GHL secures its webhooks with a *signature it signs with its own key*, not a shared password we set — so "HMAC validation" in the old plan is replaced by signature verification. And GHL's live API paths are slightly different from what the plan sketched. Both are pinned down precisely below.

---

## 1. Ground rules (apply to the whole layer)

| Rule | Detail |
|---|---|
| **Server-only** | Every GHL call runs server-side: Inngest functions, route handlers, server actions. The `ghlClient` module imports `"server-only"`. No GHL token or call ever reaches the browser. |
| **Base URL** | `https://services.leadconnectorhq.com` — **no `/v2` path segment.** (The `/v2/...` paths in `GHL-BACKEND-PLAN.md` are shorthand; the real paths are `/contacts/...`, `/conversations/...`, etc. See §11.) |
| **Required headers** | `Authorization: Bearer {token}`, `Version: 2021-07-28`, `Content-Type: application/json` (on POST/PUT). |
| **Location-scoped** | Almost every call needs the GHL `locationId` (the venue's sub-account). It lives in `ghl_credentials.location_id` and is injected by `ghlClient`. |
| **No bulk mirroring** | VF2 stores only the *link keys* and a few denormalised display fields. GHL stays the record of truth for contacts, conversations, invoices, pipeline. We read on demand. (Locked: contact-sync rule, **D2/D3**.) |
| **Idempotent ingress** | Every inbound webhook is de-duped before it does work (see §4). Every Inngest function is replay-safe via `step.run`. |

---

## 2. Auth design — `ghlClient(venueId)`

**File:** `src/lib/ghl/client.ts` (new). Mirrors the shape of `src/lib/billing/stripe.ts` (a single server-only factory) and uses `createAdminClient()` from `src/lib/supabase/admin.ts` to read creds (RLS-bypassing, service-role).

### 2.1 What it does

```
ghlClient(venueId) → {
  locationId,
  get(path, query?),
  post(path, body?),
  put(path, body?),
  del(path, body?),
}
```

1. Loads the venue's row from `ghl_credentials` (by `venue_id`).
2. If none → throws `GhlNotConnectedError` (callers treat this as "standalone mode", §3).
3. Resolves a **valid access token** (see §2.3 PIT vs OAuth).
4. Returns a thin fetch wrapper that sets the three required headers, prefixes the base URL, injects `locationId` where the endpoint needs it, and centralises error/retry handling (§10).

### 2.2 Header construction

Every request:

```
Authorization: Bearer <decrypted access_token>
Version: 2021-07-28
Content-Type: application/json   # POST/PUT only
```

The `Version` value is a constant — pin it in `src/lib/ghl/client.ts` as `const GHL_API_VERSION = "2021-07-28"`. Do not read it from env (it's an API contract version, not a secret).

### 2.3 PIT (now) vs OAuth (later) — the swap is backend-only

`ghl_credentials.auth_type` selects the path. **Callers never know which is in use** — that is the whole point of the helper (it makes the PIT→OAuth swap a backend change only, per the GHL-access decision in the brief).

| `auth_type` | Token source | Refresh behaviour |
|---|---|---|
| `pit` (now) | `access_token` is a **static Private Integration Token**. `refresh_token` and `token_expires_at` are NULL. | None. The token never expires until rotated by hand in GHL. `ghlClient` uses it directly. |
| `oauth` (later) | `access_token` (24 h life) + `refresh_token` (1 yr, rolls on use) from the marketplace OAuth flow. | Lazy refresh: if `token_expires_at` is within a 5-minute skew **or** a live call returns `401`, call `POST /oauth/token` (grant `refresh_token`), persist the new `access_token` + `refresh_token` + `token_expires_at`, retry once. |

**OAuth refresh request** (form-encoded, *not* JSON, and *no* `Version`/`Bearer` header on this one endpoint):

```
POST https://services.leadconnectorhq.com/oauth/token
Content-Type: application/x-www-form-urlencoded

client_id={GHL_CLIENT_ID}&client_secret={GHL_CLIENT_SECRET}&grant_type=refresh_token&refresh_token={refresh_token}&user_type=Location
```

Response yields a new `access_token`, `refresh_token`, `expires_in` (seconds → compute `token_expires_at = now + expires_in`). **Persist both tokens** — the refresh token rotates on every use; storing only the access token loses the chain.

> **Concurrency note (OAuth only):** two parallel calls could both see an expired token and both refresh, and because the refresh token rotates, the second refresh invalidates the first. Mitigate with a Postgres advisory lock keyed on `venue_id` (or a `SELECT … FOR UPDATE` on the creds row) around the refresh-and-persist step. **Not needed for PIT.** → **OQ-1.**

### 2.4 Token encryption at rest

Tokens are venue API credentials — they must be encrypted in the DB, not stored as plaintext. There is **no existing crypto utility in `src/lib`** (confirmed), so this is net-new.

- **Mechanism:** AES-256-GCM via Node's `crypto` (`webcrypto`/`createCipheriv`). New helper `src/lib/ghl/crypto.ts` with `encryptToken(plain): string` / `decryptToken(blob): string`. Store `iv:authTag:ciphertext` base64-joined in a single `text` column.
- **Key:** a new secret env var `GHL_TOKEN_ENCRYPTION_KEY` (32-byte base64). Add to `.env.example` alongside the existing keys. Server-only; never `NEXT_PUBLIC_`.
- **Columns affected:** `ghl_credentials.access_token` and `.refresh_token` hold the *encrypted blob*, not the raw token. `ghlClient` decrypts on read; the connect/refresh paths encrypt on write.
- **Why app-layer and not pgcrypto:** keeps the key out of the database and out of Supabase's reach; matches the "all GHL handling is server-only" rule. → **Assumption A-1** (if the team prefers Supabase Vault / pgsodium, swap the helper; the column shape is unchanged).

### 2.5 PIT scopes vs OAuth scopes

See §9 for the full list. A PIT created in GHL Settings → Integrations → Private Integrations must be created with **every scope the integration uses**, because a PIT's scope set is fixed at creation (editable later without regenerating, but easy to forget). The OAuth app requests the same set in its `scope=` param.

---

## 3. Optional-plugin-layer design (Locked decision **D6**)

GHL is a plugin, not a dependency. The selector is a **per-venue mode flag**.

### 3.1 The mode flag

Add `venues.ghl_enabled boolean NOT NULL DEFAULT false`. (Brief allows either `venues.ghl_enabled` or a `mode` setting; a boolean on `venues` is the simplest and matches the existing flat-column style of the `venues` table.) Derived truth:

- **Bundled mode** = `ghl_enabled = true` **AND** a `ghl_credentials` row exists.
- **Standalone mode** = anything else (the default for every venue until they connect).

A small server helper `getVenueMode(venueId): 'bundled' | 'standalone'` (in `src/lib/ghl/client.ts` or `src/lib/tenant.ts`) is the single read used by UI and Inngest to branch.

### 3.2 How each integration point degrades

| Integration point | Bundled (GHL connected) | Standalone (no GHL) |
|---|---|---|
| **1. Opp-won → Wedding** | GHL webhook auto-creates the wedding (§5). | **Manual "Create wedding" button** in the real Weddings index. Staff fill couple name/email/date; same server action that the webhook calls, minus the GHL fetch. This is the required fallback. |
| **2. Contact sync** | Read GHL contact on demand; write tags back. | VF2's own `contacts` table is the source of truth (the existing native CRM, preserved per **D2**). No tag writes. |
| **3. Messaging mirror** | GHL conversations rendered in the workspace. | Messages tab shows an empty state: "Connect GHL to see conversations here." No native messaging is built (D3 — VF2 never obtains WhatsApp access). |
| **4. Invoices** | Create/send/track via GHL invoices. | Payments tab falls back to the native `proposals` + `payment_milestones` (manual status, no send). → see money slice spec. |
| **5. Daily brief** | Pipeline counts pulled from GHL + VF2 data. | Brief still sends, with VF2-only sections (portal activity, upcoming run sheets); pipeline section omitted. |

### 3.3 UI rule

Anywhere a feature is GHL-only, the component checks `getVenueMode` (or receives `mode` as a prop from a server component) and renders either the live data or a **connect-prompt empty state** — never an error. The "Connect GHL" affordance lives on the new settings tile (§8). This also satisfies the gating pattern **D5** (a tab is informative-but-locked until its prerequisite — here, a GHL connection — exists).

### 3.4 Manual wedding creation = the universal fallback

The opp-won Inngest function and the manual button **both call one server action** `createWeddingFromSource(...)` (lives with the Weddings slice, referenced here). The webhook path supplies `{ source: 'ghl', ghlContactId, ghlOpportunityId }`; the manual path supplies `{ source: 'manual', firstName, email, ... }`. Single creation code path → one place that creates `weddings` + `couple_accounts` + sends the invite. This is what makes D6 cheap: the GHL trigger is just *one more caller* of an action staff can also invoke by hand.

---

## 4. Webhook ingress — `src/app/api/webhooks/ghl/route.ts`

New route handler. Models its idempotency + signature-gate structure on the existing `src/app/api/webhooks/stripe/route.ts`.

### 4.1 Signature verification — **RSA, not HMAC** (correction to the plan)

`GHL-BACKEND-PLAN.md` says "Validates HMAC signature." **GHL does not use a per-app HMAC shared secret for these webhooks.** It signs each payload with **its own private key** and ships an `x-wh-signature` header; we verify with **GHL's published RSA public key** using **RSA-SHA256**.

```ts
import crypto from "crypto";
// GHL_WEBHOOK_PUBLIC_KEY = the fixed PEM published by GHL (see ghl-api-skill/references/webhooks.md)
function verifyGhlSignature(rawBody: string, signature: string): boolean {
  const v = crypto.createVerify("SHA256");
  v.update(rawBody);
  v.end();
  return v.verify(GHL_WEBHOOK_PUBLIC_KEY, signature, "base64");
}
```

- Read the **raw body** with `await req.text()` *before* parsing (same pattern as the Stripe handler — signature is over the exact bytes).
- Missing/invalid signature → `401`. No public/`anon` access; this route is unauthenticated-to-Supabase but gated entirely by the signature.
- Store the PEM as a module constant or `GHL_WEBHOOK_PUBLIC_KEY` env var. It is GHL's *public* key, so it is not a secret — but env keeps it swappable if GHL rotates it.

> **Replay protection:** also reject events whose `timestamp`/`webhookId` is older than 5 minutes, and de-dupe `webhookId` (see 4.3). → folded into the dedup table.

### 4.2 Mapping which venue an event belongs to

GHL payloads carry `locationId`, not our `venue_id`. The handler resolves it: `SELECT venue_id FROM ghl_credentials WHERE location_id = $payload.locationId`. No match → `200 {ignored:true}` (a webhook for a location we don't manage; ack so GHL stops retrying). This lookup is why `ghl_credentials.location_id` carries a unique index.

### 4.3 Idempotency / dedup

New table `ghl_webhook_events` (the GHL analogue of `stripe_events`). Insert `{ webhook_id, type, venue_id }` with `onConflict: webhook_id, ignoreDuplicates: true`; if zero rows returned, it's a duplicate → `200 {duplicate:true}` and stop. GHL's `webhookId` is the dedup key.

### 4.4 Event routing → Inngest

The handler does **no business logic** — it validates, dedups, resolves the venue, then emits an Inngest event and returns `200` fast (so GHL's delivery timeout is never hit; all real work is async). Mapping (note GHL's **PascalCase** event `type` values — also a correction to the dotted names in the plan):

| GHL webhook `type` | Inngest event emitted | Handled by |
|---|---|---|
| `OpportunityStatusUpdate` (status `won`) **or** `OpportunityStageUpdate` (→ "Booked" stage) | `ghl/opportunity-won` | `opportunity-won.ts` (§5) |
| `InboundMessage` | `ghl/message-received` | realtime fan-out (§6.3) |
| `ContactTagUpdate` / `ContactUpdate` | `ghl/contact-updated` | optional sync-polish (§7) — **may be skipped initially** |
| `InvoicePaid` / `InvoicePartiallyPaid` / `InvoiceSent` | `ghl/invoice-updated` | payments refresh (§8) |

`emit` uses `inngest.send({ name, data })` with `data` carrying `{ venueId, locationId, ...rawPayloadSubset }`. **Win detection is double-gated:** GHL fires `OpportunityStatusUpdate` when status flips to `won`, but some venues model "Booked" as a *stage* not a *status*. The handler treats either as a win, and the Inngest function re-confirms via the API (§5.2) so a stray webhook can't create a phantom wedding. → **OQ-2** (confirm with Mando whether the test sub-account's pipeline uses won-status or a Booked stage).

### 4.5 Per-venue webhook auto-registration on connect

GHL webhooks are configured **per marketplace app**, not per-API-call — so in **OAuth/marketplace mode** the webhook URL is set once in the app config and fires for every installed location automatically; no per-venue registration call exists. In **PIT mode there is no marketplace app**, so inbound webhooks must instead be wired by a **GHL Workflow** in the test sub-account (trigger: opportunity status = Won → "Webhook" action → our URL). 

Practically:
- **Now (PIT, single test sub-account):** Mando builds a GHL Workflow that POSTs to `https://{APP_URL}/api/webhooks/ghl` on opp-won. This is manual one-time setup, documented in the test plan (§12). The Workflow webhook will **not** carry GHL's RSA `x-wh-signature` (that's only on native marketplace webhooks) — so for the PIT phase the route also accepts a **shared-secret header** `x-vf-webhook-secret` (env `GHL_WEBHOOK_SHARED_SECRET`) as the auth path, and uses RSA verification only once we're on the marketplace app. → **Assumption A-2**, and the reason the route supports *two* auth modes.
- **Later (OAuth/marketplace):** webhook URL lives in app config; RSA signature path is authoritative; no per-venue registration code needed. `connect` just stores tokens.

> This is the single biggest plan-vs-reality gap. Calling it out loudly: **the clean "auto-register a webhook per location" the plan imagines only exists in the marketplace-app world; in PIT mode we drive ingress from a GHL Workflow + shared secret.**

---

## 5. Integration Point 1 — Opportunity Won → Wedding Created  *(GHL Phase 1; Slice 2)*

The spine. Booking in GHL creates a real wedding in VF2.

### 5.1 Flow

```
GHL: opportunity → Won
   │  (Workflow webhook in PIT mode / native webhook in marketplace mode)
   ▼
POST /api/webhooks/ghl   → verify · dedup · resolve venue_id · emit ghl/opportunity-won
   ▼
Inngest opportunity-won.ts
   1. (re)fetch opportunity → confirm it is really won  [GET /opportunities/{id}]
   2. fetch contact                                     [GET /contacts/{id}]
   3. idempotency: wedding already exists for this ghl_opportunity_id? → stop
   4. createWeddingFromSource({ source:'ghl', ... })  → weddings row
   5. create couple_accounts (one per partner present)
   6. send portal invite email (Resend, via src/lib/email/send.ts)
   7. write-back: tag GHL contact 'vf2-portal-invited'  [POST /contacts/{id}/tags]
```

**File:** `src/inngest/functions/opportunity-won.ts` (new). Registered in `src/app/api/inngest/route.ts`'s `functions` array (alongside `leadCaptured` etc.). Trigger: `{ event: "ghl/opportunity-won" }`.

### 5.2 The function (step-by-step, replay-safe)

Each numbered action is its own `step.run(...)` so a retry never repeats a side effect (the pattern in `src/inngest/functions/lead-captured.ts`).

1. **`confirm-opportunity`** — `ghlClient(venueId).get('/opportunities/' + oppId)`; bail (return `{skipped:'not-won'}`) if status isn't `won` / stage isn't Booked. Defends against the double-gated webhook (§4.4).
2. **`load-contact`** — `GET /contacts/{contactId}`; extract name(s), email, phone, wedding date (if mapped to a GHL custom field).
3. **`idempotency-check`** — `SELECT id FROM weddings WHERE ghl_opportunity_id = $oppId`. If found → return existing id; **do not** re-create or re-invite. (This is the real idempotency guard; the webhook dedup in §4.3 only stops duplicate *deliveries*, this stops duplicate *outcomes* across distinct webhooks for the same opp.)
4. **`create-wedding`** — call the shared `createWeddingFromSource` action → inserts `weddings` (status `planning`, `venue_id`, `ghl_contact_id`, `ghl_opportunity_id`, couple display fields, `wedding_date`). Uses the **admin client** (service role) because this runs outside any user session.
5. **`create-couple-accounts`** — one `couple_accounts` row per partner with an email. Generates an invite token (magic-link; couple auth is the portal slice, Slice 8 — for now just persist the token + `invited_at`).
6. **`send-invite`** — `sendEmail(...)` with a portal-invite template. Best-effort: a send failure logs but does not roll back the wedding (mirrors the best-effort posture in `lead-captured.ts`).
7. **`tag-ghl-contact`** — `POST /contacts/{contactId}/tags` body `{ tags: ['vf2-portal-invited'] }`. Best-effort; wrap so a GHL hiccup doesn't fail the run.

Return a structured result (`{ weddingId, coupleAccountIds, inviteSent }`) for observability.

### 5.3 Idempotency summary

Three independent guards, by design:
- **Delivery** dedup → `ghl_webhook_events.webhook_id` (§4.3).
- **Outcome** dedup → `weddings.ghl_opportunity_id` unique (step 3 + a DB unique index).
- **Inngest replay** safety → per-step memoisation.

---

## 6. Integration Point 2 — Contact Sync  *(GHL Phase 1/5)*

### 6.1 Link key

The join between a VF2 record and GHL is **`ghl_contact_id`** (and `ghl_opportunity_id`). New columns:

- `contacts.ghl_contact_id text` (nullable, unique per venue → `UNIQUE (venue_id, ghl_contact_id) WHERE ghl_contact_id IS NOT NULL`).
- `opportunities.ghl_opportunity_id text` (same partial-unique shape).
- `weddings.ghl_contact_id` / `weddings.ghl_opportunity_id` (carried so the workspace can reach GHL without a join back through `contacts`).

### 6.2 Read-on-demand (no caching of stale data)

When staff open a contact/wedding in bundled mode, the server component calls `ghlClient(venueId).get('/contacts/' + ghlContactId)` and renders fresh. **Never** persist the full contact back into Supabase — only the link key + the handful of display fields already captured at wedding creation (name, email, phone, wedding date). This is the locked "minimal fields locally, never bulk-mirror" rule.

### 6.3 Tag write-backs

| Moment | Call |
|---|---|
| Portal invite sent | `POST /contacts/{id}/tags` → `{ tags: ['vf2-portal-invited'] }` |
| Couple first logs into portal | `POST /contacts/{id}/tags` → `{ tags: ['vf2-portal-active'] }` |
| (optional) status field | `PUT /contacts/{id}` with mapped custom field |

All write-backs are best-effort and server-side. Use the exact tag strings `vf2-portal-invited` / `vf2-portal-active` (from the brief) so the venue's GHL automations can key on them.

### 6.4 Inbound contact updates (optional, low priority)

`ContactUpdate`/`ContactTagUpdate` webhooks → `ghl/contact-updated`. Because we don't mirror contact data, the only thing worth syncing is the couple's email/phone/wedding-date if they change in GHL after booking. **Deferred** — ship reading-on-demand first; only add this if a real "stale display field" problem appears. → **OQ-3.**

---

## 7. Integration Point 3 — Messaging Mirror  *(GHL Phase 2; Slice 6)*

Ports the demo screen `src/app/(demo)/preview/inbox/inbox-client.tsx` into the **Wedding Workspace** "Messages" tab (scoped to one wedding per **D7**, not a global inbox). Read first, send second, realtime third.

### 7.1 Read threads + messages

- **List conversations for the couple:** `GET /conversations/search?locationId={loc}&contactId={ghlContactId}`.
- **Fetch a thread's messages:** `GET /conversations/{conversationId}/messages`.
- Render in the workspace; **store nothing** in Supabase (GHL is the record of truth — the locked "no message storage in VF2" rule).

### 7.2 Send (reply from VF2)

`POST /conversations/messages` with body `{ type, contactId, message }` (or `{ type:'Email', contactId, subject, html }`). **Important shape correction:** the send endpoint is `/conversations/messages` and takes **`contactId` in the body**, not the `POST /conversations/{conversationId}/messages` path the plan sketched. `type` is one of `SMS` / `Email` / `WhatsApp`. WhatsApp send only works if the venue's GHL has WhatsApp Business approved — otherwise fall back to SMS. → **OQ-4** (carry-over of the plan's open WhatsApp-approval question).

### 7.3 Realtime inbound

- GHL fires `InboundMessage` → our webhook (§4) → emits `ghl/message-received`.
- A tiny handler publishes to a **Supabase Realtime** channel keyed on `wedding_id` (resolve via `ghl_contact_id`).
- The Messages tab subscribes and re-fetches the thread on a ping. No message bodies are stored — Realtime carries only "new message in thread X, go refetch." This keeps the "GHL is record of truth" rule intact.

---

## 8. Integration Point 4 — Invoices  *(GHL Phase 3; Slice 5)*

Ports the demo money screens (`src/app/(demo)/preview/money/page.tsx`, `.../money/_components/proposals-section.tsx`) into the Wedding Workspace "Payments" tab.

| Action | Call |
|---|---|
| Create invoice | `POST /invoices` — body `{ locationId, contactId, name, dueDate, items:[{name,description,quantity,price,currency}] }` |
| Send invoice to couple | `POST /invoices/{invoiceId}/send` |
| Fetch status | `GET /invoices/{invoiceId}` (and/or `GET /invoices?locationId=&contactId=` to list) |

- Map GHL invoice state → the four display statuses **Awaiting Deposit / Deposit Paid / Balance Due / Paid in Full** (a small pure mapper, like `mapStripeStatus` in the Stripe handler).
- **No couple-facing Stripe** through this layer — bank transfer is the norm; put bank details in the invoice `termsNotes`/body. (Stripe in VF2 is SaaS billing only; locked.)
- Optionally drive live status off the `InvoicePaid`/`InvoicePartiallyPaid` webhooks (§4.4 → `ghl/invoice-updated`) so the tab updates without polling; otherwise fetch-on-view.
- Scope: required scope is `invoices.write` (+ `invoices.readonly`). → §9.

---

## 9. Integration Point 5 — Daily Brief data pulls  *(GHL Phase 4; Slice 7)*

**File:** `src/inngest/functions/daily-brief.ts` (new). Scheduled (cron) at **7am venue-local** — derive the cron-per-venue from `venues.timezone` (existing column, default `Europe/London`). Sends via Resend (`src/lib/email/send.ts`).

Data pulls:

| Source | Call / query | Goes into brief as |
|---|---|---|
| GHL pipeline counts + revenue | **see gap below** | "Pipeline at a glance" (counts by stage, £ in pipeline) |
| GHL recent contacts | `POST /contacts/search` (filter `dateAdded gte` today-7d) | "New enquiries this week" |
| GHL recent conversations | `GET /conversations/search?locationId=&limit=` | "Recent messages" |
| VF2 portal activity | Supabase: `couple_accounts.last_login_at`, recent `weddings` updates | "Portal activity" |
| VF2 upcoming deadlines | Supabase: `timeline_events` / run-sheet rows due soon | "Upcoming events" |

### 9.1 GHL gap: no pipeline aggregate endpoint

**GHL v2 has no "give me counts and revenue per stage" reporting endpoint.** The plan's `GET /v2/opportunities?pipelineId=` does not return aggregates — it returns a paginated list of opportunities. Workaround:

1. `GET /opportunities/search?location_id={loc}&pipeline_id={id}&limit=100` and **paginate** (cursor/`searchAfter`) to pull all open opportunities, then **aggregate in our code** (group by `pipelineStageId`, count + sum `monetaryValue`).
2. Cache the aggregate on the daily-brief run (it's a once-a-day job, so the pagination cost is acceptable). Do **not** do this aggregation on every page load.

→ **OQ-5:** for a large pipeline this is N pages once a day — fine at current scale; revisit if a venue exceeds a few thousand open opps.

---

## 10. Required scopes (PIT + OAuth)

The PIT (now) and the OAuth app (later) need the **same** scope set. From GHL's scope catalogue:

| Capability | Scope(s) |
|---|---|
| Opp-won trigger | `opportunities.readonly` (+ `opportunities.write` only if VF2 ever writes opps back — not currently) |
| Contact read + tag/status write | `contacts.readonly`, `contacts.write` |
| Messaging read | `conversations.readonly`, `conversations/message.readonly` |
| Messaging send | `conversations.write`, `conversations/message.write` |
| Invoices | `invoices.readonly`, `invoices.write` |
| Pipeline data for brief | `opportunities.readonly` (already listed) |

**Minimum string for the PIT / OAuth `scope=` param:**
```
contacts.readonly contacts.write
opportunities.readonly
conversations.readonly conversations.write
conversations/message.readonly conversations/message.write
invoices.readonly invoices.write
```
Webhook events ride on these scopes: `OpportunityStatusUpdate`/`OpportunityStageUpdate` need `opportunities.readonly`; `InboundMessage` needs `conversations/message.readonly`; `Invoice*` needs `invoices.readonly`; `ContactTagUpdate` needs `contacts.readonly`.

---

## 11. Plan-vs-reality corrections (read before coding)

The original `GHL-BACKEND-PLAN.md` was written from the call transcript and has three inaccuracies the builder must not copy verbatim:

| Plan said | Reality | Where it bites |
|---|---|---|
| `/v2/contacts/{id}` etc. | Base is `https://services.leadconnectorhq.com` with **no `/v2`** segment; paths are `/contacts/{id}`, `/conversations/messages`, `/opportunities`, `/invoices`. | Every endpoint string. |
| "Validates **HMAC** signature from GHL" | GHL signs with **its own RSA key**; verify with GHL's **public key** + **RSA-SHA256** over the `x-wh-signature` header. There is no shared-secret HMAC for native webhooks. (In PIT-Workflow mode we add our own shared-secret header instead — §4.5.) | The webhook handler. |
| `opportunity.updated`, `conversation.message.received` (dotted) | GHL event `type` values are **PascalCase**: `OpportunityStatusUpdate`, `OpportunityStageUpdate`, `InboundMessage`, `InvoicePaid`, … | Event routing (§4.4). |
| `POST /v2/conversations/{conversationId}/messages` to send | Send is `POST /conversations/messages` with **`contactId` in the body**. | Messaging send (§7.2). |
| `GET /v2/opportunities?pipelineId=` for report counts | No aggregate endpoint exists — paginate `/opportunities/search` and aggregate client-side (§9.1). | Daily brief. |

---

## 12. Error handling, rate limits, retries, server-only boundary

### 12.1 Rate limits

GHL limits per app **per resource** (Location): **100 requests / 10 seconds** (burst) and **200,000 / day**. Headers to watch: `X-RateLimit-Remaining`, `X-RateLimit-Daily-Remaining`, `X-RateLimit-Interval-Milliseconds`.

- `ghlClient` inspects these and, on `429`, does **exponential backoff with jitter**, capped (e.g. 3 retries). Inside an Inngest `step.run`, prefer throwing so Inngest's own retry/backoff handles it (don't sleep the whole function).
- Favour **webhooks over polling** everywhere (the brief is the only intentional batch pull, once/day).

### 12.2 Error taxonomy

| Condition | `ghlClient` behaviour |
|---|---|
| No creds row | throw `GhlNotConnectedError` → callers branch to standalone (§3). |
| `401` (OAuth) | refresh once, retry once; still `401` → throw `GhlAuthError` (creds bad — surface a "reconnect GHL" banner in settings). |
| `401` (PIT) | throw `GhlAuthError` immediately (no refresh possible; PIT was rotated/revoked). |
| `429` | backoff + retry per 12.1. |
| `422`/`400` | throw `GhlValidationError` with GHL's `message[]` body; do not retry (it's our bad request). |
| `5xx` | retry with backoff; then throw `GhlServerError`. |

### 12.3 What is server-only

Everything. `src/lib/ghl/client.ts`, `crypto.ts`, `webhooks.ts` all import `"server-only"`. GHL is reached only from: Inngest functions, `src/app/api/webhooks/ghl/route.ts`, the `connect`/`callback` OAuth routes (later), and server actions/server components. **No GHL token, call, or response with secrets is ever shipped to the client bundle.**

---

## 13. New tables & columns (with RLS pattern)

All follow the established template (`venue_id` FK, RLS via `current_venue_ids()` / `current_owner_or_admin_venue_ids()`, `set_updated_at` trigger, partial-unique on natural keys). Migration file: `supabase/migrations/2026XXXXXXXXXX_ghl_integration.sql` (next timestamp after M6).

### 13.1 `ghl_credentials` (new)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `venue_id` | uuid FK → venues | `ON DELETE CASCADE`; **unique** (one GHL connection per venue) |
| `location_id` | text NOT NULL | GHL sub-account id; **unique** (webhook venue resolution, §4.2) |
| `auth_type` | text NOT NULL | `CHECK (auth_type IN ('pit','oauth'))`, default `'pit'` |
| `access_token` | text NOT NULL | **encrypted blob** (§2.4) — PIT or OAuth access token |
| `refresh_token` | text | encrypted; NULL for PIT |
| `token_expires_at` | timestamptz | NULL for PIT |
| `scopes` | text[] | scopes actually granted (for diagnostics); NULL for PIT. Matches `specs/data-model.md` M7 |
| `created_at` / `updated_at` | timestamptz | `set_updated_at` trigger |

**RLS:** **admin-write-only / service-role pattern** (like `meeting_types` writes + `appointments` inserts). Members may `SELECT` *non-secret* columns only — but since tokens live here, the simplest safe choice is **no authenticated SELECT of token columns at all**: expose connection *status* to the UI via a view or a server action that returns `{ connected, locationId }` only. Concretely: enable RLS, add **no** authenticated `INSERT`/`UPDATE`/`DELETE`/`SELECT` policies (service-role only). The connect flow and `ghlClient` use the admin client. → **Assumption A-3** (status surfaced via server action, not direct table read).

### 13.2 Column additions (existing tables)

| Table | Column | Notes |
|---|---|---|
| `venues` | `ghl_enabled boolean NOT NULL DEFAULT false` | mode flag (§3.1) |
| `contacts` | `ghl_contact_id text` | partial-unique `(venue_id, ghl_contact_id)` |
| `opportunities` | `ghl_opportunity_id text` | partial-unique `(venue_id, ghl_opportunity_id)` |

### 13.3 `ghl_webhook_events` (new — dedup ledger)

The GHL analogue of `stripe_events`. **Service-role only** (no authenticated policies); RLS enabled.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `webhook_id` | text NOT NULL UNIQUE | GHL `webhookId`; the dedup key (§4.3) |
| `venue_id` | uuid FK → venues | resolved from `location_id` |
| `type` | text NOT NULL | GHL event type |
| `received_at` | timestamptz NOT NULL DEFAULT now() | for replay-age checks + cleanup |

> `weddings` / `couple_accounts` columns (`ghl_contact_id`, `ghl_opportunity_id`, invite tokens, etc.) are **owned by the Slice-2 weddings spec**, not this one. This spec only asserts they must carry the two GHL link keys.

---

## 14. Files to create / touch

| Path | New? | Purpose |
|---|---|---|
| `src/lib/ghl/client.ts` | new | `ghlClient(venueId)`, header/auth/retry, `getVenueMode` |
| `src/lib/ghl/crypto.ts` | new | AES-256-GCM `encryptToken`/`decryptToken` |
| `src/lib/ghl/webhooks.ts` | new | RSA signature verify + shared-secret verify + event→Inngest mapping |
| `src/lib/ghl/types.ts` | new | GHL response/payload types |
| `src/app/api/webhooks/ghl/route.ts` | new | ingress handler (verify · dedup · resolve · emit) |
| `src/inngest/functions/opportunity-won.ts` | new | IP-1 |
| `src/inngest/functions/daily-brief.ts` | new | IP-5 |
| `src/app/api/inngest/route.ts` | touch | register the two new functions |
| `src/app/(app)/settings/page.tsx` | touch | add "GHL connection" tile |
| `src/app/(app)/settings/ghl/page.tsx` (+ `actions.ts`) | new | connect/disconnect UI (PIT paste now; OAuth button later) |
| `src/app/api/ghl/{connect,callback}/route.ts` | new (later) | OAuth init + token exchange — deferred to OAuth phase |
| `supabase/migrations/2026XXXXXXXXXX_ghl_integration.sql` | new | §13 schema |
| `.env.example` | touch | `GHL_TOKEN_ENCRYPTION_KEY`, `GHL_WEBHOOK_SHARED_SECRET`, `GHL_WEBHOOK_PUBLIC_KEY`, (later `GHL_CLIENT_ID`/`GHL_CLIENT_SECRET`) |

---

## 15. Test plan — against the single PIT test sub-account

**What Mervin/Mando must provide before any of this can be exercised end-to-end:**

1. **A GHL Private Integration Token** for the test sub-account, created with the full scope set in §10. (Settings → Integrations → Private Integrations → Create → select all listed scopes → copy once.)
2. **The test sub-account `locationId`.**
3. **The test pipeline's `pipelineId`** and the **stage id / status** that means "Booked/Won" (answers **OQ-2**).
4. **At least one test contact** with an email we control, sitting on an opportunity we can drag to Won.
5. Confirmation of whether **WhatsApp Business is approved** on that sub-account (answers **OQ-4**); if not, messaging tests are SMS/email only.

**Setup steps (one-time, PIT phase):**
- Insert the encrypted PIT into `ghl_credentials` for the demo venue (`auth_type='pit'`, `location_id`, scopes). Flip `venues.ghl_enabled = true`.
- In GHL, build the opp-won **Workflow** → Webhook action → `https://{APP_URL}/api/webhooks/ghl`, adding header `x-vf-webhook-secret: {GHL_WEBHOOK_SHARED_SECRET}` (§4.5).

**Test cases:**

| # | Action | Expected |
|---|---|---|
| T1 | `ghlClient(venueId).get('/contacts/{id}')` from a scratch server action | 200 + contact JSON (proves auth + headers + base URL). This is the **Slice-1 first-visible-win** check. |
| T2 | Read GHL pipeline into the staff app | live contacts/opps render (Slice 1). |
| T3 | Drag the test opp to Won | webhook hits route → `ghl/opportunity-won` → one `weddings` row + `couple_accounts` + invite email; `vf2-portal-invited` tag appears on the GHL contact. |
| T4 | Re-fire the same Won webhook (replay) | **no** second wedding, **no** second email (dedup §4.3 + outcome guard §5.3). |
| T5 | Send a webhook with a bad/missing signature (or wrong shared secret) | `401`, nothing created. |
| T6 | Send a webhook for an unknown `locationId` | `200 {ignored}`, nothing created. |
| T7 | Manual "Create wedding" with `ghl_enabled=false` | wedding created via the same action, **no** GHL calls (proves D6 standalone fallback). |
| T8 | Open the wedding's Messages tab | GHL threads for that contact render; send a reply → appears in GHL. |
| T9 | Inbound message from the test contact | `InboundMessage` webhook → Realtime ping → tab refetches. |
| T10 | Create + send an invoice | invoice appears in GHL, status maps to "Awaiting Deposit". |
| T11 | Run `daily-brief` manually | email arrives with pipeline counts (aggregated client-side, §9.1) + VF2 portal section. |
| T12 | Revoke the PIT in GHL, retry T1 | `GhlAuthError`, settings shows a "reconnect" banner — no crash. |

---

## 16. Open decisions (flagged, not guessed)

- **OQ-1** OAuth refresh concurrency: advisory-lock vs `FOR UPDATE` on the creds row. Irrelevant until OAuth phase; pick when we leave PIT.
- **OQ-2** Does the test sub-account model "Booked" as opportunity **status=won** or as a named **stage**? Determines the webhook filter and the §5.2 confirm logic. (Mando.)
- **OQ-3** Build the inbound `ContactUpdate` sync now, or defer until a stale-display-field problem actually appears? Recommended: defer.
- **OQ-4** WhatsApp Business approval on the test sub-account — gates whether messaging send can use WhatsApp or SMS only. (Carry-over from `GHL-BACKEND-PLAN.md` OQ-1.)
- **OQ-5** Daily-brief pipeline aggregation paginates all open opps once/day — fine now; set a ceiling before a venue's pipeline gets large.
- **OQ-6** Encryption backend: app-layer AES-256-GCM (this spec's assumption A-1) vs Supabase Vault/pgsodium. Decide before writing `crypto.ts`.

## 17. Assumptions made

- **A-1** Token encryption is app-layer AES-256-GCM keyed by `GHL_TOKEN_ENCRYPTION_KEY`; column shape is encryption-backend-agnostic so OQ-6 can change the mechanism without a migration.
- **A-2** In PIT phase, ingress is driven by a GHL **Workflow webhook + shared-secret header**, because native RSA-signed webhooks only exist for marketplace apps. RSA verification becomes authoritative at the OAuth/marketplace cutover; the route supports both auth modes.
- **A-3** `ghl_credentials` is service-role-only (no authenticated SELECT); the UI learns connection status via a server action returning `{ connected, locationId }`, never by reading token columns.
- **A-4** The mode flag is `venues.ghl_enabled boolean` (brief permitted either this or a mode setting); bundled requires the flag **and** a creds row.
- **A-5** `weddings` / `couple_accounts` table definitions are owned by the Slice-2 spec; this spec only mandates the two GHL link-key columns on them.
