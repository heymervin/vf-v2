# New-Venue Setup Wizard

**Where:** `/onboarding`
**Who uses it:** The venue owner (or an admin) setting up a brand-new venue for the first time
**Status:** Built ✅

## In plain English

When someone signs up and hasn't set up a venue yet, this three-step wizard walks them through the essentials: naming their venue, adding their first hireable space, and setting their opening hours. Once they finish (or skip the optional steps), they land on the main dashboard ready to use VenueFlow. If a team member logs in before the owner has finished setup, they see a holding screen rather than an empty or broken dashboard.

## What you see / what you can do

- A two-panel layout on desktop: a branded left side showing encouragement text and the current step number ("Step 1 of 3"), and a clean form on the right
- On mobile the two panels collapse into a single scrollable page with a colour band at the top
- A progress bar across the top of the form area showing three steps — Venue, Space, Hours — with completed steps highlighted in pink
- **Step 1 — Venue profile:** fill in your venue name, a web address (used as your public enquiry link), your timezone, and an optional logo
- **Step 2 — First space:** name your first bookable room or area and (optionally) enter its seated and standing capacities plus a short description; you can skip this step entirely
- **Step 3 — Opening hours:** toggle each day of the week open or closed, and set an open/close time for open days; you can skip this step entirely
- A "Back" button on steps 2 and 3 to return to the previous step
- A "Finish setup" button on step 3 that saves everything and takes you to the dashboard

## How it works, step by step

### createVenueWithProfile

Called when you click "Create my venue" at the end of step 1.

1. You fill in: venue name (2–100 characters), web address/slug (3–50 characters, lowercase letters, numbers, hyphens only), timezone, and an optional logo file.
2. The slug field auto-fills from the venue name as you type — for example "The Grand Hall" becomes "the-grand-hall". You can override it manually.
3. When you submit, the system checks whether a venue was already partially created for your account (a resume scenario). If one exists, it updates that record rather than creating a duplicate.
4. If no partial venue exists, the system creates the venue and assigns you as its owner in the same database transaction. Your venue also gets a 14-day trial period at this point.
5. After the venue is saved, if you uploaded a logo it is uploaded to secure file storage. A failed logo upload does not block you — the venue is already saved and you just won't have a logo yet.
6. The system records that setup has reached step 2, then moves you to the Space step.
7. If the web address you chose is already taken by another venue, you see the message "That web address is taken, try another." and can pick a different one.

### saveSpace

Called when you click "Continue" or "Skip for now" on step 2.

1. If you filled in the space form and clicked "Continue": the system validates the name (required, 2–100 characters), capacities (whole numbers, optional), and description (optional, up to 500 characters), then saves the space linked to your venue.
2. If you clicked "Skip for now, you can add this in Settings": no space is saved, but the step is still recorded as complete so setup can continue.
3. Either way, the system records that setup has reached step 3, then moves you to the Hours step.

### finishHours

Called when you click "Finish setup" or "Skip for now" on step 3.

1. The hours screen shows all seven days of the week (Monday through Sunday). Days always start at the default schedule — Monday–Saturday open 09:00–17:00 and Sunday closed. (Note: hours you enter are not saved until you click "Finish setup"; navigating Back to step 2 and returning resets the hours to the default.)
2. You toggle each day on or off. When you turn a day on, the open and close time fields appear (defaulting to 09:00–17:00). When you turn a day off, the times disappear and it shows "Closed".
3. If you click "Skip for now": the default schedule (Mon–Sat 09:00–17:00, Sun closed) is saved automatically — you are not left with no hours at all.
4. If you click "Finish setup": your current on-screen hour settings are saved.
5. Either way, all seven days are written (or overwritten) to the database in one go, then the venue is marked as setup-complete with a timestamp.
6. On desktop, the left panel briefly animates (a spring pulse, under 560 ms) before you are sent to the dashboard. On mobile or if you have reduced-motion enabled in your device settings, you go straight to the dashboard with no delay.

## Workflow

