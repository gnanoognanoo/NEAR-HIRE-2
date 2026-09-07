# Current-state assessment — 2026-09-06

## Inspected architecture

`apps/mobile` contains Expo SDK 57, React Native 0.86, React 19, TypeScript, AsyncStorage, Feather icons, and a single-screen-state navigation implementation. There is a Git repository inside mobile. No admin app, database, migrations, API client, live authentication, or map implementation exists. There are no configured service credentials in the inspected application configuration.

## Reusable work

White/plum palette, cards, responsive layouts, onboarding language choice, forms, loading/empty patterns, and the demo's expiry/application/credit tests are useful. Preserve the preview as an explicit development mode. Production must never silently load its sample jobs.

## Verification before changes

TypeScript and all three existing domain tests pass. The previous browser run verified onboarding, local save/apply/post flows; a new live build requires fresh verification. The existing web preview is served on port 8089.

## Debt and security blockers

All data and credits are client-controlled. Authentication is absent. Distances are fabricated. Most strings are inline and Tamil coverage is incomplete. App.tsx combines navigation, storage, forms, and presentation. There is no server authority, RLS, payment verification, moderation, notification delivery, or account deletion. A web export passing is not Android release validation.

## Upgrade path

Keep Expo and the visual system. Add a separately deployable Next.js admin, shared validation/types, Supabase/PostGIS migrations, private location tables, authenticated RPC mutations, a credit ledger, event outbox, signed Razorpay webhooks, and provider adapters. Replace the production entry point with real services and keep the old app behind a development-only flag. All privileged operations must reject unauthorized callers. Deliver setup and remaining-readiness evidence rather than claiming external integrations ran without credentials.

## Environment constraints

Node/npm and Git are available. Docker, PostgreSQL/psql, Supabase CLI, and Deno were not on PATH at audit time. Cloud projects, SMS, maps, Firebase, Razorpay, EAS signing, and Play Console access have not been supplied. Database validation and native builds must either be provisioned and executed or explicitly reported as unverified.
