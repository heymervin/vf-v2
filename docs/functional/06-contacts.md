# Contacts

**Where:** `/contacts` (list) and `/contacts/[id]` (detail)
**Who uses it:** Venue staff
**Status:** Built ✅

## In plain English

Contacts is the venue's enquiry list — every couple who has ever reached out lives here. Each contact has a matching entry on the sales pipeline, so what you see on this screen and what you see on the Kanban board are always the same data. Staff use this page to browse, search, add new enquiries by hand, update a couple's details, or permanently remove a contact.

## What you see / what you can do

**On the list page (`/contacts`):**
- A table showing all contacts for your venue, newest first, up to 500 rows at a time
- Each row shows: couple name, email and phone, current pipeline stage (colour-coded badge), wedding date, and where the enquiry came from (source)
- A search box — type a name or email and the list filters as you type (after a brief pause)
- A "Stage" dropdown to filter the list to contacts in one particular pipeline stage
- A "Source" dropdown (only appears once at least one contact has a source recorded) to filter by where enquiries came from
- A "Clear" button that appears whenever any filter is active, removing all filters at once
- A "New contact" button in the top-right corner to add an enquiry by hand
- If no contacts match the current filters, a message says so and suggests clearing filters
- If the venue has no contacts at all, a welcome message explains how to add the first one

**On the detail page (`/contacts/[id]`):**
- The couple's full name as a heading, with their pipeline stage badge beside it
- Partner's name shown underneath if one was recorded
- A "Details" panel with: email, phone, wedding date (marked "flexible" if that was ticked), guest count, budget (shown in pounds), and source
- An "Activity" panel showing a timeline of every stage change, newest at the top — e.g. "Enquiry created in Inbound enquiry" or "Moved from Responded to Viewing interest", each with a date and time
- An "Edit" button to open the edit form (same panel as creating a contact, pre-filled with current details)
- A "Delete" button to permanently remove the contact

## How it works, step by step

### createContact

This is triggered when a staff member clicks "New contact", fills in the form, and clicks "Create contact".

1. The form validates the inputs immediately (first name required; email must be a valid format if entered; guest count must be a whole number; budget must be a number; field lengths checked)
2. On submit, the system sends the data to the server
3. The server double-checks validation, then calls a database function (`create_contact_with_opportunity`) that does two things in one go:
   - Creates the contact record
   - Creates a linked pipeline entry automatically, starting the couple at the **Inbound enquiry** stage, placed at the top of that column on the Kanban board
4. If the email address is already used by another contact at this venue, the form shows "A contact with this email already exists" and stops
5. On success: the form panel closes, a "Contact created" message appears briefly, and the contacts list refreshes to show the new entry

### updateContact

This is triggered when a staff member clicks "Edit" on a contact detail page, changes something, and clicks "Save changes".

1. The edit form opens pre-filled with the contact's current details
2. The same validation rules apply as when creating
3. On submit, the system updates the contact record in the database (contact details only — the pipeline stage is changed on the Kanban board separately, not here)
4. If the new email conflicts with another contact at this venue, the form shows an error
5. If the contact cannot be found (e.g. deleted in another tab), the form shows an error
6. On success: the form panel closes, a "Contact updated" message appears, and both the list and detail page refresh

### deleteContact

This is triggered when a staff member clicks "Delete" on a contact detail page.

1. A confirmation dialog appears: "Delete [Name]? This removes the contact, their opportunity, and pipeline history. This cannot be undone."
2. The staff member must click "Delete contact" to confirm (or "Cancel" to back out)
3. On confirm, the system permanently deletes the contact from the database
4. Deleting a contact automatically removes their pipeline entry and all stage-change history (this is enforced at the database level — there is no soft-delete or archive)
5. On success: a "Contact deleted" message appears, and the user is taken back to the contacts list

## Workflow

```
Contacts list
   │
   ▼
What does staff do?
   │
   ├─ New contact ─▶ Fill in the form panel
   │                    │
   │                    ▼
   │                 Is the form valid?
   │                    ├─ no  ─▶ show error in form, stay on form
   │                    └─ yes ─▶ create contact + pipeline entry
   │                              (starts at "Inbound enquiry")
   │                                 │
   │                                 ▼
   │                              back to Contacts list
   │
   └─ Click a row ─▶ Contact detail page
                        │
                        ▼
                     What does staff do here?
                        │
                        ├─ Edit ─▶ Edit form opens, pre-filled
                        │             │
                        │             ▼
                        │          Is the form valid?
                        │             ├─ no  ─▶ show error, stay on form
                        │             └─ yes ─▶ save contact details
                        │                       (stage unchanged)
                        │                          │
                        │                          ▼
                        │                       back to detail page
                        │
                        └─ Delete ─▶ Confirmation dialog
                                  │
                                  ├─ Cancel  ─▶ back to detail page
                                  └─ Confirm ─▶ delete contact +
                                                pipeline + history
                                                   │
                                                   ▼
                                                back to Contacts list
```

