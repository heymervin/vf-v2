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

## Brand Personality

Warm, crisp, dependable. The TWM "Pulse" character — candy-pastel accents on deep navy, playful but disciplined — applied to a tool that must feel calm under enquiry volume. Celebratory where the domain earns it (a wedding booked is a big deal), quiet everywhere else. Voice: plain-spoken, encouraging, never corporate, never cutesy.

## Anti-references

- **GoHighLevel's admin** — the config maze VenueFlow exists to delete. No nested settings labyrinths, no 23 custom fields, no workflow spaghetti exposed to the user.
- **Sonas** — dated, utilitarian, form-heavy event software. VenueFlow must feel a generation newer.
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
