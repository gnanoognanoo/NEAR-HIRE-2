# Preview GPS and TEST payment validation

This update changes JavaScript only. MapLibre/OpenFreeMap, native packages, Firebase, auth callbacks and PostGIS remain unchanged. Development authentication helpers stay disabled in Preview. No live payments are enabled.

## Location behavior

- One shared foreground request handles multiple location buttons. Android coarse permission is accepted and labelled approximate; fine permission uses High accuracy. No background permission or background service is requested.
- A temporary foreground watch is removed after the first fix, error or 20-second timeout. If registration completes after cancellation, the resulting subscription is immediately removed.
- Timeout/unavailability can fall back only to a fix within two minutes and with a known uncertainty of at most 1000 metres. Permission denial and disabled services never fall back. Cached and approximate fixes show separate English/Tamil labels and measured uncertainty. The browser uses secure-context geolocation and a session-memory cache with the same bounds.
- Retry, Settings and manual pin/coordinate selection remain available. Reverse lookup has a five-second bound and cannot erase an accepted coordinate. Enter locality manually when address lookup fails. Manual coordinates are available in release Preview, without development tools.
- Coordinate changes recenter discovery maps and refresh the owner-safe PostGIS queries. Radius is retained. Placeholder results from a previous location/filter are hidden while fetching. Worker coordinates remain approximate public RPC results; normal/urgent job markers remain green/red.

## TEST credit payments

Profile → Job Credits → Buy Job Credits exposes the server package catalogue: 1 credit ₹9, 5 ₹39, 10 ₹69 (and the existing 25-credit package). Existing balance never disables buying. Continue Payment requires selection and hosted TEST enabled/live disabled, then verifies the current authenticated user. Native checkout rejects non-TEST keys, malformed orders and non-INR amounts.

An owner-scoped SecureStore record saves the idempotent request before order creation and the receipt before verification. It survives app closure, screen changes and network failures. Existing AsyncStorage request IDs are reused across the update. Records are never submitted for a different current user, never logged and contain no server key. Local evidence never adds credits.

Startup, foreground return and opening Credits check saved orders. A receipt is retried against payment-verify; the ownership-filtered/RLS-protected order status is also checked. Only a server-confirmed paid state clears recovery state and refreshes the wallet/history. Pending confirmation polls at most 12 times every five seconds on Credits, then offers Check payment status. Retrying the same package with a saved receipt verifies it without opening another checkout. Cancellation/failure retain the same idempotency request for an explicit retry or webhook reconciliation.

Exactly-once settlement stays in the existing server RPC. Neither checkout success nor a local receipt can grant credits. Captured-payment matching, HMAC verification, RLS and monthly-first credit consumption are unchanged.

## Friend device checklist — DEVICE TEST PENDING

1. Install the separate NearHire Preview APK; the development app can coexist. Launch online to download the compatible preview OTA, then fully close/reopen it. About NearHire shows the update ID.
2. Sign in normally and choose Find Work. Use current location outdoors; verify current marker, recenter, nearby refresh and radius retention. Repeat in Post Work and verify only discoverable, approximate worker locations.
3. Exercise approximate permission, denied/permanent permission, services off, slow/no fix, offline and repeated taps. Confirm the honest cached/approximate label and uncertainty when fallback is used. Retry after moving. Use pin/coordinates and enter locality while reverse lookup is offline.
4. Profile → Job Credits: select ₹9 and complete Razorpay's simulated TEST payment. No real money. After server capture, confirm +1 purchased transaction and wallet refresh. A starting balance of 12 should become 13; publishing one valid job should then become 12, consuming eligible monthly credits first. Existing October grants/previous activity may change the actual starting balance: record it rather than assume 12.
5. Cancel checkout, simulate failure, disconnect after completion, restart the app and reopen Credits. Use Check payment status. Ensure retry does not create a second purchase for an already-submitted receipt and repeated callbacks/webhooks grant once.

Automated tests cover permissions, cache bounds, timeout, concurrent GPS requests, payment recovery, account switches and TEST guards, plus the existing auth/credit/RLS/PostGIS regressions. Physical GPS accuracy and real native checkout/capture remain DEVICE TEST PENDING until an Android tester performs this checklist. No device, USB, Metro or Expo Go is required for delivery.

## Automated verification (2026-10-08)

127 tests passed: 60 mobile, 2 localization, 54 database/PostGIS, 11 Edge Function. TypeScript, ESLint, all seven Edge Function type checks, web export, admin build, Expo public config and Android/Hermes export passed. Private-credential scans found no matches or forbidden tracked files.

Hosted smoke: authenticated TEST order and same-request retry passed; invalid signature returned HTTP 400, anonymous order returned HTTP 401, unpaid order did not change credits. Hosted TEST enabled and live disabled confirmed. No native checkout or captured payment was simulated as a device pass.

Preview fingerprint exactly matches build e387fb67-9245-4743-b6bd-d1d72752db6d: dfbfa612664aad9ae6fb3e2462aa7f237b07065d. Package scripts/configuration/native dependencies remain unchanged, so delivery uses preview OTA, with no new APK required.