```
User visits /onboarding
   │
   ▼
Logged in?
   ├─ no  ─▶ Redirect to /login
   └─ yes ─▶ Has a venue?
               ├─ no ─────────────────────▶ Start Step 1
               ├─ yes + setup complete ───▶ Redirect to /dashboard
               ├─ yes + role is member ───▶ Waiting screen:
               │                            owner hasn't finished yet
               └─ yes + owner/admin,
                  setup in progress ──────▶ Resume from saved step
                                               │
                                               ▼  (lands on Step 1)
Step 1: Venue profile
   (submit name, slug, timezone, optional logo)
   │
   ▼
createVenueWithProfile
   ├─ slug taken ─▶ back to Step 1
   └─ saved ──────▶ Step 2: First space
                       ├─ fill in + Continue ─▶ saveSpace (saves space)
                       └─ Skip for now ───────▶ saveSpace (no space saved)
                                                   │
                       (both paths continue) ──────┘
                                                   │
                                                   ▼
                                        Step 3: Opening hours
                                           ├─ Finish setup ──▶ finishHours
                                           │                   (saves your hours)
                                           └─ Skip for now ──▶ finishHours
                                                               (saves Mon-Sat
                                                                9-5, Sun closed)
                                                   │
                       (both paths continue) ──────┘
                                                   │
                                                   ▼
                                        Venue marked complete
                                                   │
                                                   ▼
                                        Brief celebration animation
                                                   │
                                                   ▼
                                        Redirect to /dashboard
```

## Data it touches

- **venues** — created (name, slug, timezone, logo path, trial end date) or updated (name, slug, timezone); `onboarding_step` advances from 1 → 2 → 3; `onboarding_completed_at` is set when setup finishes
- **memberships** — one row is created linking the logged-in user to the new venue with the role "owner"
- **spaces** — one row may be inserted (step 2), linked to the venue
- **venue_hours** — seven rows are written (one per day of the week), linked to the venue; closed days have null times
- **venue-assets storage bucket** — the logo file is uploaded here if provided; stored at `{venueId}/logo.{ext}`

## Rules & edge cases

- Only owners and admins can run the wizard. A user with the "member" role sees a waiting message and a sign-out button instead.
- If you are already a signed-in owner and your venue setup is already complete, visiting `/onboarding` redirects you straight to the dashboard — you cannot re-run the wizard.
- If you started setup, closed the tab, and came back later, the wizard resumes at whichever step you reached. You don't have to start over.
- If the system detects you already have an incomplete venue (for example, the browser lost the session mid-way), it reuses that venue rather than creating a second one.
- The venue web address (slug) must be globally unique — no two venues can share the same slug. If someone else already has your preferred slug, you must choose a different one.
- Slug rules: 3–50 characters, lowercase letters and numbers only, hyphens allowed in the middle but not at the start or end.
- Logo upload is optional and non-blocking — if it fails, the venue is still saved and you land on step 2 as normal.
- Logo files must be PNG, JPG, or WebP and must be 2 MB or smaller.
- Skipping step 3 is not the same as "no hours" — the default Mon–Sat 9 am–5 pm schedule is written automatically.
- You cannot delete a venue through this flow. Venue deletion requires a service-level action (no button exists for it in the UI).
- The "Back" button on steps 2 and 3 returns you to the previous step's form, but does not undo any data that was already saved.

## ✅ Approve this page

Tick each statement if it's correct. These must be concrete, independently true/false behavior claims that together fully describe this surface — phrased so the venue owner can confirm them:

- [ ] When I first sign up and visit the app, I land on the setup wizard — not the dashboard.
- [ ] The wizard has exactly three steps: Venue profile, First space, Opening hours.
- [ ] As I type my venue name, the web address field fills in automatically (e.g. "The Grand Hall" → "the-grand-hall"). I can still type my own web address if I want a different one.
- [ ] If the web address I want is already taken, I get a clear error and can try a different one without losing my other entries.
- [ ] I can upload a logo (PNG, JPG, or WebP, max 2 MB) on step 1. Uploading a logo is not required to proceed.
- [ ] Steps 2 (space) and 3 (hours) each have a "Skip for now" button that lets me complete setup without filling them in. Skipping step 3 still saves a default Mon–Sat 9 am–5 pm schedule.
- [ ] If I close the browser mid-setup and come back, I resume at the step I left off — I don't start over.
- [ ] If a team member who isn't an owner logs in before setup is complete, they see a message saying the venue is still being set up, with only a sign-out button.
- [ ] Once I click "Finish setup" on step 3, I land on the dashboard. On desktop there is a brief animation before the redirect; on mobile I go straight there.
- [ ] After setup is complete, visiting `/onboarding` again redirects me to the dashboard — I cannot accidentally re-run the wizard.
- [ ] The venue is created with a 14-day trial period automatically — I don't need to enter any payment details during setup.

**Wrong or missing anything?** _Write it here:_

## Open questions for you

- Step 2 has no way to pre-fill an existing space if you hit "Back" from step 3 — should it reload whatever was already saved, or is a blank form fine for a re-entry scenario?
- The default hours (Mon–Sat 09:00–17:00, Sun closed) are applied whenever someone skips step 3. Is that the right default for most of your venue clients, or should it be configurable later in Settings?
- The wizard currently supports only one space in step 2. Is that intentional for v1, with the expectation that additional spaces are added from Settings?
