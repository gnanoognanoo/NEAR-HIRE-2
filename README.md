# NearHire

Android-first local work marketplace with a white-first interface and restrained purple accents. The repository contains a React Native/Expo mobile client, a Next.js admin application, and Supabase database migrations and Edge Functions.

## Project layout

- `apps/mobile`: Expo SDK 57, TypeScript, Supabase Auth, MapLibre and native checkout.
- `apps/admin`: Next.js administration with membership checks and required MFA.
- `supabase`: PostGIS, RLS, transactional marketplace RPCs, expiry cron, private Storage, and five Edge Functions.
- `packages/core`: shared input validation.
- `tests`: database integration and localization checks.
- `docs`: requirements, architecture, API, security, testing, and deployment instructions.

## Development

Install Node 22 or newer, then run from the repository root:

```powershell
npm ci
npm --prefix apps/mobile ci
npm --prefix apps/admin ci
```

Configure the public environment values following `docs/deployment.md`. The mobile app uses the real backend by default. The previous local demo is preserved in `apps/mobile/PreviewApp.tsx` and requires an explicit development-only demo flag.

```powershell
npm --prefix apps/mobile start
npm --prefix apps/admin run dev
```

MapLibre and Razorpay require a native development build for Android; Expo Go does not include those native modules.

## Validation

```powershell
npm run check
npm run lint
npm test
npm run test:db
npm run build
```

The database integration suite runs PostgreSQL/PostGIS business SQL through PGlite with local shims for Supabase services. Hosted RLS tests, provider integration tests, and real-device testing are separate release requirements.

## Release status

This is a full-stack implementation in development, not a deployment-ready production release. The NearHire Supabase project is live in Mumbai with all four migrations and five Edge Functions deployed; hosted RLS coverage and unauthenticated endpoint checks passed. End-to-end hosted testing remains pending. Real SMS delivery, maps credentials, Firebase, Razorpay, Android signing, and hosting require external setup. Payments must remain disabled until the security and accounting release checks pass.

See `docs/production-readiness.md` for the current gaps and `docs/deployment.md` for setup. Never commit secrets or put server credentials in public environment variables.

