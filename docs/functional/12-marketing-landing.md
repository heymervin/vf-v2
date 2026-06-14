# Marketing landing page

**Where:** `/` (the root URL — the very first page anyone sees)
**Who uses it:** New visitors, potential venue owners, anyone clicking a link to VenueFlow for the first time
**Status:** Partial ⚠️

## In plain English

This is the front door of VenueFlow — a short page that introduces the product to someone who has never used it before. It shows the product name, a one-line pitch, and the eight pipeline stages so a visitor immediately understands what the CRM does. Right now the page is built and looks correct, but neither of the two call-to-action buttons go anywhere yet.

## What you see / what you can do

- A dark navy strip runs down the left side of the screen with a bold "V" logo mark (hidden on narrow phones; visible once the screen is at least ~640px wide — Tailwind `sm` breakpoint)
- A small uppercase eyebrow: **The Wedding Marketers**
- A heading directly below it: **VenueFlow**
- A short pitch: "The CRM built for wedding venues. Capture every enquiry, nurture every couple, book every viewing, and watch the pipeline move to wedding booked."
- Two buttons side by side:
  - **Get started** (solid, primary)
  - **See the pipeline** (outlined, secondary)
  - Neither button links anywhere at this time — clicking them does nothing
- A section labelled **"Eight stages, one source of truth"** showing all eight pipeline stage chips in colour:
  - Inbound enquiry (accent — a pale lavender/blue-grey)
  - Responded (teal)
  - Viewing interest (mint)
  - Appointment booked (blue)
  - Appointment attended (pink)
  - Date on hold (warning/amber)
  - Wedding booked (green)
  - Archived (muted/grey)

## How it works, step by step

### Home (page render)

1. The visitor arrives at the root URL.
2. The browser sets the page title to "VenueFlow" and the description to the CRM tagline (this is what search engines and social previews show).
3. The page renders the dark navy sidebar strip, the heading block, the two buttons, and the stage chips — all in one pass. No data is fetched; nothing is loaded from the database.
4. The stage chip list is hard-coded in the page file — the eight names and their colours are fixed at build time and do not come from any settings or database.

### Button: Get started

1. Visitor clicks **Get started**.
2. Nothing happens — the button has no link or action attached yet.

### Button: See the pipeline

1. Visitor clicks **See the pipeline**.
2. Nothing happens — the button has no link or action attached yet.

## Workflow

```
Visitor arrives at the root URL (/)
   │
   ▼
Page renders instantly — no data fetched, nothing
from the database
   │
   ▼
Visitor sees the heading, pitch, two buttons, and
the eight pipeline stage chips
   │
   ▼
Visitor clicks a button?
   │
   ├─ Get started ──▶ Nothing happens (no link yet)
   │
   └─ See the pipeline ──▶ Nothing happens (no link yet)
```

## Data it touches

- None. The page is fully static — it reads no database tables and writes nothing. All content is hard-coded in the source file.

## Rules & edge cases

- The left sidebar strip is hidden on narrow phones; it appears once the viewport reaches the small breakpoint (~640px wide — Tailwind `sm`).
- The eight pipeline stages are fixed in code — they cannot be reordered, renamed, or removed from this page through any admin setting.
- Page metadata (title, description, theme colour) is set globally in the layout and applies to every page in the app, not just this one.
- Because no data is fetched, the page loads instantly with no loading states or error states to handle.
- There is no login check on this page — anyone with the URL can see it.

## ✅ Approve this page

Tick each statement if it's correct. These must be concrete, independently true/false behavior claims that together fully describe this surface — phrased so the venue owner can confirm them:

- [ ] The page shows a small uppercase eyebrow "The Wedding Marketers" with the heading "VenueFlow" directly below it at the top.
- [ ] There is a short pitch paragraph describing VenueFlow as a CRM built for wedding venues.
- [ ] There are exactly two buttons: "Get started" and "See the pipeline".
- [ ] Neither button does anything when clicked — both are placeholder/unlinked at this stage.
- [ ] Eight pipeline stage chips are displayed in colour, matching the eight stages used throughout the app (Inbound enquiry through to Archived).
- [ ] The page requires no login — anyone with the URL can view it.
- [ ] A dark navy strip with a "V" mark appears on the left side once the screen is at least ~640px wide; it is hidden on narrow phones.
- [ ] The page loads with no spinner or loading delay — all content is fixed and does not come from the database.

**Wrong or missing anything?** _Write it here:_

## Open questions for you

- Where should **Get started** link to — the signup page, a demo booking form, or somewhere else?
- Where should **See the pipeline** link to — a demo view of the pipeline, or a marketing screenshot/video?
- Should this page eventually be a proper marketing/sales page with more copy, pricing, or social proof — or is it a short holding page that will be replaced later?
- The page title and meta description currently say "VenueFlow" site-wide. Do you want a different title for other pages (e.g. "VenueFlow — Pipeline") once the app is further along?
