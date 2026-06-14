# VenueFlow — UAT Remediation Log

**Date:** 2026-06-14
**Goal:** clear every code-fixable blocker from `docs/UAT-READINESS.md` (verdict was NO-GO) and drive to a GO.
**Outcome:** all code blockers fixed and verified. `next build`, `tsc --noEmit`, and `eslint` all pass. The only remaining gates are the three infrastructure steps that require your cloud accounts (provision Supabase, set secrets, deploy + seed) — see `SETUP.md`.

## Verification (post-fix, run 2026-06-14)

| Check | Before | After |
|---|---|---|
| `pnpm typecheck` | PASS | **PASS** (exit 0) |
| `pnpm lint` | PASS (4 warn) | **PASS** (exit 0, 5 benign warnings, 0 errors) |
| `pnpm build` | **FAIL** (exit 1) | **PASS** (exit 0) |

Build logs: `docs/_uat/build.txt` (original failure) → `docs/_uat/build3.txt` (passing).

---

## P0 — UAT blockers (code) — ALL FIXED

1. **Production build failed** (`next build` prerendered `/signup` and built a Supabase client with no env → threw).
   *Fix:* moved `createClient()` out of render into the handlers in `src/app/(auth)/signup/page.tsx` and `login/page.tsx` (browser-only). Build no longer needs secrets to compile.

2. **Dead marketing CTAs** — `src/app/page.tsx` "Get started" / "See the pipeline" had no links.
   *Fix:* wired to `/signup` and `/login` via `<Button asChild><Link>`.

3. **"Your brochure is on its way" shown even when no email is sent** — `lead-form.tsx` hardcoded the promise.
   *Fix:* `submitLeadForm` now returns `brochureSent` (true only if the venue has an active brochure); `lead-form.tsx` gates the success copy — brochure present → "your brochure is on its way", otherwise → "we've received your enquiry and will be in touch." (`src/app/(public)/f/[venueSlug]/{actions.ts,lead-form.tsx}`)

*(P0 items 2–4 in the readiness report — no `.env.local`, no hosted instance, no seeded account — are infrastructure, not code. They are made turnkey + documented in `SETUP.md`; they require your accounts and cannot be done from the repo.)*

---

## P1 — fix soon — ALL FIXED

- **Brochure replace was non-transactional** (deactivate-then-insert could leave a venue with zero active brochures). *Fix:* new `SECURITY DEFINER` RPC `replace_active_brochure` (single transaction) in `supabase/migrations/20260614120000_brochure_replace_rpc.sql`; `settings/actions.ts` calls it, checks the error, and removes the just-uploaded storage object on failure. **Requires `supabase db push` to take effect.**
- **Sign-out may not navigate** — `app-sidebar.tsx` used a dropdown `onSelect` for the redirecting `signOut`. *Fix:* converted to the `<form action={signOut}>` pattern.
- **Guest-count rejected decimals/text** with a raw Zod error on an optional field. *Fix:* client numeric guard + the server now coerces/floors (`12.7 → 12`) and drops junk to `undefined` instead of failing (`lead-form.tsx`, `lib/zod-schemas/lead.ts`).
- **Login never showed `?error=` flags** (expired/used magic link dead-ended). *Fix:* `login/page.tsx` reads `useSearchParams()` and shows friendly messages (wrapped in `<Suspense>` per Next requirements).
- **Authenticated user on `/` was stranded** on the marketing page. *Fix:* `proxy.ts` redirects authenticated users away from `/` (anonymous users still see the landing).
- **Logo upload failures were silent; drag-drop bypassed the type/size filter.** *Fix:* client validation in the drop handler + a non-blocking toast on server failure (`onboarding/step1-venue.tsx`, `actions.ts`).
- **Contacts list silently capped at 500.** *Fix:* explicit "showing the 500 most recent" banner + softened copy (`contacts/page.tsx`).
- **Pipeline board never re-fetched** after first load. *Fix:* `moveOpportunity` now `revalidatePath('/pipeline')`; the board reconciles from fresh server data by signature, with a `settleTick` flush so updates that arrive mid-move aren't stranded (`pipeline-board.tsx`, `pipeline/actions.ts`).
- **Optimistic drag rollback used a shared snapshot.** *Fix:* per-move closure-local snapshot.

