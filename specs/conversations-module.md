# Conversations Module (V2)

Builds on `ghl-integration.md` §7 (Messaging Mirror). GHL is the record of truth — VF2 stores **no** messages (D3). This spec adds two surfaces on top of the existing per-wedding Messages tab and consolidates all three onto one shared component.

## Goals

1. **Contact conversations** — view & reply to a contact's GHL threads from `/contacts/[id]/messages`.
2. **Global inbox** — `/conversations`: every open thread in the venue's GHL location, triage-first.

## Decisions (locked this session)

- **D-C1 — Inbox default = unread, toggle to all.** Opens on "needs attention" (`status=unread`), staff can flip to `all`. (`?filter=unread|all` search param.)
- **D-C2 — One shared component, keyed on `ghlContactId`.** The contact page, the wedding Messages tab, and the inbox detail pane all render the same thread view. No per-surface duplicates.
- **D-C3 — Inbox shows ALL GHL threads; unmatched contacts open inline only.** Rows whose `contactId` matches a V2 `contacts.ghl_contact_id` deep-link to `/contacts/[id]`; unmatched rows open in the detail pane with a "not in VenueFlow" tag. Nothing is auto-created (preserves the post-booking boundary).

## Architecture

### Data layer — `src/lib/ghl/client.ts` + `types.ts`
- Keep `listConversations({ contactId })`, `getMessages`, `sendMessage` as-is.
- **Add `searchConversations({ status?, limit? })`** → `GET /conversations/search?locationId=&status=&sortBy=last_message_date&sort=desc` (location-wide, no contactId). Returns `GhlInboxConversation[]` (adds `contactName`/`fullName` to the thread shape).
- `normalizeChannelType()` maps GHL's raw `type`/`lastMessageType` → `SMS | Email | WhatsApp` for display (best-effort; unknown → falls back to a generic icon).

### Server actions — `src/app/(app)/conversations/actions.ts`
- **`sendMessageByContactAction({ ghlContactId, type, message, subject? })`** — auth + `assertCanMutate`, resolve `ghlClient(venue.id)`, `client.sendMessage`. Security: the venue's PIT is scoped to its own GHL location, so a staffer can only ever message contacts in their own location — no extra V2-contact check needed (this is what lets replies to unmatched inbox threads work).
- **`getThreadMessagesAction(conversationId)`** — auth, `ghlClient`, `client.getMessages`. Used by both surfaces to load a thread on select (replaces the old `router.refresh()` approach, which only ever fetched the first thread).

### Shared UI — `src/components/conversations/`
- `thread-view.tsx` ("use client") — `ChannelIcon`, `MessageBubble`, `ReplyComposer` (calls `sendMessageByContactAction`), `ThreadDetail`, `ConversationsPane` (contact-scoped: one contact, N channel threads), `ConnectPrompt`. Subscribes to Realtime `contact:{ghlContactId}:messages`.
- `inbox-client.tsx` ("use client") — global inbox: left = contact-thread rows (name + preview + unread), unread/all toggle, right = `ThreadDetail`. Matched contacts deep-link; unmatched tagged. Subscribes to `venue:{venueId}:inbox`.

### Pages
- `src/app/(app)/conversations/page.tsx` — inbox server page. Reads `?filter`, `searchConversations`, builds a `Map<ghl_contact_id → v2 contact id>` from the venue's `contacts`, renders `InboxClient`.
- `src/app/(app)/contacts/[id]/messages/page.tsx` — contact messages. Loads contact (venue-scoped) → `ghl_contact_id` → `listConversations` → `ConversationsPane`. Graceful prompts when no GHL / no `ghl_contact_id`.
- `weddings/[id]/messages/page.tsx` — repointed to render `ConversationsPane` with the wedding's `ghl_contact_id`. Old `messages-client.tsx` + `actions.ts` + `actions.test.ts` deleted.

### Realtime — `src/app/api/webhooks/ghl/route.ts`
- `InboundMessage` → broadcast on **`contact:{contactId}:messages`** (drops the old wedding lookup — the webhook already has `contactId`) **and** a list-refresh ping on **`venue:{venueId}:inbox`**. Best-effort, always acks 200.

### Nav
- Add **Inbox** (`/conversations`, `MessageSquare` icon) to the sidebar. Add a **Messages** link on the contact detail header.

## Out of scope (YAGNI)
- No message storage, search, or analytics in VF2.
- No assignment / ownership / starring beyond what GHL returns.
- No multi-venue aggregated inbox (agency owners see their active venue only).
- Channels beyond SMS/Email/WhatsApp for *sending* (display passes through whatever GHL returns).
