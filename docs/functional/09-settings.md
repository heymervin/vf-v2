# Settings — Enquiry Form & Brochure

**Where:** `/settings` (hub), `/settings/forms` (form embed), `/settings/brochure` (brochure)
**Who uses it:** Venue staff — all roles can view; only owners and admins can upload or replace the brochure
**Status:** Built ✅

## In plain English

Settings is where the venue configures the two things couples see before they ever talk to anyone: the enquiry form and the information brochure. The enquiry form has a public link you can share directly, and an embed snippet you can paste into your website. The brochure is a single PDF that VenueFlow automatically emails to every couple the moment they enquire.

## What you see / what you can do

- **Settings hub (`/settings`):** Two cards — "Enquiry form" and "Brochure" — each linking to its own page. Nothing else is on this screen right now.
- **Enquiry form page (`/settings/forms`):**
  - A read-only **shareable link** (e.g. `https://app.venueflow.io/f/your-venue`) with a one-click Copy button and an "Open" button to preview the form in a new tab.
  - A read-only **embed code** — a short HTML snippet — with a one-click Copy button. Paste it into your website to show the form in an inline frame.
- **Brochure page (`/settings/brochure`):**
  - If a brochure is already active: you see its title, how many times the download link has been opened, and when it was last opened. A "Preview" button opens the PDF in a new tab — but each click counts as a download, since Preview uses the same tracked download link.
  - An upload section (owners and admins only) to upload a new PDF — optionally give it a title. Uploading replaces the old brochure immediately.
  - If no brochure has been uploaded yet, a placeholder message explains what to do.
  - Staff members who are not owners or admins see the current brochure details but no upload option.

## How it works, step by step

### Enquiry form page (no user action required — it's read-only)

1. When you open `/settings/forms`, the system looks up your venue's unique slug (a short identifier like `mornington-estate`).
2. It builds your public form URL (`https://app.venueflow.io/f/mornington-estate`) and your embed code using that URL.
3. Both are shown on screen, ready to copy. Nothing is saved or changed — this page just displays what already exists.
4. Clicking **Copy** copies the text to your clipboard and briefly shows a "Copied" confirmation.
5. Clicking **Open** (next to the shareable link) opens the live public enquiry form in a new browser tab so you can check how it looks.

### uploadBrochure

This runs when an owner or admin submits the upload form on `/settings/brochure`.