*(P1 "test gaps" — sign-up, sign-out, tenant-isolation e2e coverage — are documented in `SETUP.md`/UAT-READINESS as manual UAT must-checks; `scripts/rls-cross-tenant.mjs` automates the isolation check.)*

---

## P2 — polish — FIXED

- Past wedding dates rejected (`min={today}` on the picker + a `refine` in `lead.ts`).
- Branded `(public)/not-found.tsx` + `error.tsx` so a bad/stale venue slug (often inside an embed iframe) isn't a bare 404.
- Demo seed now writes a real (valid, multi-line) sample PDF instead of a 60-byte stub (`scripts/seed-demo.mjs`).
- `.env.example` corrected: `EMAIL_FROM_DOMAIN` → `EMAIL_FROM_ADDRESS` (matches the code), plus per-env notes for `NEXT_PUBLIC_APP_URL` and `INNGEST_DEV`.
- Appointments + Reports pages show clear "Coming soon" empty states (so testers don't log them as broken); dashboard copy softened.
- `SLUG_TAKEN` now distinguishes a true unique violation from a slug-format violation (`onboarding/actions.ts`).
- Member "venue still being set up" screen now has a **Refresh** button (`onboarding/member-waiting-screen.tsx`, wired into `onboarding/page.tsx`).
- `package.json`: added `test`/`test:e2e`/`seed` scripts and a `pretest` that creates the screenshots dir.

---

## Enablement (to make the infra steps turnkey)

- **`SETUP.md`** — step-by-step: provision Supabase + `db push`, create `.env.local`, configure Resend + Inngest, set `NEXT_PUBLIC_APP_URL`, build, deploy, seed, run the RLS check, hand testers the demo login.
- **`vercel.json`** — deploy config.
- **`README.md`** — replaced boilerplate with a real intro + pointer to `SETUP.md`.

---

## Regressions caught by adversarial review and fixed in the same pass

- **Rate limit failed *closed* on a null IP** — would have blocked every submission in any no-proxy env (local/UAT/e2e). Changed to only enforce when an IP is resolvable; abuse hardening (captcha) is the documented future step. (`f/[venueSlug]/actions.ts`)
- **e2e `lead-form` assertions** updated to the corrected no-brochure success copy (the fixture has no active brochure).
- **`member-waiting-screen.tsx` had an inline `"use server"` action inside a `"use client"` component** (invalid; only built because it was unused). Fixed to `action={signOut}` and properly wired in; removed the now-dead `signOut` import from `onboarding/page.tsx`.
- **Login build regression** from the new `useSearchParams()` — resolved with the `<Suspense>` boundary.

---

## Product decisions made (conservative, flagged for your review)

- **No-brochure success copy:** "Thank you — we've received your enquiry … we'll be in touch soon" (no email/brochure claim). This changes the wording approved in `docs/functional/10-public-enquiry-form.md` / the confirmation page — update those if you keep it.
- **Guest count:** silently floor/drop bad values rather than block an optional field (no inline error for server-dropped values).
- **Pipeline freshness:** `moveOpportunity` now revalidates `/pipeline` (a deliberate reversal of the prior "authoritative for the session" behavior) — other staff's boards refresh on navigation; the acting user keeps their optimistic state.
- **Contacts cap:** kept the 500-row cap with an honest banner; full pagination was left out of scope.

## Deliberately NOT changed (intentional, not gaps)

- **Embed framability** — `/f/[venueSlug]/embed` stays framable by design (transparent embed per PRODUCT.md); no `X-Frame-Options`/`frame-ancestors` lockdown.
- **Captcha / Turnstile** on the public form — future anti-abuse step (needs keys); noted in code.
- **Brochure storage cleanup on successful replace** — the previous PDF is still left in the bucket (low-severity orphan, pre-existing); documented as a future cleanup.

---

## What remains before a literal GO (yours to run — see `SETUP.md`)

1. Provision a Supabase project and `supabase db push` all migrations (incl. the new brochure RPC).
2. Create `.env.local` / platform env with real Supabase + Resend + Inngest values; set `NEXT_PUBLIC_APP_URL`.
3. Deploy (Vercel) and run `node scripts/seed-demo.mjs`; optionally `node scripts/rls-cross-tenant.mjs`.

Once those are done, hand testers the URL + `demo@venueflow.io` / `WeddingDemo123!`. **All code defects from the readiness audit are cleared and the build is green.**
