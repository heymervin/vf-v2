# UX-SPEC.md — VenueFlow v2 prototype, UX/UI upgrade pass

Synthesis of a 14-module design critique (one UX/product expert per module +
web research on couple portals and venue reporting). Drives the second build
pass on the `/preview` prototype. Honors `DESIGN.md` and the `PRODUCT.md`
governing rule: **venues configure content + identity, never structure or
logic — opinionated templates, never builders.**

> Status: spec → in build. Source critiques returned 2026-06-15. Priorities:
> **P0** (must, this pass) · **P1** (should) · **P2** (later).

---

## 0. Design refinements (apply everywhere)

The critiques converged on five cross-cutting corrections:

1. **Every list is a tool, not a viewer.** Search + filter + sort + (where it fits) saved views are table stakes — they were missing across Inbox, Pipeline, Contacts, Weddings, Guests, Menu, Suppliers.
2. **Kill the "looks very AI" aesthetic.** No sparkle spam, no decorative left-stripes (`border-l-4`), no marketing copy strips inside the product. The Copilot becomes an *ambient command-bar* + a calm ranked triage list. (`DESIGN.md` already bans side-stripe borders and hero-metric clichés — enforce it.)
3. **Make state real in the demo.** Prefer optimistic client state + a `toast` over inert buttons; check-offs, filters, selections, and tab switches should actually work.
4. **Surface urgency, once.** One "next action / what to do now" signal per workspace beats four identical metric cards (which `DESIGN.md` bans).
5. **Spatial things must look spatial.** The floor plan must draw real table shapes + seats on a room canvas; the run-sheet must have a tablet event-day mode.

---

## 1. Shared component system (build once, use everywhere)

These are the highest-leverage outputs — each upgrades many modules at once. Build in `src/components/` (shared) before the per-module work.

| Component | Purpose | Used by |
|---|---|---|
| **DataToolbar** | sticky row: search input + filter-chip slot + sort + view-toggle + actions (import/export) + result count | Inbox, Pipeline, Contacts, Weddings, Guests, Menu, Suppliers, Reports |
| **SmartListBar** | saved-view tab/pill strip with counts (opinionated presets, not a filter builder) | Contacts, Weddings, Proposals |
| **SortableTable** | shadcn `Table` wrapper: sortable headers, selectable rows (checkbox + select-all), sticky header, footer count | Contacts, Guests, Suppliers, Team, Reports |
| **BulkActionBar** | slides in on selection; slot actions (tag / stage / assign / export); Esc to dismiss | Contacts, Guests, Inbox |
| **TagChip** + **tag system** | pastel-mapped tag pill (VIP=fun-pink, Family=fun-teal, Wedding party=fun-blue, Kids=mint, Supplier=muted, Evening=warning) | Contacts, Guests |
| **MetricCard** | KPI card with delta vs prior period + sparkline + benchmark state | Reports, Overview |
| **NextActionCallout** | one severity-colored "what to do now" panel | Weddings hub, Contacts detail |
| **StatusBadge** set | proposal / supplier / doc / wedding status → Badge variant mapping | Money, Suppliers, Weddings |
| **AssigneePopover** | Popover of TEAM members → assign owner | Inbox, Contacts |
| **EntitySheet** | generic create/edit Sheet (add space / dish / member) | Admin |
| **SettingsShell** | grouped left-rail + content pane + mobile sheet | Admin |
| **AskCopilot** | global ⌘K command-bar (wraps `command.tsx`) — ambient, not a page chat | All modules |
| **ShapedTable / FloorTemplateCanvas** | SVG table shapes + drawn seats on a room canvas | Floor plan, Admin floor config |

---

## 2. Mock-data extensions (additive, backward-compatible)

Extend `src/lib/mock/` — **only add** fields/entities; never rename/remove existing ones (the built modules depend on them). Where a critique suggested mutating a shape (e.g. `VENUE.spaces: string[]`), add a NEW export instead (`SPACES: Space[]`).

