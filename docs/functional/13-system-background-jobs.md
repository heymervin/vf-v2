# Background Jobs & System Internals

**Where:** Background / not visible in the UI  
**Who uses it:** System (runs automatically — venue staff never interact with this directly)  
**Status:** Built ✅

## In plain English

These are the behind-the-scenes mechanics that keep VenueFlow running reliably. There are three pieces: a request gate that checks whether you are logged in before letting you into any staff-only page, a job runner that handles tasks that happen in the background (like sending the brochure email after a lead submits), and a health-check job that confirms the job runner itself is alive. None of this requires any action from venue staff — it just works.

## What you see / what you can do

There is no screen or page for this. Everything here is invisible plumbing.

- Venue staff are automatically redirected to the login page if they try to visit a staff-only page without being signed in.
- Logged-in staff who navigate to `/login` or `/signup` are automatically sent to the dashboard instead.
- When a new enquiry comes in via the public form, a brochure email is automatically sent to the couple — no manual step needed.
- A health-ping job can be fired manually (via the Inngest dashboard or SDK) to confirm the background job system is working end to end. No automated monitoring tool or cron currently fires this — it is a manual diagnostic only.

## How it works, step by step

### proxy (the request gate)

Every page request goes through a gate before it loads. The gate does the following:

1. The system reads the login cookie from the browser to check whether the person is signed in. It does this by calling Supabase directly — not just trusting the cookie at face value — so expired or tampered sessions are caught.
2. If the person is **not** logged in and is trying to reach a staff page (dashboard, contacts, pipeline, appointments, reports, settings, onboarding), they are immediately redirected to `/login`.
3. If the person **is** logged in and tries to visit `/login` or `/signup`, they are immediately redirected to `/dashboard`.
4. If neither condition applies (public pages, the enquiry form, API endpoints), the request passes through untouched.
5. The Inngest webhook endpoint (`/api/inngest`) is always allowed through — the gate never blocks it, because it is called by Inngest, not by logged-in users. The gate also pre-excludes the `/api/webhooks` path pattern, but no external webhook receiver is built at that path yet.

### healthPing

This is a minimal smoke-test job. It exists purely to confirm that the background job system is wired up and running.

1. A developer fires an event called `app/health.ping` to Inngest manually — via the Inngest dashboard or SDK. There is no automated monitoring tool or cron wired up to do this.
2. Inngest receives the event and routes it to the `health-ping` job.
3. The job replies immediately with `{ pong: true }` and the timestamp the event was received.
4. No data is saved. No emails are sent. It just confirms the pipeline is alive.

### leadCaptured

This job runs when a new enquiry is submitted through the public form. The event dispatch is best-effort: if sending the event fails, the error is logged and swallowed, so the enquiry is still saved but no brochure email is sent in that case.

1. When a couple submits the enquiry form, the system fires a `lead/captured` event containing the venue ID, the new contact ID, and the submission ID.
2. Inngest picks up the event and starts the `lead-captured` job.
3. The job checks whether the venue has an active brochure on file. If there is no active brochure, the job stops here and records `sent: false / no-active-brochure`. No email is sent — this is intentional; the enquiry is still saved.
4. If a brochure exists, the job fetches the couple's name and email, the venue's name, and the venue's email settings (the "from" name and reply-to address the venue configured in Settings).
5. If the couple's email or the venue record is missing, the job stops and records `sent: false / no-recipient`.
6. The job builds a brochure link pointing to the venue's brochure. The URL includes a `?c=` query parameter with the contact ID, but the download route does not read that parameter — it is not used for tracking. The route records only an aggregate download count and last-downloaded timestamp on the brochure itself; individual-couple download tracking is NOT implemented.
7. It sends an email to the couple with the subject "Your [Venue Name] brochure", using the venue's configured sender name and reply-to address.
8. The result (`sent: true` or the error reason) is returned to Inngest and stored in the job run log.

## Workflow