1. You (owner or admin) open the brochure page and see either the current brochure or a "no brochure yet" message.
2. You optionally type a title (e.g. "2027 Wedding Brochure"). If you leave it blank, no title is stored.
3. You click the file-picker area and select a PDF from your computer. The file name appears on screen once selected.
4. You click **Upload brochure** (or **Replace brochure** if one exists). The button changes to "Uploading…" while the system works.
5. The system checks: is it a PDF? Is it 10 MB or smaller? If either check fails, an error message appears and nothing is saved.
6. The PDF is uploaded to secure storage (not publicly accessible directly — it's only delivered via a tracked download link).
7. Any previously active brochure is marked inactive. There can only ever be one active brochure at a time.
8. A new record is created as the active brochure for the venue, with a fresh secret download token.
9. The page refreshes automatically. You now see the new brochure listed with 0 downloads. If you left the title blank, it is stored without a title in the database and displayed with the default label "Wedding brochure".
10. From this point on, every new enquiry that comes in will trigger an email to the couple containing the new brochure.

## Workflow

```
Staff opens /settings  (two cards: Enquiry form, Brochure)
   │
   ▼
Which section?
   ├─ Enquiry form ─▶ go to "Enquiry form page" below
   └─ Brochure     ─▶ go to "Brochure page" below


Enquiry form page  (read-only, no action required)
   │
   ▼
Show shareable link + embed code
   │
   ▼
Click Copy ─▶ text copied, "Copied" shown briefly
Click Open ─▶ live form opens in a new tab


Brochure page
   │
   ▼
Active brochure?
   ├─ yes ─▶ Show title, downloads, last downloaded
   └─ no  ─▶ Show empty state ("no brochure yet")
   │
   ▼
What's your role?
   ├─ Member        ─▶ Read-only view (no upload form) — stop
   └─ Owner / Admin ─▶ continue
   │
   ▼
Select PDF + optional title
   │
   ▼
Click Upload (button shows "Uploading…")
   │
   ▼
Valid? (must be PDF, max 10 MB)
   ├─ no  ─▶ Show error, nothing saved
   └─ yes ─▶ continue
   │
   ▼
Upload PDF to secure private storage
   │
   ▼
Mark old brochure inactive (only one active at a time)
   │
   ▼
Insert new active brochure (fresh secret download token)
   │
   ▼
Page refreshes — new brochure shown, 0 downloads
   │
   ▼
From now on, every enquiry triggers a brochure
email to the couple
```

## Data it touches

- **`brochures` table** — read to show the current active brochure; written (old row set inactive, new row inserted) when a PDF is uploaded
- **`brochures` storage bucket** — the actual PDF file is stored here (private, staff only; couples receive it via a secure tracked link)
- **`venue_email_settings` table** — exists in the database (stores the "from" name and reply-to email address for outgoing venue emails) but there is **no settings UI for it yet**
- **`form_submissions` table** — not touched by the settings pages (relevant to enquiry processing, not to settings configuration)

## Rules & edge cases

- Only **PDF files** are accepted. Any other file type is rejected before upload.
- Maximum file size is **10 MB**. Files larger than this are rejected with an error message.
- There is always **at most one active brochure** per venue. Uploading a new one immediately retires the old one — it is not deleted from storage, just deactivated in the database.
- The **shareable link and embed code cannot be edited** — they are generated from the venue's slug, which is set when the account is created.
- Only **owners and admins** can upload or replace the brochure. Regular members can view the brochure details but see no upload form.
- If the upload fails for a technical reason (e.g. network error), an error message appears and the old brochure stays active — nothing is lost.
- The brochure **download count and last-downloaded date** shown on this page track every open of the brochure download link — including staff clicking Preview, since Preview uses the same tracked link. They are not limited to couples opening the emailed link. These are read-only stats.
- **Email identity settings** (the "from" name and reply-to address for automated emails) have a data table but **no settings screen yet** — you cannot configure them from the app today.
- **Sequence / follow-up email settings** are also not yet built as a UI, even though the data model has room for them.

## Approve this page

Tick each statement if it's correct. These must be concrete, independently true/false behavior claims that together fully describe this surface — phrased so the venue owner can confirm them:

- [ ] The Settings hub shows exactly two sections: "Enquiry form" and "Brochure". Nothing else appears there today.
- [ ] The enquiry form page shows a shareable link I can copy and open, plus an embed snippet I can paste into my website — both are read-only (I cannot edit them).
- [ ] The embed snippet is a standard `<iframe>` tag pointing to my form's `/embed` URL, sized 100% wide and 760px tall, with a max-width of 560px.
- [ ] The brochure page shows the current active brochure's title, total download count, and the date it was last downloaded.
- [ ] Uploading a new brochure immediately replaces the old one — only one brochure is ever active at a time.
- [ ] Only owners and admins can upload or replace the brochure. A regular staff member sees the current brochure info but no upload form.
- [ ] The file picker only accepts PDFs and rejects files larger than 10 MB, showing an error if either rule is broken.
- [ ] The title field when uploading is optional. If I leave it blank, no title is stored in the database, and the brochure is shown with the default label "Wedding brochure".
- [ ] I can preview the current active brochure by clicking the "Preview" button, which opens it in a new tab. Each Preview click is logged as a download (it uses the same tracked link that couples receive), so the download count reflects all opens — not only couples' opens.
- [ ] Email identity settings (from-name, reply-to address) and any sequence or follow-up automation settings do not yet have a settings screen — I cannot configure them from the app today.

**Wrong or missing anything?** _Write it here:_

## Open questions for you

- Should uploading a new brochure delete the old PDF file from storage, or is keeping the history of all uploaded brochures intentional?
- When there is no active brochure, do you want new enquiries to still receive an email (without a brochure), or should the email be skipped entirely until a brochure is uploaded?
- The embed snippet is always 760px tall with a max-width of 560px — is that the right default, or should it be configurable per venue?
- Email identity (the sender name and reply-to address on automated emails) needs a settings UI — is this the next thing to build here, or is it lower priority?
