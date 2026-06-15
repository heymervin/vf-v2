# Product

## Register

product

## Users

- **Venue sales managers and owners** (teams of 1–10) at independent UK wedding venues. They live in the pipeline: triaging enquiries between viewings, on a laptop in a bright office or an iPad walking the grounds. Their job: convert an enquiry into a booked wedding date, fast, without losing anyone in the cracks.
- **Venue staff / coordinators** who host viewings and calls — they need today's appointments and the contact's story at a glance.
- **Couples** (indirect users) who hit the public surfaces: the embedded enquiry form, the brochure email, the booking widget. They never see the app; they see the venue's front door.
- **The Wedding Marketers** (operator) provisioning and supporting venues.

## Product Purpose

VenueFlow is a self-serve, multi-tenant CRM for wedding venues — the productized replacement for the agency-configured GoHighLevel system TWM runs per venue today. It captures source-tagged leads, auto-delivers brochures, nurtures with a fixed 3-step email sequence, books viewings and calls against real staff availability, and tracks everything through a fixed 8-stage pipeline to "Wedding booked."

Success looks like: a venue self-onboards in under 15 minutes, every enquiry gets a brochure within a minute, no lead ever goes unanswered, and the sales manager trusts the kanban as the single source of truth. Domain: **venueflow.io** (app), **mail.venueflow.io** (shared sending domain).

> **v1 (built, M0–M7) vs v2 vision.** The above describes what ships today: the sales-funnel CRM (enquiry → "Wedding booked"). The **v2 vision** — see *The Combined Platform* below — extends VenueFlow across the *entire* wedding lifecycle: it absorbs the rest of the per-venue GoHighLevel stack (multi-channel comms: Email + SMS + WhatsApp) **and** the post-booking event-management domain currently owned by tools like Sonas (proposals, payments, run-sheets, seating, menus, suppliers, a couple portal). One record, one platform, enquiry → event day → archive.

## Brand Personality

Warm, crisp, dependable. The TWM "Pulse" character — candy-pastel accents on deep navy, playful but disciplined — applied to a tool that must feel calm under enquiry volume. Celebratory where the domain earns it (a wedding booked is a big deal), quiet everywhere else. Voice: plain-spoken, encouraging, never corporate, never cutesy.

## Anti-references

- **GoHighLevel's admin** — the config maze VenueFlow exists to delete. No nested settings labyrinths, no 23 custom fields, no workflow spaghetti exposed to the user.
- **Sonas** — dated, utilitarian, form-heavy event software. VenueFlow must feel a generation newer. In v2 we don't just avoid Sonas — we **enter its domain and beat it**: same event-management capability, a generation newer in UX, and fused to a real sales CRM Sonas never had.
- **Generic SaaS dashboard clichés** — hero-metric cards, identical icon+heading+text card grids, gradient-text headings, decorative glassmorphism. None of it.

## Design Principles

1. **The pipeline is the product.** The kanban must be the clearest, fastest screen in the app; everything else supports it.
2. **Speed to lead.** Public capture surfaces (form, booking widget) are zero-friction, fast-loading, and look like the venue's best self — not like software.
3. **Calm under volume.** Dense data, light chrome. Color marks state and action, never decoration. A 200-card column should feel orderly, not noisy.
4. **One brand, two audiences.** Staff app: efficient, familiar, best-tool patterns (Linear/Notion fluency). Couple-facing public pages: warmer, more generous spacing, the venue's name forward.
5. **Earned familiarity.** Standard affordances everywhere — same button vocabulary, predictable navigation, no invented controls. Delight is saved for moments (a booked wedding), not pages.

## Configurability

The governing rule: **venues configure their content and identity; they never configure structure or logic.** Opinionated structure is the product — it is what replaces GoHighLevel's config maze. Adding a settings toggle is a cost (every option is a decision the venue must make and we must support), not a feature.

**Venue-configurable (content + identity):**
- Venue profile: name, logo, timezone, opening hours
- Spaces (names, capacities, description)
- Team members + roles
- Brochure PDF (one active)
- Email identity: from-name + reply-to (`venue_email_settings`)
- Nurture sequence *content*: subjects, bodies, delays, on/off (3 fixed steps — no builder)
- Staff availability + per-meeting-type duration/buffer
- Public form intro/heading copy

