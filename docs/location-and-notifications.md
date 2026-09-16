> Current basemap: keyless OpenFreeMap. See [open map architecture](open-map-architecture.md). Historical credential instructions below are superseded; EXPO_PUBLIC_MAP_STYLE_URL is no longer consumed.

> Current EAS linkage and build status: [Task 3A release configuration](release-configuration.md). Earlier setup observations below are historical.

# Task 3 — Location and notifications

Status: PARTIAL. Repository functionality is implemented and automated checks are recorded below. Production map/geocoding/FCM configuration and physical Android verification remain required. Phone OTP is preserved and real SMS testing remains deferred; there is no production authentication bypass.

## Inspection and changes

Existing: compatible MapLibre React Native 11.3.9 and its Expo plugin, Expo Location, native/web map components, Supabase geography(Point,4326) in private job_locations, job_locations_gist index, a nearby_jobs RPC with 1/3/5 km radius and 20-row offset pages, exact-contact RPC/RLS, 24-hour expiry, basic posting/discovery, notification outbox, FCM dispatcher, and owner-scoped logout cleanup.

Task 3 adds a confirmed location picker with a draggable/tappable map pin, GPS/manual fallback and structured address fields; a provider/configuration interface; expanded Ola adapter and test-only MockLocationProvider; search/reverse cache; structured error handling and translations; advanced filters; shared expiry-safe map/list results; scroll-triggered pagination; worker alert targeting; delivery acknowledgements; and expanded tests. Existing auth and payment behavior is retained.

Files: apps/mobile/src/live/LocationPicker.tsx, LocationPin.tsx/.web.tsx, location-logic.ts and its tests, JobMap.tsx/.web.tsx, LiveApp.tsx, services.ts, locales/en.json/ta.json; packages/core/validation.ts; apps/mobile/app.config.js, eas.json and package.json; .env.example; tests/database.mjs, tests/localization.mjs; CI workflow; supabase/functions/location provider/endpoint/tests and notification-dispatch; migration 202609070002_location_notifications.sql.

## Map and geocoding setup

MapProviderConfig defaults to keyless OpenFreeMap. Optional self-hosted HTTPS styles require EXPO_PUBLIC_BASEMAP_STYLE_URL and EXPO_PUBLIC_BASEMAP_ATTRIBUTION. No basemap account or API key is needed. The renderer retains provider attribution controls. Style URLs are public application configuration, never a place for private credentials. MapLibre handles rendering; no UI component calls Ola directly.

LocationSearchProvider exposes search, resolve and reverse. OlaMapsProvider uses authenticated Edge requests to autocomplete, place details and reverse-geocode, normalizes locality/city/district/state/country/address, and bounds provider requests to 10 seconds. MockLocationProvider is only instantiated explicitly by tests; the hosted endpoint will not select it. GPS plus manual real coordinates/locality remains the development fallback without keys.

Provision Ola Places APIs in the provider dashboard, obtain the server API key, and set OLA_MAPS_API_KEY and LOCATION_PROVIDER=ola as Supabase Edge secrets. Do not prefix them EXPO_PUBLIC. The server authenticates requests and applies 60 location requests/hour/user. Autocomplete waits 400 ms and at least 3 characters. UI search results and server search/details/reverse results have bounded 5-minute memory caches; server keys are user-scoped. Coordinates/addresses are not logged or persisted to general-purpose client storage. The selected location remains in app memory until logout/restart.

