# Address search: Ola server integration

## GPS/manual mode — 26 October 2026

**Startup/location selection no longer depends on Ola.** Hosted `LOCATION_PROVIDER=disabled` is now configured after deploying the supported disabled mode. The `location` function is ACTIVE at version 17. Ola's adapter remains available behind the existing interface; its rejected key was not uploaded or retried.

The authenticated `capabilities` action returns `search=false`, `reverseGeocoding=false`, `reason=disabled`. The mobile picker checks this once when opened and hides unavailable address inputs while keeping GPS, the actual map pin and manual coordinate entry available. A capability failure also leaves manual/GPS selection available. Users can explicitly check address-search availability again later. A rejected provider credential or provider outage pauses optional lookup for that picker instead of retrying on each pin move.

Disabled-provider search/details/geocode/reverse requests retain the existing JSON-error/503 contract (`LOCATION_PROVIDER_DISABLED`); they never call Ola, return mock places or create coordinates. Cached addresses are not served when lookup is disabled. Authentication, active-profile checks and the existing request budget apply to capability and legacy requests. Real hosted verification using an existing account passed: capabilities 200/disabled, search/geocode 503/disabled, invalid action 400, unauthenticated request 401. No accounts or jobs were created, and only the diagnostic's newly opened login session was signed out.

Selecting a GPS/manual point immediately enables the review sheet. Reverse geocoding, if enabled later, enriches it in the background and does not block confirmation, including on timeout/failure. Confirmation requires an actual validated point and a manually entered locality when no address is available; the street address stays optional. Unapplied/invalid manual coordinate edits cannot silently confirm an older point. User-entered locality/address is not overwritten by a late lookup. The initial India-wide map viewport is not a selected location and cannot be confirmed.

MapLibre/OpenFreeMap, native GPS permissions, draggable/tappable pins, PostGIS nearby discovery, private address storage, RLS, authentication and Razorpay are preserved. No native dependency/configuration changed and no APK was rebuilt. Current physical retest is pending because ADB detects no phone; earlier GPS/map tests remain recorded separately in [the Android report](android-test-report.md). Metro is ready on port 8081 for the existing development APK. Automated and hosted checks do not establish new physical-device success.

Validation for this mode: mobile/admin TypeScript and ESLint PASS; 141 mobile tests plus 8 localization/workflow tests PASS; 63 local PostGIS/database scenarios PASS; 19 Edge tests PASS (including disabled-mode zero-provider-call coverage); web export, Android/Hermes export and credential scans PASS. Metro Android compilation and an actual HMR watcher update passed on the host. The temporary watcher edit was restored. No current phone-side result is claimed.

To restore address lookup later, first validate an activated server key using the diagnostic below, configure it outside mobile/public environments, then set `LOCATION_PROVIDER=ola`. Reopen the picker or tap **Check address search**. No new binary is required for the provider setting. Another geocoder can implement `LocationSearchProvider` and be selected in `config.ts` without changing GPS/maps/PostGIS. Unknown or test-only selectors fail closed; the hosted API never selects fixtures.

## Supplied credential retry — 26 October 2026

The newly supplied credential was saved only to the external `C:\PROJECTS\NEARHIRE-SECRETS\ola-server.env` file. The real server adapter's first autocomplete request for `Anna Nagar Chennai` returned HTTP **401**, classified as `LOCATION_PROVIDER_AUTH`. Validation stopped immediately; no details/geocode/reverse requests were made with the rejected credential.

Hosted configuration was checked again: `LOCATION_PROVIDER=ola` is already correct, and `OLA_MAPS_API_KEY` remains absent. The rejected key was not uploaded. No function redeployment, APK rebuild or mobile public-environment change was made. No Android device or Metro server was available for this retry. The remaining blocker is a server API key accepted by Ola, including any activation/account/restriction correction required by Ola; the 401 alone does not identify which of those applies.

## Verified state — 23 October 2026

PARTIAL: repository integration and unavailable-provider fallback tested; live address search is blocked on an activated Ola server API key.