## Data it touches

- **contacts** — read and written for all contact details (name, email, phone, partner name, wedding date, guest count, budget, source)
- **opportunities** — one record is created automatically for each new contact; read on the list and detail pages to show the current stage; deleted when a contact is deleted
- **stage_events** — read on the detail page to show the activity timeline; new records are written automatically by the database whenever a pipeline stage changes (staff cannot write these directly)

## Rules & edge cases

- **First name is required.** All other fields are optional.
- **Email must be a valid email format** if provided (e.g. `someone@example.com`). Leaving it blank is fine.
- **No two contacts at the same venue can share the same email address.** The system blocks this and shows an error.
- **Budget is entered in pounds (e.g. 5000) and stored as pence internally.** It displays back as "£5,000" with no decimal places.
- **Guest count must be a whole number between 0 and 100,000.**
- **Budget cannot exceed £10,000,000.**
- **Every new contact starts at the "Inbound enquiry" stage** — this cannot be overridden from the create form.
- **Moving a contact between pipeline stages is done on the Kanban board, not here.** Editing a contact only changes their details.
- **Deleting a contact is permanent and immediate** — there is no undo, no archive, no recycle bin.
- **Deleting a contact also deletes their pipeline entry and all stage history** — this happens automatically at the database level.
- **The list shows at most 500 contacts at a time.** There is no pagination — if you have more than 500, only the 500 newest appear.
- **The source filter dropdown only appears if at least one contact has a source recorded.**
- **Search matches on first name, last name, or email.** It does not search phone numbers, partner names, or other fields.
- **A contact with no pipeline entry shows "—" in the Stage column** on the list. In practice this should not happen for contacts created through VenueFlow.

## ✅ Approve this page

Tick each statement if it's correct. These must be concrete, independently true/false behavior claims that together fully describe this surface — phrased so the venue owner can confirm them:

- [ ] The contacts list shows every enquiry for the venue, sorted newest-first, with name, email/phone, pipeline stage, wedding date, and source visible on each row.
- [ ] Clicking any row takes you to that contact's detail page.
- [ ] Typing in the search box filters the list by first name, last name, or email (with a short delay as you type). Searching does not look at phone or partner name.
- [ ] The Stage dropdown and Source dropdown filter the list; the Source dropdown only appears once at least one contact has a source.
- [ ] A "Clear" button appears whenever any filter is active and removes all filters when clicked.
- [ ] Clicking "New contact" opens a side panel form. The only required field is first name. All other fields (last name, email, phone, partner name, wedding date, guest count, budget, source) are optional.
- [ ] Creating a new contact automatically creates a linked pipeline entry, starting the couple at the "Inbound enquiry" stage at the top of that column.
- [ ] If you enter an email address that already exists for another contact at the same venue, saving is blocked with an "already exists" error.
- [ ] The contact detail page shows a Details panel (email, phone, wedding date, guest count, budget, source) and an Activity panel listing every stage change with a date and time.
- [ ] Clicking "Edit" on the detail page opens the same form pre-filled with the contact's current details. Saving only updates contact details — it does not change their pipeline stage.
- [ ] Clicking "Delete" shows a confirmation dialog naming the contact. The contact, their pipeline entry, and all stage history are permanently deleted after confirmation. There is no undo.
- [ ] The list shows a maximum of 500 contacts. There is no way to load more within the current page.

**Wrong or missing anything?** _Write it here:_

## Open questions for you

- The list caps at 500 contacts with no pagination. Is that sufficient for now, or do you want a "load more" option added before launch?
- Budget is displayed in pounds (GBP, £). Is that the right currency for all venues using VenueFlow, or will some venues need a different currency?
- The "Source" field is a free-text box on the form (staff type it in). Should this eventually be a dropdown of standard values (e.g. Website, Hitched, Referral, Walk-in) to keep the data consistent for filtering and reporting?
