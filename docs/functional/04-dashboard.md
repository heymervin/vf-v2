# Dashboard

**Where:** `/dashboard` — the first page a staff member lands on after logging in  
**Who uses it:** Venue staff (owners, admins, members)  
**Status:** Partial ⚠️

## In plain English

The Dashboard is the home screen for your venue's account. Right now it exists as a "getting started" page — it greets you by name and points you toward the one action that kick-starts your whole pipeline: setting up your enquiry form. There are no metrics or live data here yet; those are planned for a future milestone.

## What you see / what you can do

- **Page title** — "Dashboard" displayed at the top with a styled underline.
- **Welcome message** — A short line that reads "Welcome to [Your Venue Name]. Here is where your pipeline activity will live." The venue name is pulled from your account automatically.
- **Getting started panel** — A single card that explains why the enquiry form matters and what it does for you.
- **"Set up your form" button** — Takes you to Settings where you can configure your enquiry form.
- **"View contacts" button** — Takes you to your Contacts list.

There are no graphs, stats, or booking counts shown — those sections are not built yet.

## How it works, step by step

### getTenantContext
This runs silently every time the page loads. You never see it directly, but it controls whether you can reach the Dashboard at all.

1. Your browser sends a request for `/dashboard`.
2. The system checks whether you are logged in by verifying your session directly with the database (not a cached token).
3. If you are not logged in, it sends you straight to `/login` — you never see the Dashboard.
4. If you are logged in, it looks up which venues you belong to (you could be a member of more than one venue).
5. It checks a small cookie in your browser (`vf-venue-id`) to see if you have a preferred venue selected. If that cookie matches one of your venues, that venue becomes active. If not, it falls back to the first venue in your membership list.
6. It reads the active venue's name (and a few other details like timezone) and passes them to the page for display.
7. The page renders with your venue name in the welcome message.

## Workflow

```
User visits /dashboard
   │
   ▼
Are you logged in?
   ├─ no  ─▶ Redirect to /login
   └─ yes ─▶ continue
               │
               ▼
            Look up your venue memberships
               │
               ▼
            Any venue found?
               ├─ no  ─▶ Redirect to /login
               └─ yes ─▶ continue
                           │
                           ▼
                        Pick the active venue
                        (cookie preference, else first in list)
                           │
                           ▼
Render Dashboard with venue name in the welcome
   │
   ▼
You see the page. Two buttons:
   ├─ "Set up your form" ─▶ /settings
   └─ "View contacts"    ─▶ /contacts
```

## Data it touches

- **`memberships` table** — read only. Used to find which venues the logged-in user belongs to and what their role is (owner / admin / member).
- **`venues` table** — read only. Pulled via the membership join. Supplies the venue name shown in the greeting.
- **`vf-venue-id` cookie** — read only. Used to remember which venue was last active if the user belongs to more than one.

Nothing is written to the database when you visit the Dashboard.

## Rules & edge cases

- If you are not logged in, you are redirected to `/login` immediately — the Dashboard never loads.
- If your account exists but has no venue attached (e.g. something went wrong during sign-up), you are also redirected to `/login`.
- If you belong to multiple venues, the one stored in your browser cookie is shown. If the cookie is missing or stale, the system falls back to the oldest membership.
- The venue name in the greeting comes live from your account record — if someone changes the venue name in Settings, the Dashboard greeting updates on the next page load.
- There are no charts, no booking counts, no revenue figures, and no lead metrics on this page. Those are planned but not built.
- The "Set up your form" button goes to `/settings` (the general Settings page), not directly to a dedicated form-builder screen.

## ✅ Approve this page

Tick each statement if it's correct:

- [ ] When I visit `/dashboard` while not logged in, I am immediately sent to the login page.
- [ ] When I am logged in, the page shows a welcome message that includes my venue's name.
- [ ] The venue name in the welcome message is pulled automatically from my account — I don't type it on this page.
- [ ] There are no metrics, graphs, booking counts, or revenue numbers on this page today.
- [ ] There is one panel on the page labelled "Getting started" that explains the enquiry form.
- [ ] Clicking "Set up your form" takes me to the Settings page.
- [ ] Clicking "View contacts" takes me to the Contacts page.
- [ ] If my account is linked to more than one venue, the system shows the venue I last chose (remembered in my browser); if it can't find that, it shows the first venue in my list.
- [ ] Nothing is saved or changed when I simply load the Dashboard — it is read-only.

**Wrong or missing anything?** _Write it here:_

## Open questions for you

- When metrics do arrive (leads this month, upcoming tours, conversion rate, etc.) — what numbers matter most to you at a glance? Knowing this now will shape what gets built first.
- Should the "getting started" panel disappear once the enquiry form is set up, or should the Dashboard always show a helpful next action?
- If you manage more than one venue, do you want a venue-switcher somewhere on this page, or is the current behaviour (last-used remembered in the browser) enough?
