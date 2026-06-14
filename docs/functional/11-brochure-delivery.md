# Automatic brochure email & download

**Where:** Background (email sent automatically) + public download link `/b/[token]`
**Who uses it:** System (sends automatically), couples (receive and click the email)
**Status:** Built ✅

## In plain English

When a couple fills in your enquiry form, the system automatically emails them your brochure — no action needed from you. The email goes out in the background, moments after the form is submitted. The couple clicks a button in the email and the PDF opens. Every click is counted so you can see how many people downloaded it.

## What you see / what you can do

- As the venue owner, you do not need to do anything — the brochure email fires automatically.
- The email lands in the couple's inbox, appearing to come from your venue name (not "VenueFlow").
- If you have set a reply-to address in your email settings, any reply the couple sends goes directly to that address.
- The email contains a single button: **"Download the brochure"**.
- Clicking that button opens the PDF immediately (valid for 5 minutes from the moment they click).
- Each time someone clicks the download link, the system records the click and updates a timestamp.

## How it works, step by step

### submitLeadForm (public enquiry action)

This runs the moment the couple hits "Submit" on your enquiry form.

1. The form fields are checked for validity. Invalid or spam submissions are rejected or silently dropped.
2. A rate limit prevents more than 5 submissions from the same IP address to your venue within 10 minutes. (The same IP can still submit to a different venue — the limit is per visitor per venue, not global.)
3. The raw submission is saved to the database first — the lead is never lost, even if everything else fails.
4. The couple is either created as a new contact or matched to an existing contact (matched by email address, case-insensitively).
5. A new enquiry opportunity is created in your pipeline (if the contact does not already have an active one).
6. The submission is linked to the contact record.
7. A background event called `lead/captured` is fired. This is best-effort: if it fails for any reason, the form submission is still saved and the couple still sees a success message.

### leadCaptured (background function)

This runs in the background after `lead/captured` fires.

1. The system checks whether your venue has an active brochure. If there is no active brochure, it stops here — no email is sent.
2. It loads the couple's name and email address, plus your venue name and email settings.
3. If the contact has no email address on record, it stops here.
4. It builds a tracked download link for the brochure.
5. It sends an email to the couple via Resend. The email shows your venue name as the sender, and if you have a reply-to address set, replies go to you directly.
6. The subject line is: `Your [Venue Name] brochure`.

### GET /b/[token] (brochure download route)

This runs when the couple clicks "Download the brochure" in the email.

1. The system reads the token from the link.
2. It looks up the brochure by that token. If the token is invalid or the brochure is no longer active, it returns a "Not found" error.
3. It increments the download count and records the current time as `last_downloaded_at`.
4. It generates a short-lived, secure link to the actual PDF file (valid for 5 minutes).
5. The couple's browser is redirected to that link and the PDF opens or downloads.

## Workflow

```
Couple submits the enquiry form
   │
   ▼
Form validates, drops spam, and applies the rate limit
   (5 per IP per venue in 10 min)
   │
   ▼
Save the lead first   (always saved first — lead never lost)
   │
   ▼
Match or create the contact (by email, case-insensitive)
   │
   ▼
Create pipeline card at "Inbound enquiry" (if none active yet)
   │
   ▼
Link the submission to the contact
   │
   ▼
Fire "lead/captured" event  ┄┄▶  brochure email (background)
   │                              best-effort; lead safe if it fails
   ▼
Couple sees the success message


Background: brochure email (leadCaptured)
   │
   ▼
Venue has an active brochure?
   ├─ no  ─▶ stop, no email sent (lead still saved)
   └─ yes ─▶ continue
   │
   ▼
Load couple's name + email, venue name, and email settings
   │
   ▼
Contact has an email address on record?
   ├─ no  ─▶ stop, no email sent
   └─ yes ─▶ continue
   │
   ▼
Build a tracked download link for the brochure
   │
   ▼
Send the email via Resend
   (sender shows venue name; replies go to reply-to if set;
    subject: "Your [Venue Name] brochure")


Download: couple clicks "Download the brochure" in the email
   │
   ▼
Read the token from the link
   │
   ▼
Look up the brochure by that token
   ├─ invalid token / brochure not active ─▶ return "Not found"
   └─ found and active ─▶ continue
   │
   ▼
Increment download count, record last_downloaded_at
   │
   ▼
Generate a short-lived signed PDF link (valid 5 minutes)
   │
   ▼
Redirect the couple's browser — the PDF opens or downloads
```

## Data it touches

- **brochures** — read to find the active brochure; written to on every download (count + timestamp)
- **contacts** — read to get the couple's name and email
- **venues** — read to get your venue name
- **venue_email_settings** — read to get your sender name and reply-to address
- **Brochures storage bucket** (private) — the actual PDF file lives here; accessed via a short-lived signed URL

## Rules & edge cases

- Only one brochure can be active per venue at a time. If there is no active brochure, no email is sent — the lead is still captured as normal.
- If the contact record has no email address, the email is skipped silently.
- The download link in the email never expires on its own — the same link works every time the couple clicks it. The PDF link it generates lasts 5 minutes, but clicking again generates a new one.
- If the brochure is deactivated after the email is sent, the download link will return "Not found" — the token looks up the active brochure, so deactivating it breaks old links.
- The email is sent from a shared VenueFlow sending address (`hello@mail.venueflow.io`), but the display name shown to the couple is your venue name (or the `from_name` you set in email settings).
- If the email service is not configured (no API key), the email is silently skipped and a warning is logged. The lead is still saved.
- A malformed or non-UUID token in the download URL returns a 404 immediately.
- Only PDF files up to 10 MB can be stored as a brochure.
- The brochure email is the only automated email sent on lead capture. Follow-up / nurture sequences are not built yet.

## ✅ Approve this page

Tick each statement if it's correct. These must be concrete, independently true/false behavior claims that together fully describe this surface — phrased so the venue owner can confirm them:

- [ ] When a couple submits the enquiry form, a brochure email is sent to them automatically — you do not need to do anything.
- [ ] The email only goes out if you have an active brochure uploaded. No brochure = no email (the lead is still saved).
- [ ] The email appears to come from your venue name, not from "VenueFlow".
- [ ] If the couple replies to the email, the reply goes to the address you set in your email settings — not back to VenueFlow.
- [ ] The email subject line is: "Your [Venue Name] brochure".
- [ ] The email body thanks the couple for their interest, mentions spaces, capacities, and pricing, and includes a single button labelled "Download the brochure".
- [ ] Clicking the download button opens the PDF. The link in the email itself does not expire — clicking it again always works.
- [ ] Every time someone clicks the download link, the system records a count and the time of the most recent download.
- [ ] If the same person submits the form a second time (same email address), they are matched to their existing contact record — not created as a duplicate.
- [ ] The brochure file is kept private. It is never directly accessible via a permanent public URL — a fresh short-lived link is generated each time someone clicks download.
- [ ] If the form submission fails after the lead is saved, the couple has already been captured — no lead is lost even if the email fails.
- [ ] There are no follow-up emails after the brochure. The nurture sequence is not built yet.

**Wrong or missing anything?** _Write it here:_

## Open questions for you

- Should deactivating a brochure break old download links for couples who were already emailed? Currently it does — is that the intended behaviour, or should old links keep working even after a new brochure is uploaded?
- The email always uses the same body text ("we would love to help you celebrate your wedding with us..."). Should venues be able to customise this wording, or is fixed copy acceptable for now?
- Download count tracks total clicks but not unique downloaders. Is that enough, or do you want to know which specific contact downloaded and when?
