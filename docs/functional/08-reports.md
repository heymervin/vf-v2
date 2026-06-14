# Reports

**Where:** `/reports` (main navigation)
**Who uses it:** Venue staff and venue owner
**Status:** Not built yet (planned) 🔧

## In plain English

The Reports page is a reserved area of VenueFlow where the venue will eventually be able to see analytics and business performance data — things like bookings over time, revenue trends, and enquiry conversion rates. Right now, it is a placeholder: the page exists in the navigation and is accessible, but no charts, numbers, or filters have been built yet. Everything here is planned for Milestone 6 (M6).

## What you see / what you can do

- A heading that says "Reports"
- A single line of text: "Reporting and analytics coming in M6"
- Nothing else — no charts, no tables, no filters, no date pickers, no export buttons

## How it works, step by step

### ReportsPage

1. You click "Reports" in the navigation.
2. The page loads.
3. You see the heading and the placeholder message.
4. There is nothing to interact with.

## Workflow

```
PLANNED — Reporting and analytics are coming in M6.
Today the page only shows a "coming soon" message.

Staff clicks "Reports" in the navigation
   │
   ▼
Page loads
   │
   ▼
Shows heading + "Reporting and analytics
coming in M6" message
   │
   ▼
No further action available — no charts, tables,
filters, date pickers, or export buttons
```

## Data it touches

- None. The page reads no data from the database and writes nothing.

## Rules & edge cases

- The page is accessible to any logged-in venue user right now — there is no permission gate beyond being logged in.
- No data is displayed, so there is nothing to filter, export, or act on.
- The "coming in M6" message is hardcoded — it is not driven by any feature flag or configuration.

## ✅ Approve this page

Tick each statement if it's correct. These must be concrete, independently true/false behavior claims that together fully describe this surface — phrased so the venue owner can confirm them:

- [ ] There is a "Reports" item in the main navigation, and clicking it takes you to `/reports`.
- [ ] The page shows a heading "Reports" and the message "Reporting and analytics coming in M6." — nothing else.
- [ ] No charts, numbers, tables, filters, or date pickers are shown on this page today.
- [ ] No data is fetched or saved when you visit this page.
- [ ] Any logged-in team member can open the Reports page (it is not restricted to owners only).
- [ ] The placeholder message is static — it does not change based on any setting or date.

**Wrong or missing anything?** _Write it here:_

## Open questions for you

- What reports do you want to see in M6? (e.g. bookings per month, revenue by event type, enquiry-to-booking conversion rate — confirm the priority list so M6 can be scoped.)
- Should the Reports section be visible only to the venue owner/manager, or is it fine for all staff to see it?
- Do you want a data export option (CSV/PDF) alongside the charts when this is built?
