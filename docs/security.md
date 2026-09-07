# Security model and release review

## Implemented controls

- RLS on every application table; no direct authenticated writes to job state, credits, payments, profiles, or administration.
- Security-definer mutations with an empty search path, authenticated actor checks, ownership checks, and explicit execute grants.
- Private geography/address storage and contact RPC gated by accepted/completed application, participant relationship, suspension, and blocks.
- Transactional publication and payment settlement; constraints prevent negative balances, duplicate applications, self-review, and duplicate reviews.
- Bounded radius and pagination, coordinate/pay validation, text limits, and rate limits on selected expensive operations.
- Private storage buckets with owner-folder policies, file size limits, and MIME restrictions. Verification documents are never public.
- Admin authorization checked server-side and inside database RPCs. Membership can only be provisioned by a privileged operator. Moderation is audited.
- Native sessions stored in SecureStore; web sessions stored in sessionStorage rather than persistent demo storage. The Next.js server uses HttpOnly cookies.
- Raw-body HMAC verification for payment webhooks. Checkout callback data never grants credits.
- Generic push messages avoid exposing job/contact details on lock screens.

## Policy summary

Users can read their own profile, worker preferences, credits, ledger, payments, devices, notifications, reports, and bookmarks. Posters can read their jobs and job locations. Application participants can read application history. Category and pricing catalogs are authenticated-readable. Admin tables/events have no general client read policy; protected RPCs provide the required operations.

## Required release checks

1. Run hosted RLS tests with three distinct accounts, including direct REST attempts against private tables and protected RPCs.
2. Enable and test Supabase OTP provider rate limits, resend frequency, token lifetime, and abuse protection. The UI cooldown is not an abuse boundary.
3. Verify administrator MFA enrollment and challenge on the hosted project. The dashboard and privileged database RPCs require both admin membership and AAL2; test direct calls using a first-factor-only session to confirm denial.
4. Review account deletion retention, outstanding work, and payment accounting requirements. Current deletion cascades marketplace/payment records and is not approved for a paid production launch. Add a race-safe deletion state/transaction and any legally required minimal retention before enabling payments.
5. Review profile visibility, public text leakage, image moderation, and document-upload scanning. MIME restrictions alone do not validate file contents. Optional upload UI is not yet connected.
6. Test token refresh, logout/device-token cleanup, and notification preferences on real Android hardware.
7. Test simultaneous credit spends/acceptances in separate Postgres sessions; embedded tests cannot establish multi-process concurrency behavior.
8. Restrict tile keys by platform/domain. Keep geocoding, FCM, payment and service-role secrets on the server.

## Dependency audit

The initial Expo dependency tree reported an inherited UUID advisory. `xcode` uses only `uuid.v4()`, so a scoped override to UUID 11.1.1 removes the affected older dependency without downgrading Expo. Compatibility and Android prebuild were checked. Re-run `npm audit` when changing dependencies.

This document records implemented controls and known gaps, not an independent security certification.

