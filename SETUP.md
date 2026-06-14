# VenueFlow — UAT Environment Setup

A concrete checklist to go from this repo to a tester-ready instance.

## Prerequisites

- Node 20+, pnpm 9+
- Supabase account (or local `supabase start`)
- Resend account with a verified sending domain
- Inngest account (for cloud deploys) or the Inngest CLI (local dev)
- Vercel account (recommended for hosted UAT)

---

## Steps

### 1. Provision Supabase

Use an existing hosted project or create a new one, then link and push migrations:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

All 5 migrations (M0–M3) will apply. The `brochures` storage bucket is created by migration `20260611160000_m3_lead_capture.sql` — no manual bucket step needed.

### 2. Create `.env.local`

Copy the example file and populate every value:

```bash
cp .env.example .env.local
```

Required vars:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API |
| `RESEND_API_KEY` | Resend dashboard → API Keys |
| `EMAIL_FROM_ADDRESS` | A verified sender address on your Resend domain (e.g. `hello@mail.venueflow.io`) |
| `NEXT_PUBLIC_APP_URL` | The URL this deploy will be reachable at (e.g. `https://venueflow-uat.vercel.app`) |

### 3. Configure Inngest

**Local dev:** run the Inngest Dev Server alongside Next.js:

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Also set `INNGEST_DEV=1` in `.env.local` so the Next.js process talks to the local server. Without it, background jobs (brochure email dispatch) never fire.

**Hosted UAT / Vercel deploy:** set `INNGEST_SIGNING_KEY` and `INNGEST_EVENT_KEY` as platform env vars (do not set `INNGEST_DEV`). Register the deployment URL in the Inngest dashboard.

### 4. Build and deploy

Vercel is the path of least resistance:

1. Import the repo in the Vercel dashboard.
2. Copy all `.env.local` values as Vercel environment variables.
3. Set `NEXT_PUBLIC_APP_URL` to the preview URL Vercel assigns.
4. Deploy the branch.

Or build locally:

```bash
pnpm build
pnpm start
```

### 5. Seed the demo data

After the deploy is up and env vars are set:

```bash
pnpm seed
```

This creates:
- Demo owner: `demo@venueflow.io` / `WeddingDemo123!`
- Venue: `The Old Barn` (slug `the-old-barn-demo`)
- 14 sample contacts spread across pipeline stages
- An active brochure PDF + email settings

Public enquiry form is at `/f/the-old-barn-demo`.

### 6. Check RLS (recommended before a second venue)

```bash
node scripts/rls-cross-tenant.mjs
```

Confirms tenant data separation before real client data is involved.

### 7. Hand testers the URL + demo login

```
URL:      https://<your-uat-host>/
Login:    demo@venueflow.io
Password: WeddingDemo123!
```

See `docs/UAT-READINESS.md` for the full UAT test script.