**Contacts/CRM:** `Contact.tags[]`, `customFields[]`, `snoozedUntil`, `isArchived`, `assignedAt`, `dateHoldExpiresAt`, `nextAction?`; new `NOTES`, `ACTIVITIES`, contact `TASKS`, `SMART_LISTS`, `VENUE_TAGS`, `CUSTOM_FIELD_DEFS`, `REPLY_TEMPLATES`.
**Proposals/money:** `PRICE_LIBRARY`, `PROPOSAL_TEMPLATES`, `PROPOSALS` (entity w/ status lifecycle), extend `ProposalLine` (category, libraryItemId, unitType, qtyTiedToGuests, discountPct), `VENUE_BILLING`; helpers `proposalSubtotal/applyDiscount/depositAmount/generateSchedule`.
**Weddings:** `portalActive`, `portalLastSeen`, `coordinatorId`, milestone `reminderSent`.
**Run-sheet:** item `done`, `supplierId?`, `notes?`; `Supplier.checkedInAt?`.
**Floor plan:** `FLOORPLAN_TABLES` (`shape: round|banquet|square|top`, `capacity`, `x`, `y`, `label`), `guest.seatIndex`, `Space.roomElements[]` (stage/dancefloor/bar/entrance).
**Guests:** `tags[]`, `householdId/householdName`, `plusOneName`, `sessionType (day|evening|ceremony_only)`, `rsvpChasedAt`.
**Menu:** option `description`, `pricePerHead`, `dietaryTags[]`, `photoUrl`, `sortOrder`, `guestIds[]`; course `sortOrder`, `isActive`, `mealPeriod`; `MENU_LIBRARY`.
**Suppliers:** `WeddingDoc.supplierId/expiryDate/lastChasedAt`, `Supplier.email/website/notes/tags[]`, `PREFERRED_SUPPLIERS`.
**Copilot:** insight `priority`, `signal`, `dueAt?`, `weddingId?`, `actionHref?`, `status?`, `scheduledFor?`; `COPILOT_QUESTIONS` (strip the literal emoji from data).
**Reports:** `REPORTS.periods`, per-KPI `*Prev` + sparkline series, `pacing`, `capacityByMonth`, `seasonality`, `teamPerformance`, `paymentHealth`, sourceRoi `spend/cac`, `BENCHMARKS`.
**Portal:** `wedding.portalTheme`, `guest.mealChoice`, milestone `paidOn/receiptUrl`, doc `downloadUrl/signedBy`, `contractTerms[]`.
**Admin:** `SPACES: Space[]` (capacities, indoor/outdoor, photo), `FLOOR_TEMPLATES`, `MENU_LIBRARY`, `PACKAGES`/price list, team `email/status/roleKey` + `ROLES`/`ROLE_PERMISSIONS`, `CUSTOM_FIELDS`, `COMMS_IDENTITY`, nurture step `channel/smsBody`, `VENUE.stageLabels?`, billing mock.

---

## 3. Per-module improvements

### Unified Inbox
P0: DataToolbar (search + channel/unread filter chips) · saved-view tabs (Mine/All/Unread) · per-row actions (assign/snooze/mark-read) · couple-name links to contact + assign in thread header · quick-reply templates in composer. P1: default composer channel to `lastChannel` · owner filter · unread-first sort · bulk bar. *Refs: Front, Intercom, GHL Conversations, Linear.*

### Pipeline
P0: **pointer click-drag horizontal scroll** (grab cursor) · **list-view toggle** · DataToolbar (filter + search). P1: budget + last-contact recency on cards · count pill on headers · archived column collapsed · CSV import/export. *Refs: Linear, Trello, Notion.*

### Contacts (→ GHL-class)
P0: selectable SortableTable + BulkActionBar · SmartListBar (saved filters) · DataToolbar multi-facet filters · **editable custom fields** on detail. P1: detail tabs (Activity · Conversation · Wedding · Details) · surface live wedding items on booked contacts · tags everywhere · notes/tasks/activity log. *Beat Sonas's modal-everything with inline edit + popovers.*

### Proposals & Payments (+ the Builder — the key ask)
P0: **Proposal Builder** at `/preview/money/proposals/[id]/build` — three-pane: line-item editor (package/add-on groups) + **PriceLibraryPicker** (cmdk) + **CommercialSummary** rail (subtotal, discount, deposit %, VAT, total) with a derived payment-schedule preview; quantities tied to guest count (per-head toggle); Send flow (e-sign + pay CTA → portal). P1: branded couple-facing Preview · promote Money page to a Proposals workspace with status lifecycle (draft/sent/viewed/accepted/expired). *Refs: Qwilr, PandaDoc, HoneyBook, Stripe.*

### Weddings (index + hub)
P0: SmartListBar + search + status filter on index · replace 4-metric row with one status strip · planning-tool launcher → horizontal **PlanningRail** · **NextActionCallout** at top of hub. P1: urgency on index cards (next due + overdue) · contact/inbox cross-link · interactive task toggle · portal-adoption indicator.

### Run-sheet (event-day)
P0: **Event-Day Mode** (tablet-first, NOW/NEXT prominence, big targets) · check-off items + progress strip · supplier quick-contact (tap-to-call) from rows. P1: count board (4 glance numbers) · category filter pills · live clock + countdown. *Refs: Zola for Pros, Linear Today, NN/G touch targets 44–48px.*

### Floor plan (the biggest visual gap)
P0: **per-table shape rendering with drawn seats** (round/banquet/square/top) · spatial canvas reflecting the room (configurable dims + fixed elements: stage/dancefloor/bar) · **drag guests to seats** (dnd-kit) · split layout (canvas + roster). P1: canvas/list toggle · dietary overlay mode · table labels. *Refs: Seating.io, Allseated, Social Tables.*

### Guest list
P0: tag/badge system (VIP/Family/Wedding party/Kids/Supplier/Evening) · text search · column sort · DataToolbar. P1: household/group model · inline table assignment · RSVP-chase (bulk + row) · named +1 · replace "Declined" stat with "Needs table" · URL-persisted view. *Refs: Zola, Joy (RSVP-as-household), Airtable.*

