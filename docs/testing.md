# Test and validation guide

```powershell
cd "C:\PROJECTS\NEAR HIRE"
npm run lint
npm run check
npm test
npm run test:db
npm run build
npx deno check --config supabase/functions/deno.json supabase/functions/location/index.ts supabase/functions/payment-order/index.ts supabase/functions/razorpay-webhook/index.ts supabase/functions/notification-dispatch/index.ts supabase/functions/delete-account/index.ts
```

## Database coverage

The embedded PostgreSQL/PostGIS suite applies the migrations and tests ownership, RLS, private location protection, radius filtering, idempotent publication, duplicate/self applications, unauthorized acceptance, contact unlocking, completion, reviews, expiry, reposting, blocks, payment amount validation, repeated webhook settlement, and admin access.

Supabase Auth/storage platform definitions and cron registration are test shims. PostGIS and business functions are real. Hosted Auth, SMS, PostgREST, storage API integration, scheduler delivery, network concurrency, and device push remain external integration tests.

## Native checks

```powershell
cd apps/mobile
npx expo config --type public
npx expo prebuild --platform android --no-install
npx expo export --platform android
```

Prebuild and JavaScript export do not compile or sign an Android APK/AAB. A real Gradle/EAS build and device run remain mandatory.

## Manual staging scenarios

1. Worker: English and Tamil onboarding, valid/invalid/expired OTP, resend, profile, work preferences, GPS denial/manual search, radius filters, apply/withdraw.
2. Poster: draft, publish, repeated publish, credit exhaustion, applicant selection, private contact unlock, fill/start, both completion confirmations, review.
3. Expiry: SQL timestamp advance in a disposable test environment, discovery exclusion before cron, blocked application, expiry notification, new linked repost.
4. Safety: third-party REST reads, suspended accounts, user block in either direction, report visibility, non-admin moderation requests.
5. Payments: Razorpay test checkout, valid/invalid raw-body signatures, amount/currency mismatch, repeated webhook, ambiguous create-order timeout.
6. Devices: notification permission, token rotation, logout/relogin, delayed network, font scaling, Tamil layout, Android back navigation, keyboard avoidance, screen-reader flow.

Do not run destructive fixture creation against production. Real-world E2E has not passed until these scenarios run against the staging Supabase project and an installed Android build.
