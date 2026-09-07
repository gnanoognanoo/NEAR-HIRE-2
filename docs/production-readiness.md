# NearHire production readiness — 7 September 2026

## Verified deployment

The full-stack repository is connected to Supabase project mxsltkyebhboaglbspse in Mumbai. All four tracked migrations and five Edge Functions are deployed. All 23 application tables have row-level security; 23 categories and two active cron jobs are installed. Location and deletion reject unauthenticated requests with HTTP 401. Payment ordering returns PAYMENTS_DISABLED. Public client configuration is saved in ignored mobile/admin files. Phone authentication is disabled until an SMS provider is configured.

## Validation

Mobile/admin TypeScript, ESLint, three legacy marketplace tests, two localization tests, and 13 PostgreSQL/PostGIS integration scenarios passed. Admin production build passed with the live public configuration and dynamic MFA. Earlier mobile web and Android JavaScript/Hermes exports, Android prebuild, Edge type checks, and webhook signature tests passed. No signed Android binary has been built.

The database tests use PGlite with real PostGIS and shims for Supabase services. Hosted multi-session and real-device testing remain necessary. Hosted SQL lint passed with no errors for NearHire-owned public/private functions. The broader check reported issues in bundled PostGIS helpers, which remain outside that clean application-schema result.

## Release blockers

1. SMS provider setup and real OTP delivery/rate-limit testing. No hosted test OTPs were enabled.
2. Ola Maps/licensed tiles, Firebase Android/FCM, and Razorpay test credentials and webhook setup. Payments stay disabled.
3. Account deletion needs race-safe handling and an approved payment/accounting retention approach before paid use.
4. Hosted multi-account and physical Android end-to-end testing of posting, discovery, acceptance, private contact, completion, reviews, reports, expiry, payments, and push.
5. Outstanding product surfaces include uploads, draft editing UI, unblock controls, advanced preferences/discovery, movable map pins, admin pricing UI, and richer analytics.
6. Real-device navigation, token refresh/logout/device token cleanup, accessibility, and Tamil review.
7. EAS/signing/Firebase configuration, development APK and production AAB, final artwork, and native map/checkout tests. A complete local Android toolchain is not installed.
8. Admin account/MFA provisioning, admin hosting, privacy/account-deletion pages, and store release materials.

## Source and release status

Source is in C:\PROJECTS\NEAR HIRE. The original preview is preserved in apps/mobile/PreviewApp.tsx; live mode is the default. The full-stack Git repository is rooted at C:\PROJECTS\NEAR HIRE on main. The original mobile Git history is preserved outside this repository at C:\PROJECTS\NEARHIRE-GIT-BACKUP\mobile.git. The official GitHub destination is https://github.com/gnanoognanoo/NEAR-HIRE-2.git.

This is a full-stack development milestone, not a production-ready release. See deployment.md and security.md for setup and remaining limits.


