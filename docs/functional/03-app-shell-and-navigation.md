# App Shell, Navigation & Venue Switching

**Where:** Every page inside the app (all routes under `/dashboard`, `/contacts`, `/pipeline`, `/appointments`, `/reports`, `/settings`)
**Who uses it:** Venue staff (anyone logged in with access to at least one venue)
**Status:** Partial ⚠️ — The shell, navigation, and sign-out are fully built. Venue switching logic exists in the backend but has no UI yet.

## In plain English

This is the frame that wraps every page of the app — the dark sidebar on the left, the slim bar across the top, and the main content area in between. It makes sure only logged-in staff who have finished setting up their venue can access the app. It also shows which venue you're working in and lets you navigate between sections.

## What you see / what you can do

**On a large screen (laptop/desktop):**
- A dark navy sidebar, 220px wide, runs the full height of the screen on the left.
- At the top of the sidebar: the "VenueFlow" wordmark.
- Below that, five navigation links (with icons): Dashboard, Contacts, Pipeline, Appointments, Reports.
- A dividing line, then: Settings.
- At the very bottom of the sidebar: a button showing your avatar initial, your venue name, and your email address. Clicking it opens a small menu with a "Sign out" option.
- A slim top bar across the content area shows your venue name on the left and your avatar initial on the right (static — no actions attached to the avatar in the topbar).
- The current page's nav link is highlighted.

**On a tablet (medium screen):**
- The sidebar collapses to a narrow icon rail (64px). Labels are hidden; icons remain. Hovering shows a tooltip with the label.
- The bottom user button shrinks to just the avatar. Clicking still opens the sign-out menu.
- The topbar is still visible.

**On a phone (small screen):**
- The sidebar is hidden completely.
- A slim mobile header bar appears at the top with the "VenueFlow" name and a hamburger menu button.
- Tapping the hamburger slides up a drawer from the bottom of the screen containing the full navigation and the sign-out menu. Tapping any link closes the drawer automatically.

**What you can do:**
- Navigate to any of the five main sections or Settings by tapping/clicking a link.
- Sign out from the user menu at the bottom of the sidebar (or inside the mobile drawer).

## How it works, step by step

### Auth & onboarding gate (runs in the app layout on every page load; uses getTenantContext)

Every time you navigate to any app page, the system quietly runs a check before showing you anything. `getTenantContext` resolves the context; the app layout performs all the redirects.

1. It verifies your login session is valid against Supabase (the auth server). If you're not logged in, the layout redirects you to `/login`.
2. It looks up every venue you have a membership in.
3. If you have no memberships at all, the layout redirects you to `/onboarding` to set up a venue.
4. It picks which venue to show you. If a saved preference cookie (`vf-venue-id`) exists and still matches one of your memberships, that venue is used. Otherwise it defaults to the first venue in your membership list (oldest first).
5. If the selected venue hasn't finished onboarding (i.e., setup was never completed), the layout redirects you to `/onboarding` to finish it. This check happens in the layout, not inside `getTenantContext` itself.
6. Only once all checks pass does the app shell render with your venue name and email passed into the sidebar and topbar.

### signOut

1. You click the user button at the bottom of the sidebar (or inside the mobile drawer).
2. A small dropdown appears with a red "Sign out" option.
3. You click "Sign out."
4. The system calls Supabase to end your session server-side.
5. You are immediately redirected to `/login`. No confirmation prompt.

### setActiveVenue (venue switching — backend ready, no UI yet)

This function exists in the codebase and is ready to use, but there is currently no button or menu anywhere in the app that calls it. It is not accessible to users right now.

When it is eventually wired up, here is how it will work:

1. A venue ID is submitted (e.g., from a future venue-switcher dropdown).
2. The system validates it's a properly formatted ID.
3. It checks that you actually have a membership for that venue. If not, it returns an error and nothing changes.
4. If valid, it saves the chosen venue ID in a cookie (`vf-venue-id`) that lasts one year. The next page load will pick up that venue automatically.

## Workflow