### Menu & catering
P0: extend MenuOption shape (desc/price/dietary/photo/order/guestIds) · DataToolbar (search/filter/sort + **table↔card view toggle**) · dense table view · fix allergen denominator. P1: **photo/card view** · completion bar + outstanding-choices alert · per-dish guest drill-down Sheet · CSV/print export · menu LIBRARY concept. *Natasha's Law: allergens must be easy + visible. Refs: Notion DB views, Apicbase.*

### Suppliers & doc hub
P0: **link docs to suppliers** in the model (collapse docs into expandable supplier rows) · insurance **expiry dates + warnings** · DataToolbar (status/category filters). P1: split compliance vs event-day with Tabs · preferred-supplier directory · last-chased log · one-tap contact. *Refs: Planning Pod, HoneyBook/Dubsado vendor panels.*

### AI Copilot (de-AI it — impeccable lens)
P0: **kill the pinned chatbot**; Copilot becomes a ⌘K **command-bar** (`AskCopilot`) + a calm, ranked, **stripe-free** insight triage list · every insight action **routes** (not toast) + per-insight snooze/dismiss · replace sparkle motif with a restrained brand-native mark · answers render in a **CopilotAnswerSheet** (structured cards), not a chat transcript. P1: "Copilot pulse" one-line summary · confident-colleague voice (no emoji/brochure copy). *Refs: Linear ⌘K, Raycast, Superhuman, Stripe.*

### Reports / dashboard
P0: period + segment toolbar · **MetricCard** with delta + sparkline + benchmark · **forward booking pacing** (the metric venues sell on). P1: date/capacity **utilisation** (prime-Saturday occupancy) · **payment health / AR** · **team performance** table · stage-accurate clickable funnel. P2: seasonality · CAC per source. *Research — what venue owners track: inquiry→booking rate, ABV, **5-min response rule (21× book-rate)**, lead-source ROI, utilisation (booked/available + prime dates), forward pipeline, seasonality (69% May–Nov), payment health. Refs: WeddingPro, Mikla.ai, finmodelslab, Ticket Fairy, exitvalue.ai, HoneyBook, Tripleseat.*

### Couple Portal (the data front door)
P0: a **Home** overview tab (default) · **Menu tab = the couple's own choices** (real per-course selection) · **real guest-list input** · couple-facing **seating view** · **real message thread** (use `getConversation`). P1: per-milestone pay + receipts · proper e-sign + doc hub · structured "Your day" schedule · genuine white-label (logo/accent) · prioritized humanized to-dos. *Research — existing couple portals: **Sonas planning portal**, **HoneyBook client portal**, **Aisle Planner**, **Dubsado**, **Tave**, **Joy/withjoy**, **Zola/The Knot**. Couple expectations baseline: consolidated home, login-less magic link, e-sign, auto deposit/interim/final, household RSVP, meal choice, brand-colored.*

---

## 4. Admin / configuration side (new — explicitly requested)

A grouped **SettingsShell** (left rail + content + mobile sheet) at **`/preview/admin`** (prototype; mirrors the real `(app)/settings`). Content/identity config only — the 8 stages, 3-step sequence, and 2 meeting types stay fixed.

| Screen | Route | Configures |
|---|---|---|
| Venue Profile & Brand | `/preview/admin` (or `/profile`) | name, legal name, logo, accent seed, hours, address |
| **Spaces** | `/preview/admin/spaces` | areas + seated/standing/ceremony capacities, indoor/outdoor, photo |
| **Floor / table template** | `/preview/admin/spaces/[id]/floor` | place tables on a room canvas, set shape + seats (template, not builder) |
| **Menu library** | `/preview/admin/menu` | master dishes/courses, allergens, dietary, photos, price/head |
| **Packages & price list** | `/preview/admin/packages` | packages (per season) + add-ons/drinks, per-head/flat pricing |
| **Team & roles** | `/preview/admin/team` | invite members, role permission matrix |
| **Custom fields** | `/preview/admin/custom-fields` | the bounded jsonb escape-hatch (capped list, not a field builder) |
| **Messaging identity** | `/preview/admin/messaging` | SMS sender + WhatsApp display name + verification status (M8) |
| Email identity · Nurture · Forms · Availability · Brochure · Stage labels · Billing | `/preview/admin/*` | existing v1 settings, folded into the shell; nurture extended to multi-channel content |

*Refs: Tripleseat/Planning Pod (spaces + floorplan config), Apicbase/Access (menu library + allergens), Twilio (WhatsApp verification states), Linear/Notion (grouped settings shell).*

---

## 5. Build sequencing

1. **Foundation** — mock-data extensions + shared components (§1, §2). Verify build before fan-out.
2. **Module upgrades** — parallel, one agent per module, disjoint dirs (§3).
3. **Admin area** — parallel, one agent per settings screen (§4).
4. **Integrate + verify** — typecheck/lint/build, extend e2e for new routes.

*See `PRODUCT.md` for the product vision/roadmap, `DESIGN.md` for the visual system, `PROCESS-MAP.md` for the lifecycle.*
