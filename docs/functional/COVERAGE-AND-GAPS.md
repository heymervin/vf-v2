# VenueFlow — Coverage & Gaps

A plain-English confirmation of where VenueFlow stands today: what is built and documented, what couples and venue staff can actually do right now, and an honest account of what is still to come. No technical knowledge needed.

**In one line:** Every screen and behind-the-scenes job in the live app is documented and accounted for — the enquiry-to-brochure spine works end to end today; the remaining items are a sequenced roadmap (nurture emails, appointments, reports) plus a short list of small rough edges worth deciding on before launch.

---

## A. Coverage — is everything documented?

We checked every working part of the app against these specification documents. **Every single surface is documented.** Nothing in the live app is undocumented, and there are no specification documents describing features that don't exist.

- **Pages checked:** 16 — all documented
- **Behind-the-scenes routes & jobs:** 5 — all documented
- **Actions (the things buttons actually do):** 10 — all documented
- **Undocumented surfaces:** none
- **Documents describing non-existent features:** none

In short: what you read in the functional specs is what the app actually is. You can confirm the product by reading the docs.

---

## B. The couple's experience

### What a couple can do today

- Visit a venue's enquiry page at its own web address and see the venue's logo, name, and a warm "Wedding enquiry" header.
- Fill in an enquiry: first name and email are required; partner name, phone, guest count, wedding date, a "my date is flexible" toggle, and a free-text message are all optional.
- Fill in that same form **embedded inside the venue's own website**, with no VenueFlow branding around it.
- Have where-they-came-from details (campaign, referrer, etc.) captured silently — they never see or fill this in.
- Enquire with confidence: the enquiry is always saved first, so it can never be lost even if a later step hiccups.
- Re-enquire later with the same email and be recognised as the same couple — no duplicates.
- See an instant "Thank you — your brochure is on its way" confirmation with their email address shown back to them.
- Receive an automatic brochure email that looks like it came from the venue (venue name, venue's reply-to address), with a single "Download the brochure" button — **if the venue has uploaded a brochure**.
- Download the brochure by clicking that email link; the link keeps working while the brochure is live, and each click creates a fresh, secure, short-lived download.

### What's coming for couples

- **Self-service viewing booking** (planned, M5) — a couple booking their own site visit from a link. Today only staff record viewings, by moving the couple's card on the pipeline.
- **Viewing reminders and confirmations** (planned, M5) — reminder and confirmation emails around an appointment. None are sent today.
- **Nurture follow-up emails** (planned, M4) — a short automated follow-up sequence after the brochure. Today the brochure email is the only automated email a couple receives.

### Worth deciding (couple-facing)

- **The "your brochure is on its way" promise when there is no brochure.** If a venue hasn't uploaded a brochure, the couple still sees that message but no email arrives. This is a real gap — the couple is told something that isn't true. Worth deciding how to handle (e.g. soften the wording, or require a brochure before the form goes live).
- **Unsubscribe / opt-out.** There's no unsubscribe link today. With only one transactional brochure email this is minor, but once follow-up emails (M4) land it becomes a UK PECR/GDPR requirement. Worth planning alongside M4.
- **Spam protection beyond the basics.** The form has a hidden bot-trap and a per-visitor rate limit, but no CAPTCHA. Whether that's enough for launch is a call to make.

### Intentionally not part of the couple experience

These are deliberate product decisions, not missing work. VenueFlow is a per-venue CRM, not a couple-facing marketplace.

- **Venue discovery / a directory to browse venues** — couples reach a venue only via a direct link or the venue's own embedded form.
- **A couple account or portal** — the couple experience is intentionally a one-way enquiry plus the brochure email.
- **The in-person tour, "date on hold", and final booking** — these happen offline or are staff-side pipeline stages; there's no couple-facing software step by design.
- **Custom enquiry-form fields, file uploads, multiple date options** — the field set is deliberately fixed to maximise conversion.
- **A download receipt to the couple** — downloads are counted for the venue, not reported back to the couple.

---

## C. The venue admin experience

### What an admin can do today

- Sign up, log in (password or magic link), confirm their email, and sign out.
- Onboard a brand-new venue through a 3-step wizard: venue name, web-address, timezone and optional logo; a first space with capacity and description; and opening hours (or skip to sensible Mon–Sat 9–5 defaults).
- Resume an interrupted onboarding, and get a 14-day trial stamped on the venue automatically.
- Work the pipeline: drag couples' cards across the 8 fixed stages and peek at the details of each.
- Manage contacts fully: create, edit, delete, and view a contact's detail page.
- Get the public enquiry-form link, copy a ready-made embed snippet for their website, and preview the live form.
- Upload or replace the single active brochure PDF (owners/admins only), and see its download count and last-download date.
- See the dashboard summary after login, and the placeholder Appointments and Reports pages.

### What's coming for admins

- **Appointments & scheduling** (planned, M5) — viewings and calls against staff availability, with the pipeline updating automatically. The page is a "coming in M5" placeholder today.
- **Reports & analytics** (planned, M6) — conversion funnel, bookings over time, enquiry-to-booking rates. The page is a "coming in M6" placeholder today.
- **Nurture sequence editor** (planned, M4) — editing the content of the 3 fixed follow-up steps. The sequence engine itself is also part of M4.
- **Email identity settings UI** (planned) — the from-name and reply-to are already used when sending, but there's no screen yet to change them.
- **Venue switcher** (planned) — the behind-the-scenes logic to switch venues is built and tested; the on-screen control isn't added yet.
- **Live dashboard metrics** (planned, post-M3) — the dashboard shows a getting-started panel today, not live numbers.

### Worth deciding / genuinely missing (admin-facing)

These are real gaps that aren't on the milestone plan and aren't deliberate exclusions. Most are small and fixable before or shortly after launch.

- **Editing venue profile, hours and spaces after onboarding.** The data and permissions exist, but there's no screen to change a venue's name, logo, timezone, hours, or spaces once setup is done. Hours change seasonally, so this is a basic operational need.
- **Team members & invites.** The roles model (owner/admin/member) exists and is enforced, but there's no screen to invite or manage staff — roles can only be set during onboarding.
- **Enquiry-form intro/heading copy.** The form's intro copy is meant to be venue-editable, but the settings page is read-only (link + embed only). (Note: changing *which fields* appear is intentionally fixed — that part is by design.)
- **Restore a mis-archived lead.** There's no "unarchive" action.
- **Brochure history / cleanup.** Replaced brochures are deactivated but never deleted; there's no view of past uploads or storage usage.
- **A confirmation/reminder email for staff-booked appointments.** Even before M5's self-service booking, a couple gets no email when staff record a viewing today.
- **A few onboarding rough edges.** The "owner is still setting up" screen a team member sees doesn't update live (manual refresh needed), and a failed logo upload gives no feedback or retry.

### Intentionally not part of the admin experience

Deliberate product decisions — these are features VenueFlow replaces with one opinionated default, which is exactly what keeps venues out of the GoHighLevel "configure everything" maze.

- **Custom, renamed, or added pipeline stages** — the 8 stages are the fixed spine that reports, stop-rules and booking automation depend on. (Renaming labels is a possible post-launch "maybe"; adding stages is a firm no.)
- **A sequence/workflow builder** — venues edit the content of the 3 fixed follow-up steps, not build new ones or branching logic.
- **A contact field builder** — the contact schema is fixed; a custom field is the one-off escape hatch.
- **Extra meeting types beyond viewing + call.**
- **Per-venue custom sending domain / DKIM** — all email shares one VenueFlow sending domain, with display-name and reply-to configurable per venue.
- **Show/hide toggles and brand styling on the embedded form** — the embed inherits the host site; no colour/font/layout controls.
- **Self-serve billing / Stripe checkout** — VenueFlow is operator-provisioned (TWM sets venues up and supports them). A trial date is stamped but never enforced. Self-serve billing would be a new milestone if ever wanted.

---

## D. Gaps grouped

### On the roadmap (planned, sequenced delivery)

The foundation was deliberately built first so each of these lands on solid ground.

- **M4 — Nurture sequences:** a 3-step automated follow-up after enquiry, with venue-editable subjects, bodies, delays and on/off per step.
- **M5 — Appointments & booking:** self-service slot picker, viewing-vs-call meeting types, availability from venue hours, calendar integration, confirmation + reminder emails, and automatic pipeline syncing.
- **M6 — Reports & analytics:** conversion funnel, bookings over time, revenue trends, date filters, optional export.
- **Post-M3 — Live dashboard metrics:** real KPI cards (leads this month, upcoming tours, conversion rate).
- **Supporting UI already half-built:** email identity settings screen, venue switcher control, team-invite management, role-based screen gating, and a post-onboarding business-hours editor.
- **Billing:** Stripe is referenced and a trial date exists, but checkout, subscriptions and enforcement are not wired (only if self-serve billing is ever wanted).

### Intentionally out of scope (by design)

Not missing — deliberately replaced with an opinionated default:

- Custom / renamed / added pipeline stages (the 8-stage spine is fixed).
- A drag-and-drop sequence or workflow builder.
- A contact field builder (custom field is the escape hatch).
- Additional meeting types beyond viewing + call.
- Per-venue custom sending domain / DKIM.
- Form field show/hide toggles, and visual/brand customisation of the embedded form.
- Couple-facing discovery/marketplace and a couple account/portal.
- Glassmorphism, gradient text, and bouncy animations (a deliberate design rule, not a gap).

### Worth deciding (genuinely open, not yet on a plan)

Small, candid items to address before or shortly after launch:

- Business-hours (and profile/spaces) editing after onboarding.
- Team-member invites & management screen.
- Enquiry-form intro/heading copy editing.
- Unsubscribe / opt-out — required once M4 follow-up emails ship.
- CAPTCHA / stronger bot protection on the public form.
- The "your brochure is on its way" message when a venue has no brochure.
- Unarchive a mis-archived lead.
- Brochure version history / deletion / storage cleanup.
- Confirmation/reminder email for staff-booked appointments (a manual-trigger version, ahead of M5).
- Marketing landing page is incomplete — the "Get started" buttons have no destination; it's the public front door and isn't client-ready.
- Live update on the team-member waiting screen, and error feedback on failed logo upload.

---

*This report is generated from a code-surface coverage audit plus couple-side and admin-side capability audits, framed against the documented product scope (PRODUCT.md, ARCHITECTURE.md, and the functional specs in this folder).*