```
User navigates to any app page
   │
   ▼
getTenantContext runs the checks
   │
   ▼
Are you logged in?
   ├─ no  ─▶ Sent to /login
   └─ yes ─▶ continue
               │
               ▼
            Do you belong to any venue?
               ├─ no  ─▶ Sent to /onboarding
               └─ yes ─▶ continue
                           │
                           ▼
                        Is the preferred-venue cookie
                        set and still valid?
                           ├─ yes ─▶ Load that venue
                           └─ no  ─▶ Load first (oldest)
                                     membership venue
                           │
                           ▼
                        Has that venue finished onboarding?
                           ├─ no  ─▶ Sent to /onboarding
                           └─ yes ─▶ continue
                                       │
                                       ▼
Render app shell with venue name + user email
   │
   ▼
You see the sidebar, topbar, and page content
   │
   ▼
You click "Sign out"
   │
   ▼
Session ended server-side
   │
   ▼
Sent to /login
```

## Data it touches

- **users** (via Supabase Auth) — read on every page load to confirm the login session is still valid
- **memberships** table — read on every page load to find which venues the user belongs to and what role they hold
- **venues** table — read on every page load (joined through memberships) to get the venue name, slug, timezone, and whether onboarding is done
- **`vf-venue-id` cookie** — read on every page load to remember which venue was last active; written by `setActiveVenue` when a venue switch happens

## Rules & edge cases

- If your session expires mid-session, the next page navigation will redirect you to `/login` — you won't see an error, just a redirect.
- If someone shares a direct link to a page with you but you have no membership, you end up at `/onboarding`, not an error page.
- If the preferred venue cookie points to a venue you've since lost access to, the cookie is ignored and the system falls back to your oldest membership. The stale cookie is not cleared automatically.
- The topbar avatar and the sidebar bottom-button both show your email initial, but only the sidebar one is clickable (the topbar avatar has no action attached).
- There is no "switch venue" button anywhere in the current UI. If you belong to more than one venue, the app will always default to whichever venue the cookie remembers (or your oldest membership if no cookie). You cannot switch manually yet.
- Sign out has no confirmation step — one click ends the session immediately.
- The venue name shown in the sidebar and topbar is display-only. You cannot edit it from here.

## ✅ Approve this page

Tick each statement if it's correct. These must be concrete, independently true/false behavior claims that together fully describe this surface — phrased so the venue owner can confirm them:

- [ ] When I open any page in the app and I'm not logged in, I'm redirected to the login page — not an error screen.
- [ ] When I'm logged in but haven't finished setting up my venue, I'm redirected to onboarding rather than being shown a broken shell.
- [ ] The left sidebar shows five main links: Dashboard, Contacts, Pipeline, Appointments, Reports — plus Settings below a dividing line.
- [ ] The current page's nav link is visually highlighted so I always know where I am.
- [ ] On a tablet, the sidebar collapses to icons only (labels disappear but navigation still works).
- [ ] On a phone, the sidebar is replaced by a hamburger button that opens a slide-up drawer; tapping any link closes the drawer automatically.
- [ ] At the bottom of the sidebar I can see my venue name and email address, and clicking that area lets me sign out.
- [ ] Clicking "Sign out" ends my session immediately and takes me to the login page, with no confirmation prompt.
- [ ] The topbar (on desktop/tablet) shows my venue name on the left and my avatar initial on the right, but neither is clickable for any action.
- [ ] There is currently no way to switch between venues from within the app — a venue-switcher menu does not exist in the UI yet, even though the underlying logic is built.
- [ ] If I belong to multiple venues, the app currently always loads my oldest venue. The cookie-based "remember last venue" mechanism exists in the code, but it is unreachable because there is no venue-switcher UI to write the cookie — this will work automatically once a switcher ships.

**Wrong or missing anything?** _Write it here:_

## Open questions for you

- When venue switching is added to the UI, where should the switcher live — in the topbar, at the top of the sidebar, or somewhere else?
- Should sign out require a confirmation step ("Are you sure?"), or is the current one-click behaviour correct?
- The topbar avatar on the right has no action. Should it open a profile/account menu, or stay decorative?
- If a user loses access to a venue (their membership is removed), the stale cookie is not automatically cleared. Should the app clear it and show a message, or silently fall back to the next venue?
