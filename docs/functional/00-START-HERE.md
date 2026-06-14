# VenueFlow — Functional Specs to Review & Approve

These documents are plain-English descriptions of every page and feature in VenueFlow — what each screen looks like, what it does, and the rules behind it — written so you can confirm it matches what you actually want, no technical knowledge required. Read each one and either tick every item in its "Approve this page" checklist or write your corrections inline. Anything you flag becomes the to-do list before launch.

## How to use these

1. Open each file in order (start at `01-signup-login.md`).
2. Read the "In plain English" summary first, then "What you see / what you can do."
3. Go through the **Approve this page** checklist at the bottom of each doc. Tick every statement that is true; for anything wrong or missing, write the correction right there under "Wrong or missing anything?"
4. Answer the "Open questions for you" where present — these are decisions only you can make.
5. As you go, note each document's build state. Every doc declares its **Status** near the top:
   - **Built ✅** — live and working now; you're approving real behaviour.
   - **Partial ⚠️** — some of it exists, some is still to come; the doc says which is which.
   - **Not built yet (planned) 🔧** — a description of what's intended, for you to approve before we build it.
6. Use the **Review checklist** at the bottom of this page to track which documents you've signed off.

## The big picture

How the pieces fit together — the couple's journey on the right, where you set things up on the left.

```
YOU SET THIS UP (once)
─────────────────────────────────────────────
Onboarding wizard — create your venue
   │
   ▼
Settings — upload brochure + get the
enquiry-form embed code
   │
   ├┄┄▶ powers the public enquiry form
   └┄┄▶ supplies the auto brochure email


THE COUPLE'S JOURNEY
─────────────────────────────────────────────
Couple submits the public enquiry form
   │
   ├─▶ Auto brochure email sent to the couple
   │
   └─▶ Contact + pipeline card created
       at "Inbound enquiry"
          │
          ▼
       Your team works the pipeline
          │
          ▼
       Viewing / appointment booked
          │
          ▼
       Wedding booked
```

## The documents

| # | Document | What it covers | Audience |
|---|----------|----------------|----------|
| 1 | [Sign up & Log in](01-signup-login.md) | Creating an account, signing in (password or magic link), email confirmation | Venue owners & staff |
| 2 | [New-venue onboarding wizard](02-onboarding.md) | First-time setup that creates a brand-new venue | Venue owner / admin |
| 3 | [App shell, navigation & venue switching](03-app-shell-and-navigation.md) | The frame around every page — sidebar, nav, sign-out, switching venues | Logged-in staff |
| 4 | [Dashboard](04-dashboard.md) | The home screen and at-a-glance summary after logging in | Venue staff |
| 5 | [Pipeline (kanban board)](05-pipeline.md) | The drag-and-drop board where leads move from enquiry to booked | Venue staff |
| 6 | [Contacts](06-contacts.md) | The list and detail view of every couple — create, edit, delete | Venue staff |
| 7 | [Appointments](07-appointments.md) | Booking and managing viewings and meetings | Venue staff |
| 8 | [Reports](08-reports.md) | Performance numbers and insights across your pipeline | Staff & owner |
| 9 | [Settings (enquiry form embed & brochure)](09-settings.md) | Upload your brochure and get the code to embed the form on your site | Staff (upload: owners/admins) |
| 10 | [Public enquiry form (couple-facing)](10-public-enquiry-form.md) | The form couples fill in to enquire and request your brochure | Couples (staff receive the leads) |
| 11 | [Automatic brochure email & download](11-brochure-delivery.md) | The brochure email sent automatically after an enquiry, and the download | System & couples |
| 12 | [Marketing landing page](12-marketing-landing.md) | The public VenueFlow page that introduces the product | New visitors / prospects |
| 13 | [Background jobs & system internals](13-system-background-jobs.md) | The behind-the-scenes work (e.g. sending the brochure) you never see | System (automatic) |

## Review checklist

Tick each document once you've read it and either approved every item or written your corrections.

- [ ] 1 — [Sign up & Log in](01-signup-login.md) — Built ✅
- [ ] 2 — [New-venue onboarding wizard](02-onboarding.md) — Built ✅
- [ ] 3 — [App shell, navigation & venue switching](03-app-shell-and-navigation.md) — Partial ⚠️
- [ ] 4 — [Dashboard](04-dashboard.md) — Partial ⚠️
- [ ] 5 — [Pipeline (kanban board)](05-pipeline.md) — Built ✅
- [ ] 6 — [Contacts](06-contacts.md) — Built ✅
- [ ] 7 — [Appointments](07-appointments.md) — Not built yet (planned) 🔧
- [ ] 8 — [Reports](08-reports.md) — Not built yet (planned) 🔧
- [ ] 9 — [Settings (enquiry form embed & brochure)](09-settings.md) — Built ✅
- [ ] 10 — [Public enquiry form (couple-facing)](10-public-enquiry-form.md) — Built ✅
- [ ] 11 — [Automatic brochure email & download](11-brochure-delivery.md) — Built ✅
- [ ] 12 — [Marketing landing page](12-marketing-landing.md) — Partial ⚠️
- [ ] 13 — [Background jobs & system internals](13-system-background-jobs.md) — Built ✅
