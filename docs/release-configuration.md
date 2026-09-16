> Current basemap: keyless OpenFreeMap. See [open map architecture](open-map-architecture.md). Historical credential instructions below are superseded; EXPO_PUBLIC_MAP_STYLE_URL is no longer consumed.

# NearHire Task 3A release configuration

Verified 9 September 2026. This status supersedes earlier EAS setup notes in location-and-notifications.md.

## EAS project

- Owner: gnanoos-team
- Project: nearhire
- Project ID: 9788df17-3b02-4cd3-b594-8daff14abcad
- Android package: app.nearhire.mobile
- Project URL: https://expo.dev/accounts/gnanoos-team/projects/nearhire
- Exactly one first project was created with explicit owner authorization. Do not initialize another project.
- apps/mobile/app.json stores the public owner/project ID; app.config.js preserves it.
- Development profile selects the development environment, development client and Android APK.

## Configured development environment

EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY and EXPO_PUBLIC_DEMO_MODE=false are configured in EAS. The Supabase client key is an anon key, not a service-role key.

GOOGLE_SERVICES_JSON is a secret File environment variable sourced from C:\PROJECTS\NEARHIRE-SECRETS\google-services.json. The Firebase project/package match passed. The service-account JSON remains outside Git and is never an EAS mobile input.

## Remaining APK prerequisite

PUBLIC MAP STYLE CREDENTIAL REQUIRED

OpenFreeMap is the keyless default. Validate style, tile, glyph, sprite and attribution availability. No EAS basemap key or legacy EXPO_PUBLIC_MAP_STYLE_URL is required. Never substitute a private Ola Places key.

## Ola development provider

The owner authorized temporary server-side use of the previously exposed Ola credential. Two local screenshot OCR attempts returned HTTP 401 from Ola; no unverified extracted value was uploaded. LOCATION_PROVIDER=ola is present, but OLA_MAPS_API_KEY remains unconfigured. Supply the exact credential through an external secure file to avoid screenshot transcription ambiguity. Production provider search remains unverified. This does not replace the separate public map-style requirement.

## Backend and security

All six migrations match the linked Supabase project mxsltkyebhboaglbspse. Firebase Edge secrets and OUTBOX_SECRET are present. Exactly one notification schedule is active; its latest checked execution succeeded and dispatcher response was HTTP 200. FCM OAuth and validate-only checks passed during Firebase setup. No real handset delivery has been claimed.

The location function rejects unauthenticated requests with HTTP 401. Real phone OTP remains intentionally deferred; do not add a bypass. Private locations, RLS and outbox authorization remain intact.

## Verification and source

The Task 3 implementation was committed and pushed as f85770e0562a03a5ca45211b4f6d98de5634f293, following Firebase configuration commit 663cd3e. Review fixed whitespace-only coordinate validation and placed automatic pagination on the actual jobs scroll view.

TypeScript, ESLint, 15 mobile tests, 2 localization tests, 24 database/PostGIS scenarios, five Edge Function type checks, two Edge tests, web/admin builds and Android/Hermes export passed during Task 3A. Expo config validates owner, project ID, Android package, external Firebase resolution and absence of server fields. Public map configuration cannot pass until its URL is supplied.

No EAS cloud build has been started: the requested map prerequisite is missing. There is no build ID, installable APK or artifact URL yet. A JavaScript/Hermes export is not an APK.

## Build and physical-device testing

After the public style is configured:

```powershell
cd "C:\PROJECTS\NEAR HIRE\apps\mobile"
npx eas-cli build --platform android --profile development
# Install the successful APK, then use the same Wi-Fi on phone and computer.
$env:GOOGLE_SERVICES_JSON = "C:\PROJECTS\NEARHIRE-SECRETS\google-services.json"
npx expo start --dev-client --lan
```

Follow [Android device checklist](android-device-checklist.md). All physical-device checks are PENDING; authenticated tests wait for real SMS setup. GPS, native rendering, production Ola responses and FCM delivery must be demonstrated on actual devices.

## First-device build attempt — 9 September 2026

Owner subsequently authorized the previously supplied Ola key as a TEMPORARY DEVELOPMENT CREDENTIAL — ROTATE BEFORE PRODUCTION, including client map use for this development test only.

Prepared C:\PROJECTS\NEARHIRE-SECRETS\map-client.env outside Git, containing EXPO_PUBLIC_MAP_STYLE_URL for the requested Ola default-light-standard style. The screenshot-derived credential returned HTTP 401 from the style endpoint. No credential-bearing URL was printed. EAS style configuration was left unchanged; a known rejected style was not bundled into an APK.

The exact key must be supplied in that external file to eliminate OCR ambiguity, and its Ola tile/style entitlement must be confirmed. Tile, glyph, sprite and attribution validation are blocked until the style request succeeds. This failed check does not establish production map licensing or physical rendering.

The latest pre-build checks passed: TypeScript, lint, 15 mobile tests, two localization tests, 24 database/PostGIS scenarios, five Edge type checks, two Edge tests and Android/Hermes export. EAS project/Firebase/public Supabase configuration remains valid. ADB is available but no device is connected. No APK build, installation, language/auth-screen device test, or Metro handset connection has passed.
