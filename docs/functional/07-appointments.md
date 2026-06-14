# Appointments

**Where:** `/appointments` — listed in the main sidebar under "Appointments"
**Who uses it:** Venue staff (you and your team)
**Status:** Not built yet (planned) 🔧

## In plain English

The Appointments section will be where you manage site visits and viewing appointments with couples — things like scheduling a couple coming in to look at the venue, confirming they showed up, and keeping track of who is at which stage of the conversation. It does not exist yet; clicking "Appointments" in the sidebar currently shows a single line that says "Appointment scheduling coming in M5." Your business hours were collected during setup and are stored in the system, but they are not being used anywhere yet — they are reserved for this feature.

## What you see / what you can do

- When you click "Appointments" in the sidebar, you see only a heading ("Appointments") and the message: _"Appointment scheduling coming in M5."_
- There are no buttons, no calendar, no list of bookings, and nothing you can interact with.
- The page is protected — only logged-in staff can reach it. Anyone not signed in is sent to the login page.

## How it works, step by step

### AppointmentsPage

This is the only function that runs when you visit `/appointments`. It does the following:

1. The browser requests the `/appointments` page.
2. The system checks you are logged in (handled before the page even loads — if not logged in, you are redirected to `/login`).
3. The page renders a heading "Appointments" and a single sentence telling you this feature is coming in M5.
4. Nothing else happens. No data is fetched, no calendar is loaded, no bookings are shown.

---

The following describes what **was** built during onboarding and is waiting to be used:

### finishHours _(onboarding — not the Appointments page itself)_

During your initial setup, your business hours were collected in Step 3 of onboarding. Here is what that does:

1. You set open/closed and opening + closing times for each day of the week (Monday through Sunday).
2. If you skipped Step 3, the system saved a default schedule: Monday–Saturday open 9 am to 5 pm, Sunday closed.
3. All seven days (including closed ones) are saved to the database table `venue_hours`, one row per day.
4. If you changed your mind and went back, saving again simply overwrites the existing rows — it does not create duplicates.
5. This data currently sits in the database unused, waiting for the Appointments feature to read it.

## Workflow

```
PLANNED — Appointments scheduling is coming in M5.
Today the page only shows a "coming soon" message.

Staff clicks "Appointments" in the sidebar
   │
   ▼
Are you logged in?
   ├─ no  ─▶ redirected to the login page
   └─ yes ─▶ page loads
                │
                ▼
             Shows heading + "Appointment scheduling
             coming in M5." message
                │
                ▼
             Nothing else happens — no data is loaded,
             no calendar, no bookings, no buttons
```

## Data it touches

- **`venue_hours` table** — stores your opening and closing times for each day of the week, one row per day per venue. Written during onboarding setup; not yet read by the Appointments page.
- No other tables are read or written when you visit `/appointments` today.

## Rules & edge cases

- You must be signed in to visit `/appointments`. Anyone who is not signed in is automatically sent to the login page.
- The page itself does nothing with data — no reads, no writes, no side effects.
- Your business hours (stored in `venue_hours`) were saved at the end of onboarding. If you skipped the hours step during setup, the system saved the default schedule (Mon–Sat 9 am–5 pm, Sunday closed) on your behalf.
- There is no way to edit your business hours from anywhere in the app today — the settings page does not expose this yet.
- Appointment scheduling, calendar views, reminders, confirmation emails, and couple-facing booking links are all planned for M5 and do not exist yet.
- Two pipeline stages reference appointments — "Appointment booked" and "Appointment attended" — and those labels already exist in the Pipeline kanban. But the Appointments page itself has no connection to the pipeline today; moving a deal to "Appointment booked" does not create an appointment entry anywhere.

## ✅ Approve this page

Tick each statement if it's correct. These must be concrete, independently true/false behavior claims:

- [ ] Clicking "Appointments" in the sidebar takes you to `/appointments`.
- [ ] The page shows only a heading ("Appointments") and the text "Appointment scheduling coming in M5." — nothing else.
- [ ] There is no calendar, no list of bookings, and no action buttons on this page right now.
- [ ] You must be logged in to see this page; if you are not, you are sent to the login page automatically.
- [ ] During initial setup (onboarding), you set your opening and closing times for each day of the week — these are saved and stored, but not displayed or used anywhere in the app yet.
- [ ] If you skipped the hours step during setup, the system saved a default schedule on your behalf: Monday–Saturday 9 am–5 pm, Sunday closed.
- [ ] There is currently no way to change your business hours after onboarding is complete.
- [ ] The pipeline already has "Appointment booked" and "Appointment attended" stages, but moving a deal to those stages does not create or track an actual appointment anywhere yet.
- [ ] Appointment scheduling is planned for a future milestone (M5) and is not available today.

**Wrong or missing anything?** _Write it here:_

## Open questions for you

- When Appointments is built, should couples be able to book directly through a public link (self-service), or does the venue always create the appointment manually on their behalf?
- Should appointment reminders (email or SMS to the couple) be part of M5, or a later addition?
- Do you want the system to block appointment slots based on your `venue_hours` (i.e., refuse bookings outside your open hours), or is that just a guide?
- Should "Appointment booked" and "Appointment attended" in the pipeline eventually update automatically when an appointment is created or marked complete, or will staff always move those stages by hand?
