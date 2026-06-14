# VenueFlow — UAT Readiness

**Date:** 2026-06-14
**Branch:** per-page-function-docs
**Scope of this report:** hands-on user acceptance testing — a real venue owner using the running app end to end. (A separate, lower-bar "document review" UAT of the functional specs in `docs/functional/` can already proceed; that requires no running app.)

## ✅ UPDATE 2026-06-14 — code blockers cleared (verdict now: GO once the 3 infra steps run)

> **All code-fixable blockers below were fixed and verified the same day — see `docs/FIXES.md`.** `pnpm typecheck`, `pnpm lint`, and `pnpm build` now all pass (build went from FAIL → exit 0). The P0 correctness defects (dead CTA, brochure-promise) and every confirmed P1/P2 are resolved.
>
> **The only remaining gates are infrastructure, which require your cloud accounts (they can't be done from the repo):** (1) provision Supabase + `supabase db push`, (2) set real Supabase/Resend/Inngest env + `NEXT_PUBLIC_APP_URL`, (3) deploy + run `node scripts/seed-demo.mjs`. Follow **`SETUP.md`**. Once those run and testers get the URL + `demo@venueflow.io` / `WeddingDemo123!`, this is a **GO**.
>
> The original NO-GO analysis is kept verbatim below for the record.

---

## Verdict (original): NO-GO (for hands-on UAT) — close to ready, blocked on enablement + two correctness fixes

**Can we start hands-on UAT right now? No — but the gap is small and mostly operational, not deep code rot.** The application's core spine is genuinely sound: typecheck passes, lint is clean (warnings only), the multi-tenant security model is solid and ready for real client data, and the admin CRM (contacts, pipeline, settings, brochure) is testable end to end. What blocks UAT is a short, concrete list: **(1) the production build currently fails**, (2) **there is no environment to test against** — no `.env.local`, no hosted instance, no test account until the seed runs, and (3) **two couple-facing correctness defects** that will mislead the very first tester (a dead "Get started" button on the front door, and a "your brochure is on its way" promise shown even when no email is sent). None of these are architectural; all are fixable in roughly a day of focused work plus standing up a Supabase project. Once the P0 list below is cleared and a hosted URL + demo login are handed to testers, this becomes a confident GO.

---

## Build & test health

Mechanical results from `docs/_uat/build-health.txt` (run 2026-06-14):

| Check | Result | Notes |
|---|---|---|
| `tsc --noEmit` (typecheck) | **PASS** (exit 0) | Clean. |
| `eslint` (lint) | **PASS** (exit 0) | 0 errors, 4 warnings — 3 are benign React-Compiler "skipped memoization" notices on RHF `watch()`, 1 is a `<img>`-vs-`next/image` hint on the onboarding logo preview. None block. |
| `next build` (production build) | **FAIL** (exit 1) | Build **compiles and typechecks fine**, then fails during static prerender of `/signup`: `@supabase/ssr: Your project's URL and API key are required to create a Supabase client!` The page tries to build a Supabase client at prerender time with no env present. |

**Read on the build failure:** this is the **same root cause as the missing `.env.local`** — not a logic bug. With Supabase env vars available at build time (and/or the `/signup` route marked dynamic so it isn't statically prerendered), the build will pass. It must be resolved before any deploy, because **you cannot host a build that does not compile a production bundle.** It is listed as P0 below.

**E2E suite state:** 6 Playwright spec files / 8 tests exist, covering the five core built flows (onboarding, contacts CRUD, pipeline drag + menu-move, public enquiry form, brochure upload + proxy). They **cannot run as-is**:
- No `.env.local` in the repo, so the test harness (which creates/deletes real Supabase auth users via the service-role key) throws on startup.
- No `test`/`e2e` script in `package.json` — must invoke `pnpm exec playwright test` manually.
- The screenshot output dir `logs/data/screenshots/` does not exist, so screenshot-writing specs `ENOENT`.
- The pipeline drag test is known-flaky (`retries: 2` configured on that describe block).
- Several fully-built flows have **zero** automated coverage: sign-up + email confirmation, sign-out, the auth redirect guard, settings/forms, contact delete, the brochure-absent UX, and the entire tenant-isolation guarantee. These are the highest manual-UAT-risk paths.

---

## What blocks UAT today (P0)

Must be cleared before a tester can meaningfully use the app. Ordered by sequence you'd actually fix them.

1. **Production build fails (`next build` exit 1).** `/signup` prerender throws because no Supabase env exists at build time. Fix by providing build-time env and/or forcing `/signup` to render dynamically (`export const dynamic = "force-dynamic"`). *Blocks every deploy.* (`docs/_uat/build.txt`)

2. **No environment configured — `.env.local` is absent.** Only `.env.example` is committed. All three Supabase bindings are read with non-null assertions (`src/proxy.ts:31-32`, `src/lib/supabase/admin.ts:12-13`, `src/lib/supabase/client.ts:9-10`); without them, auth fails on the first authenticated request and the seed/RLS scripts throw immediately. *Nothing works until this is populated.*

3. **No deployed/hosted instance — app is localhost-only.** No `vercel.json`, `netlify.toml`, `Dockerfile`, or `.github/` CI. README is unmodified create-next-app boilerplate. A non-developer tester has no URL to open. *UAT cannot be handed off until a hosted preview exists.*

4. **No test account until the seed runs.** The demo owner (`demo@venueflow.io` / `WeddingDemo123!`, venue `the-old-barn-demo`) is created by `scripts/seed-demo.mjs`, which needs `.env.local` + a linked Supabase project with migrations applied. Run it before inviting testers.

5. **Marketing landing CTAs are dead — no path into the product from the front door.** `src/app/page.tsx:38-43` renders `Get started` and `See the pipeline` as bare `<Button>` with no `href`/`Link`/`onClick`. The literal front door's primary CTA does nothing when clicked. *(Adversarially downgraded from "critical" to high — signup IS reachable by typing `/signup` or via the login page's "Create one" link — but it is a visibly broken primary CTA on the first screen, exactly the kind of first-impression defect UAT exists to catch.)* Fix: wrap in `<Button asChild><Link href="/signup">` (point "See the pipeline" at `/login` or a demo). Trivial.

6. **"Your brochure is on its way" is shown even when no email is sent.** `src/app/(public)/f/[venueSlug]/lead-form.tsx:103-108` hardcodes the success copy unconditionally. On a fresh UAT setup with no `RESEND_API_KEY`, `sendEmail` silently skips (`src/lib/email/send.ts:41-46`) — so **every test enquiry gets the promise and zero emails arrive**, even with the seeded active brochure. A tester will conclude email delivery is broken. *(Adversarially CONFIRMED high.)* Fix for UAT: set `RESEND_API_KEY` with a verified sending domain **and** gate/soften the success copy on whether a brochure + email actually went out (have the form action return brochure/send status).

> **Net P0 read:** items 1–4 are enablement/ops (a day of setup, no app-code risk). Items 5–6 are small, high-visibility couple-facing correctness fixes. Clear all six and hands-on UAT can start.

---

## Fix soon (P1)

Confirmed high/medium issues that should be addressed during or immediately after UAT — they will produce confusing or misleading tester sessions but do not hard-block starting.

- **Brochure replace is non-transactional (CONFIRMED high).** `src/app/(app)/settings/actions.ts:42-55` deactivates the old brochure, then inserts the new one, with no transaction and the deactivate error unchecked. A DB UNIQUE partial index (`uq_brochures_active_venue`) *forces* the deactivate-first ordering, so a failed insert leaves the venue with **zero active brochures** — silently. Downstream, every new enquiry then gets the "on its way" promise but no email. Replacing a brochure is the common seasonal operation. Fix: make it one `SECURITY DEFINER` RPC (deactivate + insert + return), check the deactivate error, and clean up the orphaned storage object on failure.

- **Primary "Sign out" may not navigate (CONFIRMED medium, was high).** `src/components/layout/app-sidebar.tsx:196-204` calls the redirecting `signOut()` server action from a `DropdownMenuItem` `onSelect` handler — the pattern Next's own docs say to avoid (use a `<form action>` or `useRouter`). The onboarding waiting-screen already does it correctly via a form action, proving the sidebar is the inconsistent path. Worst case: session clears server-side but the user sits on a stale page until manual refresh. Fix: mirror the form-action pattern.

- **Guest-count field rejects decimals/text with a raw Zod error (CONFIRMED medium, was high).** The public lead form's number input has no `step`/validation; the server requires an integer (`lead.ts:30-33`). Typing `12.5` or pasting `120 ish` blocks the whole enquiry with `Invalid input: expected int, received number` — on an **optional** field. The internal contacts form already guards this with a `/^\d*$/` pattern; the public path just omits it. Fix: add `step="1"` + the same RHF pattern, and/or have the server round/drop un-parseable values.

- **Authenticated no-venue user landing on `/` is stranded (CONFIRMED medium).** `proxy.ts` doesn't redirect `/`, so a logged-in user who hits the home page sees the same dead-button marketing page. Fix alongside the CTA fix, or redirect `/` to `/dashboard`/`/onboarding` for authed users.

- **Login page never shows its `?error=` flags (CONFIRMED medium).** The callback redirects failures to `/login?error=missing_code|callback_failed|no_user`, but the login page reads no `searchParams` — an expired/used magic link dead-ends on a blank form with no explanation. Common during UAT when links sit in an inbox. Fix: render a friendly message for those flags.

- **Logo upload failures swallowed silently; drag-drop bypasses the type/size filter (CONFIRMED medium).** Failed uploads are only `console.error`'d (`onboarding/actions.ts:153-165`); the `accept` attr only constrains the picker, not drops. Tester finishes onboarding with no logo and no explanation. Fix: client-side validate in the drop handler + surface a non-blocking toast on server failure.

- **Contacts list silently caps at 500 rows (CONFIRMED medium).** `contacts/page.tsx` hard-limits to 500 with no count, pagination, or "showing X of Y", while the header claims "Every enquiry." A high-volume venue loses its oldest leads from the screen with no warning. Fix: paginate or render an explicit cap banner + soften the copy.

- **Pipeline board never re-fetches after first load (CONFIRMED medium).** The board seeds once and deliberately skips `revalidatePath('/pipeline')` on move/create. Two staff diverge until a hard reload; a newly created contact won't appear on an already-open board. Fix: reconcile by id on prop change and/or re-sync on window focus.

- **Optimistic drag rollback uses a single shared snapshot (CONFIRMED medium).** Rapid successive moves on a flaky connection can roll back to the wrong board state. Fix: capture a per-move closure-local snapshot.

- **Public embed has no `X-Frame-Options`/`frame-ancestors`, and rate-limiting is bypassable (CONFIRMED medium x2).** The form is framable by any origin; the per-IP limit no-ops when the IP can't be resolved and the leftmost `x-forwarded-for` is attacker-controllable. Not a cross-tenant leak, but a junk-lead / clickjacking vector against a tenant's own pipeline. Fix before public go-live: add Turnstile/captcha, use the platform's trusted client IP, treat null-IP as rate-limited.

- **Inngest endpoint skips signature verification in dev mode (CONFIRMED medium, was high).** `/api/inngest` is public and validates signatures only in cloud mode with a key. Production (cloud + key) is safe and rejects unsigned POSTs; the risk is **only** if a UAT/staging deploy is run in dev mode or with `INNGEST_DEV` set. Fix: set `INNGEST_SIGNING_KEY` in every deployed env and assert cloud mode at boot.

- **Test gaps with real UAT risk (CONFIRMED high/medium):** sign-up + email-confirmation round-trip has no e2e test (Supabase-template/redirect-allowlist config a manual pass must catch); the brochure-absent success-copy path has no negative test; auth redirect guards, sign-out, and **tenant isolation** have no e2e coverage. The tenant-isolation gap is the most important to verify manually (or wire the existing `scripts/rls-cross-tenant.mjs`) before inviting a second venue.

---

## Nice to have (P2)

Low-severity polish — log them, fix opportunistically; none affect UAT outcomes.

- **Past wedding dates accepted** — `z.iso.date()` checks format only; `<input type="date">` has no `min`. Pollutes data. Add `min={today}` + a `refine`.
- **No branded not-found/error UI for the `(public)` route group** — a bad/stale slug renders Next's bare 404; inside an embed iframe on a venue's own site this looks broken. Add `(public)/not-found.tsx` + `error.tsx`.
- **Demo seed installs a 60-byte stub PDF** — clicking "download brochure" yields an unrenderable file, making the last step look broken even when delivery worked. Seed a real sample PDF.
- **`EMAIL_FROM_DOMAIN` vs `EMAIL_FROM_ADDRESS` mismatch** — `.env.example` documents `EMAIL_FROM_DOMAIN`; code reads `EMAIL_FROM_ADDRESS` (`send.ts:18`). The documented var is a no-op; sender is effectively hardcoded. Align the names.
- **`NEXT_PUBLIC_APP_URL` default points to production** — in a staging deploy without it set, brochure email links and the embed snippet point at `venueflow.io`, not the staging host. Set it per environment.
- **Brochure email link's `?c=contactId` is never read** — no per-couple download attribution despite the URL implying it. Drop it or consume it in `/b/[token]`.
- **Brochure replace orphans the old PDF in storage** — slow cost bloat over time. `storage.remove` the prior file after a successful replace.
- **Step-3 onboarding hours reset on Back/forward** — edits aren't lifted into wizard state; silent data loss. Lift hours into wizard state.
- **Member "venue still being set up" screen doesn't update live** — needs manual refresh after the owner finishes. Add polling or a Refresh button.
- **Appointments & Reports are bare stubs in the primary nav** — a tester clicks in and may log them as "broken" rather than "not built yet." Add a "Soon" badge / clearer empty state.
- **Dashboard is a static getting-started panel with no live numbers** — reads as stale after data exists. Render a couple of real counts or adjust copy.
- **List/detail queries swallow DB errors (console-only)** — a transient failure renders as "empty," indistinguishable from "no data." Add an error+retry state.
- **`reply_to`/`from_name` not fully sanitized in email send** — own-tenant cosmetic/deliverability only. Validate with `z.email()` and strip CR/LF.
- **`SLUG_TAKEN` mis-reported for slug *format* violations** — substring match on "slug" catches the format CHECK constraint name. Match on `23505`/unique constraint name instead.
- **No `pnpm test` script / E2E setup undocumented / screenshots dir missing** — add `"test": "playwright test"`, a `mkdir -p logs/data/screenshots` pretest, and README setup notes.
- **No setup documentation** — README is boilerplate; the multiplier on every infra gap above. Write a minimal SETUP covering env, migrations, seed, Inngest, Resend, dev servers, demo login.

---

## To stand up a UAT environment

A concrete checklist to go from this repo to a tester-ready instance.

1. **Provision Supabase.** Use an existing hosted project (per project memory, `kcnsywedplpliqfryejg` already has M0–M3 migrations applied + RLS verified) or `supabase link` a fresh one and `supabase db push` all 5 migrations. The `brochures` storage bucket is created by migration `20260611160000_m3_lead_capture.sql` — no manual bucket step needed.
2. **Create `.env.local`** from `.env.example` and populate all three Supabase vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. (For a hosted deploy, set these as platform env vars instead.)
3. **Configure email (required for the brochure flow).** Set `RESEND_API_KEY` and a verified sending domain (`mail.venueflow.io` per the default `from`). Without it, enquiry emails silently skip. Note the `EMAIL_FROM_DOMAIN`/`EMAIL_FROM_ADDRESS` naming mismatch — the code reads `EMAIL_FROM_ADDRESS`.
4. **Configure Inngest for whatever environment you deploy to.** For local dev, run the Inngest Dev Server (`npx inngest-cli@latest dev -u http://<host>/api/inngest`) **and** set `INNGEST_DEV=1` in the Next process — otherwise background jobs never fire and the brochure email never sends, silently. For a hosted UAT deploy, set `INNGEST_SIGNING_KEY` + `INNGEST_EVENT_KEY` (cloud mode) and register the deployment URL in the Inngest dashboard.
5. **Set `NEXT_PUBLIC_APP_URL`** to the actual UAT host so brochure links and the embed snippet point at the right place (not the production default).
6. **Fix the build** (P0 #1) so `next build` succeeds, then **deploy** (Vercel is the path of least resistance: import the repo, copy env vars, deploy the branch).
7. **Seed the demo data:** `node scripts/seed-demo.mjs` — creates the venue `the-old-barn-demo` with an active brochure + email settings, and the login below.
8. **(Recommended) Run the isolation check:** `node scripts/rls-cross-tenant.mjs` to confirm tenant separation before inviting a second venue.
9. **Hand testers the URL + demo login:** `demo@venueflow.io` / `WeddingDemo123!`. Public form lives at `/f/the-old-barn-demo`.

---

## Suggested UAT test script

Run as a venue owner, in order. "Testable" assumes the P0 enablement steps above are done; flags note what is currently blocked or will mislead a tester until P0/P1 fixes land.

1. **Land on the home page and click "Get started."**
   *Check:* you reach the signup page.
   *Status:* **BLOCKED (P0 #5)** — the button is dead today. Workaround: navigate to `/signup` directly. Fix is trivial.

2. **Sign up a brand-new venue owner** (email + confirmation link → `/onboarding`).
   *Check:* confirmation email arrives, the link routes you to onboarding (not dashboard).
   *Status:* Testable, but **no automated coverage** — verify Supabase email templates + redirect allowlist are configured. The seeded `demo@` account is pre-confirmed, so this only matters for a genuinely new sign-up.

3. **Complete onboarding:** venue details, logo upload, spaces, opening hours.
   *Check:* each step saves; the logo appears.
   *Status:* Testable. *Watch:* a bad/oversized logo fails silently (P1) and step-3 hours reset if you go Back then forward (P2).

4. **Log in and explore the app shell** (sidebar, dashboard, mobile nav).
   *Check:* navigation works; protected routes require auth.
   *Status:* Testable. *Watch:* Appointments/Reports are stubs (P2); dashboard shows no live numbers (P2).

5. **Configure the public enquiry form & copy the embed snippet** (`/settings/forms`).
   *Check:* the shareable URL contains your slug; the embed snippet references `/embed`.
   *Status:* Testable. *Watch:* verify `NEXT_PUBLIC_APP_URL` is the UAT host, not production (P2).

6. **Upload a brochure PDF, then replace it** (`/settings`).
   *Check:* the active brochure updates; the page shows the new file.
   *Status:* Testable. *Watch:* replace is non-transactional (P1) — if it errors mid-way the venue can end with no active brochure. Re-check the page after any error toast.

7. **Open the public form (`/f/the-old-barn-demo`) and submit a test enquiry** — try a normal submission, then deliberately type `12.5` in guest count.
   *Check:* normal submit succeeds; the decimal case shows a friendly field error, not a raw Zod string.
   *Status:* Partially testable — the decimal case **fails today** with a developer-ese error blocking the whole submit (P1).

8. **Confirm the brochure email arrives** at the address you entered, and click the download link.
   *Check:* an email lands; the brochure opens.
   *Status:* **BLOCKED until Resend is configured (P0 #6).** Even then, the success screen promises delivery unconditionally — confirm an email actually arrives rather than trusting the on-screen message. The seeded brochure is a stub PDF (P2), so the download itself looks broken even when delivery works.

9. **Find the new enquiry in the pipeline and work it across stages** (drag, then use the card menu).
   *Check:* the card appears in "Inbound enquiry" and moves persist after reload.
   *Status:* Testable. *Watch:* the board doesn't auto-refresh — if you had it open before submitting, hard-reload to see the new card (P1).

10. **Open the contact, edit details, then delete it.**
    *Check:* edits save; delete removes the contact and its pipeline card; the detail page 404s afterward.
    *Status:* Testable. Delete cascades via DB FKs and shows a success toast (no automated test, but the flow is complete).

11. **Sign out, then try to reach `/dashboard` directly.**
    *Check:* sign-out returns you to `/login`; the direct hit redirects back to `/login`.
    *Status:* Testable, but **sign-out may not navigate** from the sidebar menu (P1) — if you stay on the page, refresh and confirm you're logged out.

12. **(Two-venue check) Create a second venue/owner, add a contact, then log in as the first owner.**
    *Check:* the first owner sees none of the second venue's data anywhere.
    *Status:* Testable manually; **no automated isolation test** — strongly recommended to run before real client data is involved. `scripts/rls-cross-tenant.mjs` automates this.
