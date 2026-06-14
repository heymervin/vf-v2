# Public enquiry form (couple-facing)

**Where:** `venueflow.app/f/[your-venue-slug]` (hosted) · `venueflow.app/f/[your-venue-slug]/embed` (for your own website iframe)
**Who uses it:** Couples enquiring about a wedding. Venue staff never interact with it directly — they receive the leads it generates.
**Status:** Built ✅

## In plain English

This is the form a couple fills in when they want to find out more about your venue. It lives at a public link you can share directly, and it also has a stripped-down version that can be dropped into an iframe on your own website. When a couple submits it, VenueFlow saves their details, creates a contact record in your CRM, places them in your pipeline at "Inbound enquiry," and automatically emails them your active brochure (if one is uploaded) via a background job. If no brochure has been uploaded yet, no brochure email is sent.

## What you see / what you can do

**The hosted page (the public link you share):**
- Your venue's logo at the top (if you've uploaded one), followed by your venue name on a colourful banner
- A short invitation: "Tell us a little about your wedding and we'll send your brochure straight to your inbox"
- A form with these fields:
  - Your name (required)
  - Partner's name (optional)
  - Email (required)
  - Phone (optional)
  - Approx. guests (optional, number)
  - Wedding date — date picker (optional)
  - "My date is flexible" toggle next to the date (optional)
  - Anything you'd like us to know? — a short free-text box (optional)
- A "Send enquiry" button
- A small "Powered by VenueFlow" note at the bottom

**After submitting:**
- The form is replaced by a green tick and the message: "Thank you — your brochure is on its way" along with a confirmation of the email address used

**The embed version (inside your website via iframe):**
- Identical form fields and behaviour, but with no banner, no logo, no VenueFlow footer — just the plain form so it blends into your existing site design

## How it works, step by step

### submitLeadForm

This is the function that runs when the couple hits "Send enquiry."

1. The form checks that your name and email are filled in before it even tries to submit. If they're not, errors appear inline.
2. The couple's browser quietly captures where they came from (UTM tracking parameters and the referring page address) and sends that along with the form — the couple never sees this.
3. The data is sent to VenueFlow's server.
4. The server validates all the data against strict rules (see "Rules & edge cases"). If anything fails, an error is shown and nothing is saved.
5. There is a hidden "website" field on the form that is invisible to real users. If a bot fills it in, the server pretends the submission worked but throws it away silently — the couple (or bot) never knows.
6. The server checks how many submissions have come from the same IP address to this venue in the last 10 minutes. If it is 5 or more, the submission is rejected with "Too many submissions. Please try again shortly."
7. For any submission that passes validation, the honeypot check, and the rate limit, the raw data is saved to a `form_submissions` record first — before the contact, opportunity, or event steps — so a valid lead is never lost if a later step fails. (Submissions blocked by the honeypot, failed validation, or the rate limit are not saved.)
8. The server looks up your venue's contacts by email address (case-insensitive). If a contact with that email already exists:
   - Their record is updated with whatever the new submission provides for last name, phone, partner names, wedding date, and guest count — but only when the new submission includes a non-empty value for that field. First name and email are never changed on a repeat enquiry.
   - Note: if a couple re-submits with a different phone number, their stored phone will be overwritten with the new one.
9. If no matching contact exists, a brand new contact is created with all the details from the form.
10. The server checks whether this contact already has an active pipeline card. If they don't, a new card is created and placed at the top of the "Inbound enquiry" column in your pipeline.
11. The raw submission is linked to the contact record and marked as processed.
12. A `lead/captured` event is fired to trigger downstream actions (such as sending the brochure email). This is best-effort — if it fails, the lead is still safely saved and the couple still sees a success message.
13. The couple sees the "Thank you" screen.

## Workflow

```
Couple fills in the form and clicks "Send enquiry"
   │
   ▼
Browser checks required fields (name + email) before sending
   │
   ▼
Browser also captures where they came from (UTM + referrer)
   │
   ▼
Data sent to the server
   │
   ▼
Server validates everything against strict rules
   ├─ fails ─▶ show error, nothing saved
   └─ ok    ─▶ continue
   │
   ▼
Honeypot check (hidden "website" field)
   ├─ bot filled it ─▶ fake success, throw away silently (not saved)
   └─ clean         ─▶ continue
   │
   ▼
Rate limit: 5+ submissions from this IP to this venue in 10 min?
   ├─ yes ─▶ reject: "Too many submissions. Please try again
   │           shortly." (not saved)
   └─ no  ─▶ continue
   │
   ▼
Save raw submission first   (always saved first — lead never lost)
   │
   ▼
Look up contact by email (case-insensitive)
   ├─ exists ─▶ update last name, phone, partner names, date,
   │             guest count — only from non-empty new values
   │             (first name + email never changed)
   └─ none   ─▶ create a brand new contact
   │
   ▼
Contact already has an active pipeline card?
   ├─ yes ─▶ leave it where it is (no duplicate card)
   └─ no  ─▶ create a card at the top of "Inbound enquiry"
   │
   ▼
Link the raw submission to the contact, mark it processed
   │
   ▼
Fire "lead/captured" event  ┄┄▶  brochure email (background;
   │                              best-effort, lead safe if it fails)
   ▼
Couple sees "Thank you — your brochure is on its way"
```