- Linked Supabase project: `mxsltkyebhboaglbspse`.
- Hosted `location` Edge Function: version 15, ACTIVE after this change; unauthenticated live requests return `401 AUTH_REQUIRED`.
- `LOCATION_PROVIDER` is set to `ola`, confirmed against its secret digest.
- Hosted `OLA_MAPS_API_KEY` is absent. This is the immediate reason authenticated address requests cannot reach Ola.
- The only supplied external Ola credential, read from the old external map configuration, returned HTTP **401 Unauthorized** in one direct autocomplete probe for `Anna Nagar Chennai`. Connectivity succeeded; Ola rejected authentication. The existing `api_key` parameter and endpoint match the current official specification. A 401 alone does not distinguish invalid/inactive credentials from an account restriction; it does not prove a tile entitlement problem. No further requests were made with that rejected key, and it was not uploaded to Supabase.
- The requested replacement file `C:\PROJECTS\NEARHIRE-SECRETS\ola-server.env` was not present at verification time.

Earlier history referred to missing map styles. Basemap rendering is now independent, keyless OpenFreeMap through native/web MapLibre. Do not add the Ola server key to any mobile/public environment variable.

## API contract and architecture

Authoritative references checked on 23 October:

- [Ola authentication](https://maps.olakrutrim.com/docs/auth)
- [Autocomplete](https://maps.olakrutrim.com/docs/places-apis/autocomplete-api)
- [Place details](https://maps.olakrutrim.com/docs/places-apis/place-details)
- [Geocoding](https://maps.olakrutrim.com/docs/geocoding/geocoding-api)
- [Reverse geocoding](https://maps.olakrutrim.com/docs/geocoding/reverse-geocoding-api)
- [Official OpenAPI document](https://maps.olakrutrim.com/openapi/ola-maps-apis-oas.yaml)

The signed-in app calls the existing `location` Edge Function. The server verifies the Supabase user and non-suspended profile, enforces the existing per-user location rate limit, and selects only `OlaMapsProvider`. The mock adapter is instantiated only by tests. Responses are cached in bounded, user-scoped memory for five minutes, never in a public/shared persistent cache.

| Edge action | Provider GET path under `https://api.olamaps.io/places/v1/` | Request | Documented response |
| --- | --- | --- | --- |
| `search` | `autocomplete` | `input` | `predictions[].place_id`, `description` |
| `resolve` | `details` | `place_id` | `result.geometry.location`, `address_components`, `formatted_address` |
| `geocode` | `geocode` | `address` | `geocodingResults[]` (not the reverse-geocode `results` field) |
| `reverse` | `reverse-geocode` | `latlng=latitude,longitude` | `results[]` |

Each server request uses the documented `api_key` query parameter and a generated `X-Request-Id`, a ten-second timeout, fixed Ola HTTPS origin, and no redirects. No arbitrary URL can be supplied by the client. Provider errors are reduced to allowlisted internal codes/statuses; logs contain only operation, code and HTTP status, never request URLs, keys, search text, place IDs, coordinates or addresses.

The adapter normalizes neighborhood/locality, city, district, state and country. Ola's documented geocode response can use `India` in `short_name`; it is converted to `IN`. Missing/null/out-of-range geometry is rejected rather than converted to zero. Unknown structured fields are left absent rather than invented. Reverse lookup updates the address but preserves the user's exact selected point rather than snapping to returned road/POI geometry.

## Mobile behavior

Autocomplete waits 400 ms and requires three characters. Full forward geocoding is available through **Search this address** or the keyboard search action. Results require explicit selection; NearHire does not silently choose the first match. Include city/state for ambiguous locality names. Resolved details and forward-geocoded results update the map pin and structured fields. A later manual pin move supersedes an in-flight suggestion resolution.

Dragging/tapping the pin requests reverse lookup. When provider lookup fails, GPS/manual coordinates remain selected, and users can confirm locality manually. English/Tamil errors offer retry and GPS/manual fallback. No reverse result is required to keep a valid point. No residential address or exact coordinate privacy policies, PostGIS RPCs or RLS rules were changed.

## Required external configuration

1. In the existing [Ola credentials console](https://cloud.olakrutrim.com/console/maps?section=credentials), obtain an active **server** API key with access to Places Autocomplete, Place Details, Forward Geocode and Reverse Geocode. The official authentication guide says credentials activate with a default plan shortly after creation. If a fresh activated key still returns 401/403, have Ola verify its account/API access and credential restrictions. Do not invent domain/IP whitelists or add a wildcard. Server-to-server restrictions must be compatible with Supabase Edge Functions, without fabricating a browser Origin/Referer.
2. Save the key outside Git as `OLA_MAPS_API_KEY` in `C:\PROJECTS\NEARHIRE-SECRETS\ola-server.env`. Do not reuse the previously exposed/rejected development credential for production.
3. Validate the **replacement** through the real adapter; this makes real provider requests for three public test localities and stops on the first rejection:

```powershell
cd 'C:\PROJECTS\NEAR HIRE'
npx deno run --env-file='C:\PROJECTS\NEARHIRE-SECRETS\ola-server.env' --allow-env=OLA_MAPS_API_KEY --allow-net=api.olamaps.io scripts/check-ola.ts
```

4. Only after it passes, set the Edge key from that external file and retain the provider selector:

```powershell
npx supabase secrets set --project-ref mxsltkyebhboaglbspse --env-file 'C:\PROJECTS\NEARHIRE-SECRETS\ola-server.env'
npx supabase secrets set --project-ref mxsltkyebhboaglbspse LOCATION_PROVIDER=ola
```

The file must contain only the intended Ola server variable. Do not upload mobile environment files or unrelated credentials. Supabase secrets are read at runtime; no Android rebuild is required for key configuration. Only the `location` function was deployed for this task. Subsequent server code changes can deploy with `npx supabase functions deploy location --project-ref mxsltkyebhboaglbspse --use-api`.

## Validation and phone acceptance

Automated fixtures test the documented contracts, but do not prove provider availability or address accuracy. `scripts/check-ola.ts` prints only public query summaries and safe failure codes, not raw responses or credentials.

Use the existing development APK and running Metro on port 8081. Sign in normally; no OTP bypass or test account creation is needed. Search `Anna Nagar Chennai`, `Ambattur Chennai`, and `Avadi Tamil Nadu`; confirm suggestions, choose a result, inspect pin/structured locality/city/state, then move the pin and confirm the reverse address updates without unexpected movement. Test no results, retry, network/provider outage and GPS/manual recovery. Keep real residential addresses out of shared screenshots/logs and do not publish a live job merely to test lookup.

Actual vivo V2204/Android 12 test in this task: updated search UI loaded via Fast Refresh; Anna Nagar autocomplete and explicit geocoding displayed the truthful provider-unavailable fallback without a crash. This is a **fallback pass**, not live search success. Live suggestions, details, geocoding accuracy and successful reverse-address updates remain **BLOCKED / NOT VERIFIED** until the key is activated and configured.

The phone disconnected before an additional post-search GPS/manual retest could run. Earlier physical GPS/map/manual tests are recorded in [the Android report](android-test-report.md); they do not establish live Ola availability.

Task 4 automated results: mobile/admin TypeScript and ESLint PASS; 135 mobile tests plus 8 localization/workflow tests PASS; 63 database/PostGIS scenarios PASS; 16 Edge regression tests PASS; strict Edge entry-point and diagnostic-script type checks PASS; Android/Hermes export and private-credential scans PASS. Provider tests use fixtures, and database tests use local PostGIS with mocked Auth identity/cron registration. No successful real-provider result is claimed.

Run `npm run check`, `npm run lint`, `npm test`, `npm run test:db`, Android export/secret scan, and `npx deno test --config supabase/functions/deno.json supabase/functions/location/provider_test.ts supabase/functions/location/request_test.ts supabase/functions/location/config_test.ts` after changes. No new binary, production OTA, Play publication, payment change or database migration is part of this integration.