References: [Ola place details](https://maps.olakrutrim.com/docs/places-apis/place-details), [Ola authentication](https://maps.olakrutrim.com/docs/auth), [Expo Location SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/location/).

## Location flow and privacy

Location permission is requested only from the location action after its explanation. Denial keeps manual selection available. Permanent denial offers Open Settings. Disabled GPS and a 15-second acquisition timeout have actionable messages. Reverse-search failure retains the selected point and job form. A user can type valid real coordinates, drag the pin, or tap the map, then confirm locality/address. Do not fabricate a coordinate when GPS/provider configuration is unavailable.

Posting consumes confirmed latitude/longitude and structured region fields. Coordinate schemas reject missing, blank, non-finite and out-of-range values. The database validates coordinates and now rejects publication without a private point. Expiry remains exactly published_at + 24 hours.

Exact work point/address remain in job_locations, with owner-only direct reads. Unaccepted and unrelated workers cannot obtain them. The existing private_contact RPC checks accepted/completed application, participant identity, blocks and suspension before returning exact data. The public nearby response is an explicit field whitelist, with coordinates rounded to 0.01 degrees and distance rounded up to 500 m. This applies to both residential and business jobs. User-entered public titles/descriptions cannot be automatically guaranteed free of address information; the posting guidance explicitly warns against including it.

Distance is straight-line PostGIS geography distance, not road distance. Nearest ordering uses numeric server distance; scoring uses coarsened distance to avoid exposing a finer distance through match percentage. Arbitrary radius probes can still infer geographic proximity; rate limiting reduces probing but approximate markers are not a formal anonymity guarantee.

## Nearby RPC and matching

nearby_jobs uses indexed ST_DWithin over private geography, active status and expires_at > now(), plus block/suspension exclusions. Default radius 3000 m; options 1000/3000/5000. Combined filters cover kind, category, employment type, language, query, minimum/maximum pay and pay unit. Sorting: recommended, nearest, highest pay, newest, with distance/id tie-breakers. Pages contain at most 20 rows, offsets capped at 10000. Client deduplicates IDs. Concurrent inserts/changes can shift offset pages; refresh restarts the result set.

private.match_score provides the rule weights: distance 35, skill/category 25, availability 15, language 10, comparable-unit pay 10, employer rating 5; unknown components earn no points. Maximum 100. No AI service or routing/distance-matrix service is used.

Map and list share activeNearby filtering. Expired cards/markers disappear on the UI's one-second clock even before cleanup; SQL excludes them on every request. Queries refresh every 30 seconds. Map/list toggle, refresh, filter controls, loading/empty/errors and marker details are implemented. The list loads another server page near the bottom and retains a Load More control. Tests validate exact expiry boundary logic; real-device timing and native rendering remain pending.

## Notifications and device lifecycle

Workers explicitly choose “Use this location for nearby job alerts”; the app requests Android notification permission/registers the FCM token, then saves the chosen point to private.worker_locations. The point is never publicly readable. Nearby targeting uses the worker preference radius (default 3 km), availability, category/employment/language/pay compatibility, blocks, suspension and notification preferences. Location eligibility expires after 30 days unless refreshed. Stop-alerts removes this private point; already queued nearby events are suppressed on dispatch. Changing category or disabling notifications is rechecked before dispatch.

Publication triggers backend targeting and inserts nearby_job into the existing idempotent notification/outbox system. Repost creates a new job and new notification identity. Application received/accepted/rejected, filled, expired, reposted and completed events remain represented; exact addresses and coordinates are absent from payloads. The push body is intentionally generic; details are retrieved inside authenticated NearHire.

private.notification_deliveries stores a hash of each successfully delivered token per event. Partial retries skip acknowledged tokens. FCM is at-least-once: a crash after FCM accepted a message but before acknowledgement can still redeliver. Android notification tags reuse the event ID to replace repeated displayed updates. The dispatcher bounds concurrent event/token batches to five each, validates failures, uses retries/backoff and keeps the existing eight-attempt limit. UNREGISTERED tokens are removed; device records older than 90 days are cleaned on dispatch. Token refresh/reinstall registers the new token; refresh registration is serialized with Task 2 logout cleanup. In-app notifications still exist when a device has no registered token.

New indexes: worker_locations_gist and notification_outbox_pending. Existing job_locations_gist and jobs_discovery are retained.

## Firebase, FCM and scheduler configuration

Create/use a Firebase project and Android app with package app.nearhire.mobile. Download its google-services.json, store outside committed source, and supply the path as GOOGLE_SERVICES_JSON (an EAS file environment variable for cloud builds). app.config.js applies android.googleServicesFile and preserves an existing Expo project ID. This Android client configuration is not the Firebase service-account private credential.

Enable Firebase Cloud Messaging HTTP v1. Create/use a service account with messaging permissions and put FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY only in Supabase Edge secrets. This project sends directly to FCM from an Edge Function, not via Expo's push relay; do not put the server private key in the mobile build. Provision OUTBOX_SECRET server-side. Add matching Vault secrets nearhire_outbox_secret and nearhire_functions_url=https://mxsltkyebhboaglbspse.supabase.co/functions/v1. Then run supabase/schedule-notifications.sql once to install the minute dispatcher schedule. Review outbox retries and FCM delivery logs with tokens redacted. Generate a cryptographic scheduler credential only when absent; obtain provider credentials from their account owner.

Reference: [Expo FCM setup](https://docs.expo.dev/push-notifications/fcm-credentials/).

## Android development build

The development EAS profile explicitly produces an installable APK with developmentClient=true. MapLibre and remote FCM require this native build; Expo Go is not a valid test. Use the existing EAS project if linked; do not create a duplicate.

```powershell
cd "C:\PROJECTS\NEAR HIRE\apps\mobile"
npx eas-cli login
# Supply the existing project ID through EAS_PROJECT_ID; do not create another project.
npx eas-cli build --platform android --profile development
# Install APK on Android; connect phone and computer to the same Wi-Fi:
npx expo start --dev-client --lan
```

Set the existing public Supabase URL/key and production style URL in local/EAS environments before testing. Configure the Firebase file in the build environment. Real phone auth must be configured/tested before authenticated two-device workflows; no login bypass has been added.

## Physical-device checklist (all pending)

- English/Tamil: check readable labels, wrapping at large font scale, map controls and 48px targets.
- GPS grant, deny, permanently deny, GPS off, slow GPS, airplane mode, retry, and manual coordinates.
- Ola autocomplete/details/reverse with real credentials, offline failure, cache behavior and preserved form fields.
- Native tiles/attribution, pan/zoom, pin drag/tap and exact/private confirmation.
- Employer posts residential and business work at a confirmed real point. Verify persisted private point and 24-hour expiry.
- Worker tests 1/3/5 km radii, combined filters, nearest/newest/pay ranking, multiple pages, refresh and map/list toggle.
- Before acceptance, inspect RPC payload and map marker: no exact address/coordinates. After acceptance, authorized contact/location works; unrelated user is denied.
- Confirm cards and markers disappear at expiry; test cancelled/suspended exclusions after refresh.
- Enable worker alerts and permission; publish a matching nearby job from another device; verify FCM delivery and in-app event. Repeat with out-of-radius, blocked, opted-out and mismatched preferences.
- Test token rotation/reinstall, logout owner cleanup, stale token deletion, provider failures and partial-delivery retry behavior.

## Troubleshooting and validation limits

Blank map: check HTTPS style URL, provider entitlement, tiles/glyphs/sprites and attribution. No demo tile substitution occurs. Missing coordinates: use GPS/manual fields and confirm locality. No jobs: check origin/radius, active/unexpired status, category/pay unit/language filters, RLS and blocks. No nearby alert: confirm explicit alert location within 30 days, worker preferences, token/permission, Firebase package match, Edge secrets, Vault schedule and outbox state. Invalid FCM token is deleted automatically; sign in and enable notifications again after reinstall.

Automated tests use real PostGIS through PGlite and explicit fixture Auth/Storage/cron shims, plus mobile helpers and injected Ola HTTP fixtures. They do not prove handset GPS, MapLibre rendering, Ola production responses, or live FCM delivery.

## Verified Task 3 outcome — 7 September 2026

IMPLEMENTED: confirmed GPS/search/manual pin workflow, private location handling, expanded PostGIS discovery/ranking/filtering, map/list pagination and expiry safety, explicit worker nearby-alert opt-in, notification targeting and acknowledgement infrastructure.

Migration 202609070002_location_notifications.sql was applied to mxsltkyebhboaglbspse through the normal migration workflow. All six local/hosted migration versions match. Hosted public/private SQL lint reports no errors. The three expected geospatial/outbox indexes were verified on the hosted database. Updated location and notification-dispatch Edge Functions were deployed. An unauthenticated location request returns HTTP 401.

Validation passed: mobile/admin TypeScript; ESLint; 15 mobile tests (8 auth, 4 location helpers, 3 legacy marketplace); 2 localization tests; 24 PostgreSQL/PostGIS integration scenarios; all five Edge Function type checks; Ola fixture adapter and webhook tests (2); Android/Hermes export; web export; git diff whitespace check. Export is not a signed Android binary or native rendering test.

## Firebase configuration — 8 September 2026

Firebase project and Android package validation PASS: near-hire-8bbef and app.nearhire.mobile. Both supplied files were moved from Downloads into an access-restricted external directory:

- C:\PROJECTS\NEARHIRE-SECRETS\google-services.json — Android client configuration only.
- C:\PROJECTS\NEARHIRE-SECRETS\firebase-service-account.json — server credential, never an EAS/mobile input.

Supabase mxsltkyebhboaglbspse now has FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY. Temporary transfer files were removed. Existing OUTBOX_SECRET and both Vault entries were reused, with no credential regeneration or duplicate schedule.

Service-account OAuth returned HTTP 200. FCM HTTP v1 validate_only returned HTTP 200 without sending a notification. The deployed notification-dispatch function authenticated through the existing Vault credential and returned HTTP 200 with zero events processed. Exactly one nearhire-notifications cron job is now ACTIVE. These checks confirm server configuration, not physical-device delivery.

The existing dispatcher uses RS256 service-account assertions, Google OAuth token exchange and FCM HTTP v1. No Firebase Admin SDK or replacement notification implementation was added.

Expo public configuration resolves the external GOOGLE_SERVICES_JSON path, preserves package app.nearhire.mobile and the MapLibre plugin, and contains no service-account fields/private key. The development EAS profile selects the development environment. No machine-specific credential path is hardcoded in application source.

### Remaining EAS setup

EAS CLI reports not logged in; no Expo project ID resolves in the current configuration. Authenticate locally and supply the EXISTING project ID using EAS_PROJECT_ID. Do not create another project. Then configure the Android file using the installed CLI's supported syntax:

```powershell
cd "C:\PROJECTS\NEAR HIRE\apps\mobile"
npx eas-cli login
# Set EAS_PROJECT_ID to the existing project's ID through your local environment.
npx eas-cli env:set development --name GOOGLE_SERVICES_JSON --type file --visibility secret --value "C:\PROJECTS\NEARHIRE-SECRETS\google-services.json" --scope project --non-interactive
```

Configure EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY with the keyless default basemap in the same development environment. Server credentials must never be supplied to EAS or EXPO_PUBLIC variables. See [EAS environment variables](https://docs.expo.dev/eas/environment-variables/).

OLA_MAPS_API_KEY and a dedicated public map style remain unavailable. The earlier screenshot contains server-side API/OAuth credentials; rotate those exposed credentials and supply the replacement securely. Do not use the private Places key for mobile tiles.

### Android device procedure

After EAS authentication, existing-project linkage and public environment configuration:

```powershell
cd "C:\PROJECTS\NEAR HIRE\apps\mobile"
npx eas-cli build --platform android --profile development
# Install the resulting APK and use the same Wi-Fi as the computer.
$env:GOOGLE_SERVICES_JSON = "C:\PROJECTS\NEARHIRE-SECRETS\google-services.json"
npx expo start --dev-client --lan
```

Configure real SMS authentication first. On the physical Android device, sign in, grant notifications and location permissions, and enable nearby alerts. Use a second employer device to publish a matching nearby job; verify one notification, authenticated navigation, and private-location protection. Repeat with opted-out/out-of-radius users, foreground/background, token refresh and logout/login. Follow the full checklist above. No native GPS, MapLibre rendering, Ola production search or FCM handset delivery has been claimed as passed.

Validation: mobile/admin TypeScript, ESLint, 15 mobile tests, 2 localization tests, 24 database/PostGIS scenarios, all five Edge Function checks, 2 Edge tests and Expo configuration checks passed. Android/Hermes export is a JavaScript build check, not an APK. APK build remains blocked by EAS authentication/project identity and incomplete public map configuration.