## Data it touches

- **form_submissions** — one row saved per valid submission, storing the raw fields, the couple's IP address, UTM tracking data, and (once processed) a link to the contact
- **contacts** — one row per couple per venue; created on first enquiry; on repeat enquiry, last name, phone, partner names, wedding date, and guest count are overwritten with any non-empty values from the new submission (first name and email are never changed)
- **opportunities** — one active pipeline card per contact; created at "Inbound enquiry" stage on first enquiry, left untouched if one already exists
- **venues** — read only, to confirm the slug is valid and to fetch the venue's name and logo

## Rules & edge cases

- Only your name and email are required. Everything else is optional — this is intentional to keep conversion high.
- Email must be a valid format (must contain `@` and a domain). Checked both in the browser and on the server.
- Guest count must be a whole number between 0 and 100,000 if provided.
- The message field accepts up to 2,000 characters.
- Name fields accept up to 100 characters; phone up to 40.
- If a couple submits more than 5 times from the same IP address to the same venue within 10 minutes, all further attempts are blocked until the window passes.
- Bots that fill in the hidden "website" field are silently discarded — they receive a fake success response.
- If the same email address submits again, the existing contact's last name, phone, partner names, wedding date, and guest count are overwritten with any non-empty values from the new submission. First name and email are never changed on a repeat enquiry.
- If the contact already has an active pipeline card, no second card is created.
- The embed version (`/embed`) is explicitly excluded from search engine indexing.
- There is no CAPTCHA — the honeypot + rate limit are the only bot-protection measures at this stage.
- If sending the `lead/captured` event fails (e.g. the event queue is down), the submission is still fully saved and the couple still sees a success response. The brochure email may not go out, but the lead is not lost.
- The form does not currently support file uploads, multiple date options, or custom questions — the field set is fixed.

## Approve this page

Tick each statement if it's correct. These must be concrete, independently true/false behavior claims that together fully describe this surface — phrased so the venue owner can confirm them:

- [ ] The form is publicly accessible at a URL containing your venue's unique slug — no login required to view or submit it.
- [ ] Only the couple's first name and email address are required. All other fields (partner name, phone, guest count, wedding date, flexibility toggle, message) are optional.
- [ ] A couple who submits the form more than 5 times from the same device/network within a 10-minute window will be told "Too many submissions" and blocked until the window passes.
- [ ] If a couple submits with an email address already in your contacts list, their existing record is updated: last name, phone, partner names, wedding date, and guest count are overwritten with whatever the new submission provides (only when non-empty). First name and email are never changed.
- [ ] If a couple submits for the first time, a new contact is created and a pipeline card is placed at the top of "Inbound enquiry" automatically, with no action needed from venue staff.
- [ ] If the same contact submits a second time and already has an active pipeline card, no duplicate card is created — their existing card stays where it is.
- [ ] After a successful submission, the couple sees a confirmation screen telling them their brochure is on its way to the email address they provided.
- [ ] The embed version of the form (for your own website) has no VenueFlow branding, logo, or banner — it shows only the form fields and the submit button.
- [ ] The embed version is excluded from Google search results (it will not appear in search engines even if the page is crawled).
- [ ] A bot that fills in the hidden "website" field is silently discarded — it sees a success response but nothing is saved.
- [ ] If the downstream brochure-sending step fails, the couple's enquiry is still fully saved and they still see the success screen.
- [ ] Where you came from (Google, an Instagram ad, your own website, etc.) is captured automatically via UTM parameters if present — couples never have to fill this in themselves.

**Wrong or missing anything?** _Write it here:_

## Open questions for you

- The success message says "your brochure is on its way" even when no brochure has been uploaded. The `lead/captured` background job exits early with a "no-active-brochure" reason and sends nothing in that case — yet the couple already saw the promise. Should the success message be conditional on whether a brochure is configured, or is a different fallback copy needed?
- The rate limit is 5 submissions per IP per venue in 10 minutes. Is this the right threshold for your venues, or does it risk blocking legitimate couple households (e.g. two people on the same home WiFi both trying to enquire)?
- There is currently no CAPTCHA. Is the honeypot + rate limit sufficient for your comfort, or do you want to add a CAPTCHA before launch?
- The form field set is fixed — there is no way to add a custom question (e.g. "How did you hear about us?") through the venue settings. Is this a gap you need addressed before launch?