```
THE REQUEST GATE (proxy) — runs on every page request

Browser requests a page
   │
   ▼
Gate checks the login cookie with Supabase
   │
   ├─ Staff page + not logged in ──▶ Redirect to /login
   │
   ├─ /login or /signup + already logged in
   │     └─▶ Redirect to /dashboard
   │
   ├─ /api/inngest (job runner) ──▶ Always allowed through
   │
   └─ Public page, enquiry form, or other API
         └─▶ Allowed through untouched


THE HEALTH-PING JOB (healthPing) — manual diagnostic

Developer fires app/health.ping event by hand
(Inngest dashboard or SDK — no cron, no monitoring)
   │
   ▼
Inngest routes it to the health-ping job
   │
   ▼
Job replies { pong: true } with the timestamp
   │
   ▼
Done — nothing saved, no email sent


THE BROCHURE EMAIL JOB (leadCaptured)

Couple submits the enquiry form
   │
   ▼
System fires a lead/captured event
(best-effort — if it fails, error is logged and the
enquiry is still saved, but no email goes out)
   │
   ▼
Inngest starts the lead-captured job
   │
   ▼
Venue has an active brochure?
   │
   ├─ No ──▶ Stop — record "no-active-brochure",
   │          no email sent (enquiry still saved)
   │
   └─ Yes
        │
        ▼
   Fetch couple's name + email, venue name,
   and the venue's email settings
        │
        ▼
   Couple's email and venue record present?
        │
        ├─ No ──▶ Stop — record "no-recipient",
        │          no email sent
        │
        └─ Yes
             │
             ▼
        Build the brochure link
             │
             ▼
        Send brochure email to the couple,
        subject "Your [Venue Name] brochure"
             │
             ▼
        Record the result in the job run log
```

## Data it touches

- **brochures** table — read to check whether an active brochure exists for the venue
- **contacts** table — read to get the couple's first name and email address
- **venues** table — read to get the venue name for the email subject and body
- **venue_email_settings** table — read to get the venue's preferred sender name and reply-to address
- **brochures** table — also written to on download: `download_count` is incremented and `last_downloaded_at` is updated each time the brochure link is opened. This is aggregate only — no per-contact record is written.

## Rules & edge cases

- The request gate checks the session with Supabase's auth server on every request — it does not trust a cookie alone. This prevents stale or stolen sessions from working.
- If a venue has no active brochure, the `leadCaptured` job exits cleanly without error. The enquiry is still saved; only the brochure email is skipped.
- If the contact's email address is blank for any reason, no email is sent and the job records why.
- The brochure link in the email points to the venue's brochure and records an aggregate download count and last-downloaded timestamp on the brochure. Individual-couple download tracking is NOT implemented — the `?c=` contact tag in the URL is not read by the download route and has no effect.
- The Inngest webhook endpoint is deliberately excluded from the login gate — blocking it would break all background jobs.
- `healthPing` saves nothing and is purely a diagnostic tool. It has no effect on venue data.
- Venue resolution (figuring out which venue is making a request) is intentionally NOT done inside the request gate — it happens later in the application. The gate only handles login status.

## Approve this page

Tick each statement if it's correct. These must be concrete, independently true/false behavior claims that together fully describe this surface — phrased so the venue owner can confirm them:

- [ ] Any page under `/dashboard`, `/contacts`, `/pipeline`, `/appointments`, `/reports`, `/settings`, or `/onboarding` redirects to `/login` if the person is not signed in.
- [ ] A signed-in user who navigates to `/login` or `/signup` is automatically sent to `/dashboard`.
- [ ] The public enquiry form page is not blocked by the login gate — anyone can reach it without an account.
- [ ] When a couple submits the enquiry form, VenueFlow automatically emails them the venue brochure — no manual action needed from venue staff.
- [ ] If the venue has not uploaded an active brochure, no brochure email is sent, but the enquiry is still recorded normally.
- [ ] The brochure email uses the sender name the venue configured in Settings. If no sender name is configured, it falls back to the venue's name. If no reply-to address is configured, the email is sent with no reply-to header (replies go to the default sending address) — it does NOT fall back to the venue's name.
- [ ] The brochure link in the email records an aggregate download count for the brochure. The system does NOT track which individual couple opened it — per-contact download tracking is not implemented.
- [ ] The `health-ping` job is a diagnostic tool only — it does not change any data and has no visible effect for venue staff.
- [ ] The Inngest job runner endpoint (`/api/inngest`) is always reachable without login — blocking it would break automated emails and other background tasks.
- [ ] Session validity is checked with Supabase's auth server on every request, not just by reading the browser cookie — so expired sessions are caught immediately.

**Wrong or missing anything?** _Write it here:_

## Open questions for you

- Should the brochure email be optional per venue — i.e., should there be a toggle in Settings to turn off automatic brochure sending even when a brochure is uploaded?
- If the brochure email fails to send (e.g. email service is down), should the venue staff be notified, or is silent retry sufficient?
