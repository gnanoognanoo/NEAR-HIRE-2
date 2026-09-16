> Current basemap: keyless OpenFreeMap. See [open map architecture](open-map-architecture.md). Historical credential instructions below are superseded; EXPO_PUBLIC_MAP_STYLE_URL is no longer consumed.

 NearHire Android development test checklist

Status: PENDING. No APK or physical-device result has been verified.

## Build prerequisites

- Existing Expo account authenticated and existing NearHire EAS project linked; no duplicate project.
- EAS development environment: GOOGLE_SERVICES_JSON is a File variable using the external Android config; public Supabase URL/anon key; EXPO_PUBLIC_DEMO_MODE=false; keyless OpenFreeMap default (no map environment variable required).
- Firebase service account remains outside Git and EAS. Firebase server credentials stay in Supabase.
- Dedicated public map style validated for HTTPS, style JSON, tile/glyph/sprite access, licensing and attribution. No demo style or private Ola key in mobile.
- Replacement Ola server credential configured only in Supabase for provider tests.

## Build and launch

```powershell
cd "C:\PROJECTS\NEAR HIRE\apps\mobile"
npx eas-cli build --platform android --profile development
# Install the successful EAS APK on the Android phone.
# Keep phone and computer on the same Wi-Fi.
$env:GOOGLE_SERVICES_JSON = "C:\PROJECTS\NEARHIRE-SECRETS\google-services.json"
npx expo start --dev-client --lan
```

The development client needs Metro. Expo Go cannot validate these native modules. APKs and native signing files must stay out of Git.

## Startup: available before real SMS configuration

- [ ] Launches with no native crash; correct NearHire branding.
- [ ] English/Tamil language selection precedes phone authentication.
- [ ] Auth route is shown; no fake user or OTP bypass.
- [ ] Large font sizes remain readable and controls remain usable.

## Auth-dependent checks: PENDING until Task 2 real SMS is configured

Sign in on real worker and employer devices using real OTP. Do not bypass auth to reach these screens. Record device model, Android version, APK build ID, app commit, test time and outcome; never record OTPs, tokens, private addresses or secret values in shared logs.

### Firebase and token lifecycle

- [ ] Firebase initializes; Android notification permission prompt works.
- [ ] Authenticated device obtains an FCM token and registers its owner mapping.
- [ ] Foreground/background notification behavior is correct.
- [ ] Logout removes the current-owner device mapping; login registers appropriately.
- [ ] Reinstall and token rotation register the new token correctly.

### GPS and manual location

- [ ] Grant permission and obtain the current location.
- [ ] Deny permission; permanently deny; disable GPS; verify actionable retry/settings messages.
- [ ] Retry after restoring permission/network/GPS.
- [ ] Manual coordinates work; blank/whitespace/invalid coordinates are rejected.
- [ ] Confirm locality and private address before saving a point.

### MapLibre and Ola

- [ ] Production map renders with working tiles and visible attribution.
- [ ] Pan, zoom, tap and drag the location pin.
- [ ] Ola autocomplete, place selection and reverse geocoding work with actual provider responses.
- [ ] Offline/provider failures offer retry; cached results behave correctly.

### Nearby discovery and privacy

- [ ] 1 km, 3 km and 5 km queries include/exclude expected jobs.
- [ ] Map/list switching, nearest sort, combined filters, refresh, scroll pagination and Load more work.
- [ ] Before acceptance, RPC payloads and UI expose only approximate location; exact residential address/coordinates remain unavailable.
- [ ] After acceptance, authorized location/contact is available; unrelated user remains denied.

### Expiry

- [ ] Expired job disappears from both list and map, including while screen stays open.
- [ ] Application to expired work is rejected; repost creates valid fresh work.

### Notification events

- [ ] Nearby job notification reaches an opted-in matching worker.
- [ ] Out-of-radius, blocked, suspended and opted-out workers do not receive nearby alerts.
- [ ] Application received, accepted and rejected events.
- [ ] Filled, expired, reposted and completed events.
- [ ] Notification details remain private to the authenticated intended recipient.
- [ ] Retry/partial delivery does not resend acknowledged tokens; offline recovery is checked.

Firebase OAuth/HTTP v1 validation and a healthy dispatcher do not prove any handset check above.

## First APK startup gate — 9 September 2026

Pre-build source baseline: d14ab765a122c6154248036d2cc779a0900a4c32. Record the actual EAS build commit/ID when a build is started. Current state: EAS public map style is absent, no APK has been built, and ADB detects no connected phone. Do not label any startup check passed yet.

Complete these checks before marketplace or real OTP testing:

| Check | Expected result | Status |
| --- | --- | --- |
| Install and launch | Development APK installs; no native crash | PENDING |
| Branding and layout | Splash/branding, safe areas, buttons and text render correctly | PENDING |
| English | Labels readable; language selectable before auth | PENDING |
| Tamil | Glyphs render, wrapping sensible, no clipping | PENDING |
| Phone screen | India +91 default; no fake session/demo login | PENDING |
| Large font scale | Language and phone screens remain usable | PENDING |
| Firebase startup | Native initialization does not crash | PENDING |
| Metro | Same-LAN dev-client connection, bundle load and Fast Refresh | PENDING |

The development client needs Metro to load the application screens. Start Metro after installing/opening the development client, before assessing the language/auth screens. The development-client launcher itself does not prove NearHire's JavaScript startup works.

If exactly one authorized physical phone is connected, install the downloaded APK with ADB. Otherwise install from the successful EAS build link and confirm installation. Record model, Android version, build ID, commit and each outcome. Do not capture OTPs or device tokens in shared diagnostics.

If launch crashes, stop before OTP. Inspect package-filtered AndroidRuntime/ReactNative/Expo/MapLibre/Firebase logs, distinguish JavaScript errors from native errors, fix the cause, and rebuild only when native code/configuration changed. Never bypass missing modules or authentication.

### Next stage: real OTP, only after startup passes

- Supply a supported SMS provider's credentials through secure configuration.
- Enable hosted Supabase Phone Auth with the documented OTP length, expiry and rate limits.
- Test real +91 OTP, resend/cooldown, wrong code, expired code and network failure.
- Verify close/reopen session restoration and logout/login.
- Then test profile → GPS → MapLibre → Ola search → post job → nearby PostGIS discovery → application → acceptance → private contact unlock → completion → rating → FCM events on two real devices.
- Payments and all authenticated workflows remain deferred; do not create fake sessions for testing.
