# Pipeline (Kanban Board)

**Where:** `/pipeline`
**Who uses it:** Venue staff (anyone logged in to the venue account)
**Status:** Built ✅

## In plain English

The Pipeline is a visual board that shows every active enquiry your venue has received, sorted into eight stages from "just enquired" through to "wedding booked." Each enquiry appears as a card you can drag from one stage to the next as you progress it. It is the day-to-day working view for managing your bookings funnel.

## What you see / what you can do

- Eight columns side by side, one per stage, scrollable horizontally
- Each column has a coloured label at the top and a count of how many cards are in it
- Each card shows the couple's name(s), their wedding date (or "No date"), guest count if known, and where the enquiry came from (source tag)
- Drag any card left or right to move it to a different stage, or up and down to reorder within a column
- Hover a card to reveal a three-dot menu — use it to move the card to any stage via a dropdown list, or jump straight to the couple's full contact record
- Click anywhere on a card (not the menu) to open a side panel showing all the key details: email, phone, wedding date, guest count, budget, and source
- The side panel has a button to open the couple's full contact record
- When a card lands in "Wedding booked," a brief celebration animation plays on that card
- If the board is empty (no enquiries yet), a prompt appears to share the enquiry form or add a contact by hand

## How it works, step by step

### Page load

1. The server checks you are logged in; if not, it sends you to the login page.
2. It fetches every opportunity for your venue where `archived_at` is null — meaning only non-archived enquiries appear on the board.
3. Enquiries are sorted by their `sort_index` value (a number that tracks position within a column) before being grouped into the eight columns.
4. The filled board is sent to the browser. From this point the browser holds the authoritative copy for the session; the board does not automatically refresh when someone else makes a change.

### moveOpportunity

This is what runs every time a card is dropped into a new position or moved via the menu.

1. The browser updates the board immediately — the card appears in its new position right away (optimistic update).
2. At the same time, a request is sent to the server with three pieces of information: which card moved, which stage it landed in, and its new position number (`sort_index`).
3. The server confirms you are logged in and that the card belongs to your venue.
4. It updates two fields on the opportunity: `stage` (the new stage name) and `sort_index` (the new position number). Nothing else changes.
5. If (and only if) the card has landed in a **different stage**, the database trigger `log_stage_event` fires and writes a record to the `stage_events` table noting the old stage, the new stage, who made the change, and when — this is the permanent audit trail. A reorder within the same column updates the position number but logs no stage event.
6. If the save fails, the card snaps back to where it was and an error message appears.
7. If the save succeeds and the destination stage was "Wedding booked," the celebration animation fires.
8. The contacts area of the app is refreshed in the background so that stage labels there stay in sync with the board.

### Drag and drop (handleDragStart / handleDragOver / handleDragEnd)

1. Pick up a card (click and hold, or touch and hold). A snapshot of the current board is saved as a safety copy in case the save fails later.
2. While dragging, the card appears slightly rotated and the column underneath highlights to show it will accept the drop.
3. As you drag across column boundaries, the card visually moves into the new column so you can see where it will land before releasing.
4. Drop the card. The final position is calculated and `moveOpportunity` is called (see above).
5. If you drop the card in the exact same spot it started, nothing happens and no save is sent.

### moveToStage (menu / keyboard path)

1. Click the three-dot menu on a card and choose "Move to stage," then pick any stage except the one the card is already in.
2. The card moves to the top of the chosen column immediately.
3. `moveOpportunity` is called with the new stage and a position number that places it first in that column.

## Workflow