**Deliberately fixed (the opinionated spine — do not make configurable):**
- The 8 pipeline stages (the state machine reports, sequences, and booking all depend on)
- The 3-step sequence *structure* (no sequence builder)
- The 2 meeting types as a *set* (viewing + call; tune their settings, don't invent new ones)
- The contact field schema and the public form's field set (`custom jsonb` is the escape hatch, not a field-builder)
- The brand / visual system and form colors (the embed is transparent and inherits the host site)

**Gray-zone calls (decided, revisit only post-launch):** stage *renaming* (labels only, states fixed) — maybe later; form field show/hide toggles — hold the line; adding a pipeline stage — hard no (breaks reports, stop-rules, booking automation).

When a venue asks for a new toggle, the default answer is no: find the opinionated default that makes the toggle unnecessary.

## Accessibility & Inclusion

- WCAG 2.1 AA across app and public surfaces.
- 44px minimum touch targets; 16px input font-size on mobile (iOS no-zoom).
- `prefers-reduced-motion` honored: all non-essential animation disabled.
- Color never the sole carrier of pipeline state (stage names always visible).
- Public form/booking pages must work on cheap Android phones over venue Wi-Fi.

---

# The Combined Platform (v2 vision)

> Status: **conceptual / roadmap.** v1 (M0–M7) is built and live. This section defines where VenueFlow goes next. A navigable, seeded prototype of these surfaces lives at **`/preview`** (no login) so the vision can be seen before it is built.

## The thesis: one record, the whole journey

A wedding venue runs on two systems today and they don't talk:

1. A **sales/marketing engine** — for TWM venues, a hand-configured GoHighLevel: lead capture, pipelines, contact management, and multi-channel follow-up (Email + SMS + WhatsApp).
2. An **event-management engine** — a Sonas-class tool for everything *after* the booking: contracts, payments, run-sheets, floor plans, guest lists, menus, suppliers, and a couple-facing portal.

Neither competitor crosses the line. **GoHighLevel has the front of the funnel but no event management. Sonas has event management but a weak, dated, form-heavy CRM front.** Staff re-key data across both, couples get a fragmented experience, and the venue pays for two products.

**VenueFlow v2 is the only continuous spine:** a single record travels enquiry → contact → booking → wedding workspace → event day → archive, with no re-keying and no tool-switching. Every screen is calm, glanceable, AI-assisted and mobile-first (Linear/Notion-grade), where Sonas is utilitarian and GoHighLevel is a config maze. We win the front *and* the back, and we win on modernity at both ends.

## How we beat each competitor

| | GoHighLevel | Sonas | **VenueFlow v2** |
|---|---|---|---|
| Lead capture & pipeline | ✅ (config maze) | ⚠️ weak | ✅ opinionated, zero-config |
| Email / SMS / WhatsApp | ✅ (clunky) | ⚠️ email only | ✅ one unified inbox |
| Nurture automation | ✅ (spaghetti builder) | ⚠️ basic | ✅ opinionated, multi-channel |
| Proposals / e-sign / payments | ⚠️ generic | ✅ | ✅ wedding-native |
| Run-sheet / floor plan / menus | ❌ | ✅ (dated) | ✅ a generation newer |
| Couple portal | ❌ | ✅ | ✅ templated, white-labeled |
| AI copilot | ⚠️ bolt-on | ❌ | ✅ lifecycle-native |
| Modern, intuitive UX | ❌ | ❌ | ✅ the whole point |

## The module map

Built today (**v1, M0–M7**): lead capture form · brochure delivery · fixed 3-step email nurture · booking widget (viewings + calls) · 8-stage kanban pipeline · contacts · appointments · dashboard · reports · Stripe billing/trial.

Added in **v2 (M8+)**, in four bands:

### ① Sales & Marketing engine — *absorb GoHighLevel, beat it on simplicity*
- **Unified Inbox** — Email + **SMS + WhatsApp** in one threaded, per-contact timeline. The biggest capability gap v1 has today (email-only). Channel auto-selected, quick templates, AI-drafted replies.
- **Native SMS + WhatsApp** — Twilio + WhatsApp Business API. WhatsApp is the dominant couple channel in the UK wedding market.
- **Multi-channel nurture** — the *opinionated fixed sequence stays* (no builder); each step can now fire Email/SMS/WhatsApp. A content change, not a structure change.
- **AI lead intelligence** — auto-summarize an enquiry, draft the first reply, score the lead (date proximity, budget, guest count, responsiveness), surface the next-best action.

### ② Booking → Contract → Money — *the bridge where lock-in begins*
- **Proposals / quotes** — branded, itemized (package + add-ons), accepted online.
- **E-sign contracts** — booking agreement + T&Cs, digital signature, audit trail.
- **Deposits + payment schedules** — milestone payments (deposit → interim → final balance) with automatic cross-channel reminders, Stripe.
- **Invoicing + accounting sync** — Xero / QuickBooks.

### ③ Event Management engine — *enter Sonas's domain, a generation newer*
- **The Wedding Workspace** — on "Wedding booked," the record graduates into a planning workspace: the core new object. Countdown, payment status, task checklist, key facts, links to every planning tool.
- **Run-sheet / timeline** — the day's schedule and supplier arrival times, drag-to-build.
- **Floor plans & seating** — visual layout designer; drag guests to tables.
- **Guest list + RSVPs** — dietary/allergen capture, +1s, table assignment.
- **Menu & catering** — menu options, per-guest choices, automatic allergen rollup and kitchen counts.
- **Bar / drinks packages**.
- **Suppliers / vendors + Document hub** — vendor directory, assign-to-event, share the run-sheet, central contracts/insurance/docs.

### ④ Couple Portal — *the relationship layer (Sonas's real stickiness)*
- A white-labeled, identity-skinned portal where couples **pay balances, sign, choose menus, build their guest list + seating, view the timeline, and message the venue.**
- It is the **data front door** for the whole event-management band: couples enter their own guests/menus/seating, so staff don't re-key and the kitchen counts / allergen rollups have a source.

### ⑤ Cross-cutting
- **AI Wedding Copilot** — staff ask "what's left to confirm for the Hendersons?", auto-draft messages, surface at-risk bookings. Neither competitor has this.
- **Full-lifecycle reporting** — lead-source ROI → conversion → revenue → event delivery, end to end.
- **Event-day mobile mode** — run the day from an iPad: today's run-sheet, guest counts, supplier check-in.

**Deliberately cut:** kitchen **stock / provisioning / inventory** (Sonas's deepest ops feature). It pulls VenueFlow toward catering-ERP territory and away from "calm + opinionated." Venues with serious kitchens already run dedicated software.

## Configurability — the rule extends, it does not bend

The v1 governing rule still holds for every new module: **venues configure content + identity, never structure or logic.** Going end-to-end does **not** mean adding builders.

- Event-day structures (run-sheet sections, seating, menus) are **opinionated templates the venue fills in** — not layout/field builders.
- The couple portal is **templated and identity-skinned**, not a page builder.
- Automations are **opinionated triggers** ("booking confirmed → schedule the payment reminders"), never a GoHighLevel-style workflow canvas.
- One philosophy refinement, forced by the couple portal: the v1 rule *"couples never see the app"* was true when VenueFlow was sales-only — there was nothing for a couple to do pre-booking. **Refined rule: couples never see the sales/CRM app; after booking they get a dedicated, templated planning portal.** The opinionated stance is unchanged; only the audience surface grows.

When a venue asks for a new toggle, the default answer is still no.

## Roadmap (M8+)

| Milestone | Band | Ships |
|---|---|---|
| **M8** | ① | Native SMS + WhatsApp · **Unified Inbox** · multi-channel nurture |
| **M9** | ② | Proposals · e-sign · deposits & payment schedules · accounting sync · minimal "pay & sign" couple link |
| **M10** | ③ | **Wedding Workspace** · run-sheet/timeline · guest list · menu & allergens |
| **M11** | ③ | Floor plans & seating · suppliers · document hub |
| **M12** | ④ | Full **Couple Portal** (planning) |
| **M13** | ⑤ | AI Wedding Copilot · full-lifecycle reporting · event-day mobile mode |

**Sequencing rationale:** comms first (M8) — it benefits *every* contact, not just booked ones, and closes the most painful gap today. Money before event-ops (M9 before M10–11) — highest lock-in per unit of build, and closest to what's already built. The couple portal is **split**: a "pay & sign" link rides on the M9 money work; the full planning portal (M12) lands only once the event objects (M10–11) exist for it to expose.

## Admin / setup surface

Every module above has a **content/identity config side** — the opinionated setup a venue does once. It lives as a grouped settings shell (`/preview/admin` in the prototype; `(app)/settings` in the real app) covering: venue profile & brand · **Spaces** (areas + capacities) · **floor/table templates** per space · **menu library** · **packages & price list** · **team & roles** · **custom fields** (the bounded escape-hatch) · messaging identity (SMS/WhatsApp) · email identity · nurture content · forms · availability · brochure · stage labels · billing. Still no structure/logic builders — the 8 stages, 3-step sequence, and 2 meeting types stay fixed.

## UX spec

Detailed per-module UX/UI improvements, the shared component system, mock-data extensions, and the full admin IA live in **`UX-SPEC.md`** (synthesized from a 14-module design-expert critique + competitor research).
