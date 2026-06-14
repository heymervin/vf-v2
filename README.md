# VenueFlow

Wedding venue CRM — pipeline, enquiry capture, and brochure delivery in one place.

Built with Next.js 16 (App Router), React 19, Supabase, Inngest, and Resend.

## Status

M0–M3 complete: auth, onboarding, contacts + pipeline, public enquiry form, brochure upload + email delivery. M4+ (sequences, appointments, reporting) in progress.

## Getting started

See **[SETUP.md](./SETUP.md)** for the full environment setup checklist — Supabase provision, migrations, env vars, Inngest, Resend, seed, and deploy.

**Demo login (after seeding):** `demo@venueflow.io` / `WeddingDemo123!`

## Key docs

- [`SETUP.md`](./SETUP.md) — stand up a UAT or local environment
- [`docs/UAT-READINESS.md`](./docs/UAT-READINESS.md) — current defect list + UAT test script
- [`PRODUCT.md`](./PRODUCT.md) — product principles and configurability decisions
- [`DESIGN.md`](./DESIGN.md) — visual design system
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — technical architecture

## Development

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase + Resend + Inngest vars
pnpm dev
```

Run E2E tests (requires `.env.local` with service-role key):

```bash
pnpm test
```