```
Page loads
   │
   ▼
Fetch all non-archived opportunities for this venue
   │
   ▼
Any enquiries?
   ├─ no  ─▶ Show empty-board prompt
   └─ yes ─▶ Render board with 8 fixed columns
               (any stage can move to any stage)
   │
   ▼
Staff acts on a card:
   ├─ Drags it to a new column or position
   └─ Uses three-dot menu: "Move to stage"
   │
   ▼
Board updates instantly (optimistic)
   │
   ▼
moveOpportunity sent to server
(saves new stage + position number)
   │
   ▼
Did the save succeed?
   ├─ no  ─▶ Card snaps back, error message shown
   └─ yes ─▶ continue
               │
               ▼
            Did the stage actually change?
               ├─ no  ─▶ Position saved only (no log)
               └─ yes ┄┄▶ Database trigger logs a row to
                          stage_events (old stage, new
                          stage, who, when)
               │
               ▼
            Did it land in "Wedding booked"?
               ├─ no  ─▶ Done
               └─ yes ─▶ Celebration animation plays
                         (skipped if "reduce motion" is on)
```

## Data it touches

- **opportunities** table — read on page load; `stage` and `sort_index` columns updated on every card move
- **stage_events** table — one row appended automatically by the database every time a card changes stage (records old stage, new stage, who moved it, and when); staff cannot write to this table directly
- **contacts** table — read on page load; name, wedding date, guest count, and source are shown on the card, with email, phone, and budget additionally shown in the card's side panel

## Rules & edge cases

- Only enquiries with no `archived_at` date appear on the board — archived ones are invisible here
- Moving a card to the "Archived" stage does NOT set the `archived_at` date; `archived_at` is a separate field controlled elsewhere. The card will therefore continue to appear on the board even after being moved to the Archived column until `archived_at` is explicitly set
- The eight stages are fixed and cannot be renamed, reordered, or added to — they are: Inbound enquiry, Responded, Viewing interest, Appointment booked, Appointment attended, Date on hold, Wedding booked, Archived
- A card can be moved from any stage to any other stage in one action — there is no enforced step-by-step progression
- Each contact can have only one active (non-archived) opportunity at a time
- The board does not live-refresh; if a colleague moves a card at the same time, you will not see their change until you reload the page
- If the server save fails after a drag, the card returns to its original position and a message appears telling you to try again
- The celebration animation is skipped if the user has "reduce motion" enabled in their operating system settings
- The board is scrollable horizontally to show all eight columns; each column is a fixed 300px wide

## Approve this page

Tick each statement if it is correct. These are the concrete behaviors you are approving:

- [ ] The board shows only enquiries where `archived_at` is null — permanently archived enquiries do not appear
- [ ] There are exactly 8 columns in this fixed order: Inbound enquiry, Responded, Viewing interest, Appointment booked, Appointment attended, Date on hold, Wedding booked, Archived
- [ ] Dragging a card or using the "Move to stage" menu both call the same save function (`moveOpportunity`), which only updates the stage and the card's position number — nothing else
- [ ] Every time a card changes stage, the database automatically records the old stage, the new stage, the user who moved it, and the timestamp — staff cannot edit or delete these records
- [ ] Moving a card into the Archived column does NOT mark it as archived (no `archived_at` date is set); the card stays visible on the board
- [ ] When a card is dropped into "Wedding booked," a brief animation plays on that card — unless the user has "reduce motion" turned on in their device settings, in which case it is skipped
- [ ] If the server fails to save the card move, the card snaps back to its original position and an error message appears
- [ ] Clicking a card opens a side panel showing email, phone, wedding date, guest count, budget, and source — with a button to open the full contact record
- [ ] The board does not auto-refresh; a page reload is required to see changes made by other staff members
- [ ] A card can be moved directly from any stage to any other stage — for example from "Inbound enquiry" straight to "Wedding booked" — with no restrictions

**Wrong or missing anything?** _Write it here:_

## Open questions for you

- Moving to the Archived column currently does not actually archive the enquiry (no `archived_at` is set). Is the Archived column intended to work differently to the other seven, and if so, how should archiving be triggered?
- Should staff be able to delete a card (and its contact) from the pipeline board, or only from the full contact record?
- When two staff members move cards at the same time, the last save wins silently. Is that acceptable, or do you want a warning when the board is out of date?
