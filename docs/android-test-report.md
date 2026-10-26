# Physical Android smoke test — 23 October 2026

> 26 October update: optional address lookup is now disabled server-side and GPS/manual confirmation is independent of it. Automated/hosted checks passed; the current APK retest is pending because ADB detects no phone. See [provider-independent location status](address-search.md). The physical results below remain the dated 23 October test, not a new device pass.

## Result

PHYSICAL SMOKE TEST PASSED for the checks recorded below. Extended end-to-end tests remain pending; this is not a production-readiness claim.

Device: vivo V2204, Android 12, default font scale 1.0. ADB initially reported unauthorized; the owner approved USB debugging. The verified development APK was installed successfully with `adb install -r`, without clearing app data. USB reverse connects the app to Metro on port 8081. One real `app.nearhire.mobile` inspector target is connected after a cold restart.

APK build: `ac22ccd3-3c58-4f70-a26b-bff9515f3f02`, original source `e3faedcc2c0016819025978517b308ed1a7a38cf`, package `app.nearhire.mobile`. The APK was not rebuilt. It serves the current working source and fixes through Metro; its original native build revision is unchanged. Download, signature, runtime and module evidence is retained in the dated host-only report below.

## Reproduced problems and fixes

1. White Android status-bar text was unreadable on the light NearHire canvas. `apps/mobile/App.tsx` now mounts the already-installed Expo StatusBar with dark text. The change appeared on the physical phone through refresh.
2. The Tamil GPS-disabled error card compressed its recovery controls inside the bounded location panel. `CurrentLocationControl.tsx` no longer shrinks that card. Scrolling exposed Retry, Open Settings and manual selection; Open Settings successfully opened Android Location settings.
3. The shared page ScrollView retained a previous screen's deep scroll offset. Opening Settings from a scrolled Profile began in the middle of Settings. `LiveApp.tsx` resets the existing ScrollView on screen/workspace changes without remounting it. Opening Profile from the bottom of a long job form now showed its title and top controls.
4. The keyboard covered the focused job-title input on this Android phone. Keyboard avoidance now surrounds the page viewport in `LiveApp.tsx`, using height on Android and padding on iOS. The nested job-form-only wrapper in `PostWork.tsx` was removed. The settled phone screen showed the focused input and cursor above the keyboard. No new dependency or native configuration was introduced.

## Actual physical-device results

| Check | Result and limits |
| --- | --- |
| Install and startup | PASS; supplied APK installed and launched, latest neumorphic UI visible |
| Metro connection | PASS; USB reverse, Android bundle loads, real React Native inspector target connected |
| Fast Refresh | PASS; the status-bar/layout source fixes reached the running phone without reinstalling |
| English/Tamil | PASS for language selection, login, location feedback and observed navigation/form text; not every translation screen was visually tested |
| Authentication/session | Existing real authenticated profile/home loaded; cold force-stop and relaunch restored authenticated Post Work home and the displayed 12-credit balance; no bypass or fixture session |
| New-user onboarding / real OTP | NOT RUN in this attempt; no fresh account was provisioned and no OTP was captured or requested intentionally |
| Navigation | PASS for Find Work home, Profile, Settings, Post Work switch/home, category picker, back/reopen and return to Profile |
| Native map | PASS; MapLibre rendered OpenFreeMap tiles and attribution in the location picker |
| GPS permission | PASS; Android prompt shown, owner granted precise location; fine/coarse grants confirmed |
| GPS disabled/recovery | PASS; disabled-service feedback displayed, repaired Settings action opened Android settings, fresh retry obtained a fix with about 14 m reported accuracy |
| Reverse/address lookup | UNAVAILABLE; app showed localized provider-unavailable feedback while retaining a usable GPS/manual point; no provider credentials changed |
| Manual map selection | PASS; tapping map changed point status to selected location; no coordinates or address published |
| Residential form | PASS for opening, real category options/selection, title input, scrolling and keyboard focus |
| Business form | PASS for switching/rendering; business/display-name field present; full valid submission not run |
| Local draft preservation | PASS; temporary title persisted after Back and reopening. Test title was removed afterward. Only local draft selection metadata remained; no server draft was saved |
| Missing required fields | PASS; incomplete Publish attempt produced validation feedback, did not open successful publication, and displayed balance remained 12 |
| Crash/runtime monitoring | No NearHire crash-buffer entry or matching JavaScript/native fatal exception observed during the smoke test; this does not prove absence of all future crashes |

The owner may have completed interactive authentication while testing. This report confirms the real protected UI and restored session, not a separately audited new Google-account provisioning/duplicate-credit test. No passwords, OTPs, session tokens, precise GPS coordinates or device identifiers are recorded here.

## Automated validation after fixes

- Mobile/admin TypeScript: PASS.
- ESLint: PASS.
- 131 mobile tests plus 8 localization/update-workflow tests: PASS, zero failures.
- 63 local database/PostGIS integration scenarios: PASS; real PostGIS with mocked Auth identities and cron registration. These are not hosted-database/device end-to-end results.
- Final Android/Hermes export: PASS. The first sandboxed attempt could not write the compiler's temporary bytecode file; rerunning with filesystem access succeeded.
- Tracked source and final decoded Android-bundle secret scan: PASS; external private-value comparison found no matches in source.
- Whitespace/diff inspection: PASS. Only the four UI files above and test documentation changed.

## Remaining tests and operating state

Real phone OTP delivery, new-account profile creation, permission denial/permanent-denial branches, manual coordinate text entry, complete valid job publication/credit debit/map visibility, FCM token registration/delivery and native Razorpay TEST checkout are DEVICE TEST PENDING. No live job, purchased-credit transaction or payment was submitted. The account's UI language was changed to English and its workspace to Post Work through normal controls during testing; authentication identity and credentials were preserved.

The phone is left on the authenticated Post Work home, connected to the development server. Metro launcher: `npm run start:dev -- --port 8081` from `C:\PROJECTS\NEAR HIRE`; reuse the existing running instance. Demo/gallery/payment-test-login flags remain off. No APK rebuild, OTA upload, production deployment, Play submission, Supabase configuration change, Firebase configuration change or payment-mode change was performed.

---

# Historical host-only attempt — 22 October 2026

The following records the earlier attempt, before this phone was connected. Its no-device statements apply only to that dated attempt.


## Result

PARTIAL — host-side checks passed; physical Android testing is blocked because ADB detects no device. No phone-side success is claimed. No runtime bug has been reproduced on a handset, so no speculative application fix was made.

## Verified build and source

- EAS build: `ac22ccd3-3c58-4f70-a26b-bff9515f3f02`; authenticated EAS status `FINISHED`, completed 22 October 2026 at 15:47:29 UTC.
- Source commit: `e3faedcc2c0016819025978517b308ed1a7a38cf`.
- Existing project: `gnanoos-team/nearhire`, ID `9788df17-3b02-4cd3-b594-8daff14abcad`.
- Android package: `app.nearhire.mobile`; development profile; runtime `5ad4daeea5399a3654309756d46880655b245b0a`.
- [APK download](https://expo.dev/artifacts/eas/8wbzI_a4gTSpe4Odwy2trH56PC_bkifMbZnylvxHZWk.apk).
- APK SHA-256: `3b55aad985baa7a7365a23f0ee26ef80086418cf75d560f3c07e5aff6a11b689`.
- Downloaded APK inspection: ZIP integrity and signature valid; signer matches the previous development APK; debuggable; development client/menu, MapLibre, Razorpay and Firebase messaging present; location/notification permissions present; expected scheme and runtime present; no supplied private credentials detected.
- Current source contains the premium neumorphic UI (`App.tsx` → `ProductionApp.tsx` → live screens). The development APK obtains these screens from Metro; offline standalone UI is not claimed.

## Checks run during this testing attempt

| Check | Result | Scope |
| --- | --- | --- |
| Mobile and admin TypeScript | PASS | Automated |
| ESLint | PASS | Automated |
| Mobile unit tests | 131 passed | Automated; includes auth, location, posting, payment, map presentation, navigation and UI-token logic |
| Localization/update workflow | 8 passed | Automated; English/Tamil key coverage and config guards, not handset font rendering |
| Database/PostGIS scenarios | 63 passed | Local integration; real PostGIS, mocked Auth identity/cron registration |
| Source and exported Android/Hermes bundle secret scan | PASS | Automated; existing SDK-aligned export inspected |
| Comparison against supplied external private credentials | PASS | 196 source files, 9 private values, no matching source files; values never printed |
| Whitespace check and source review | PASS | Six intended native/config/test/documentation files in the build commit; no application changes introduced by this testing attempt |
| Metro `/status` | HTTP 200 | Server on port 8081 |
| Android development bundle | HTTP 200; React Refresh runtime present | Server compilation, not phone rendering |
| HMR WebSocket and source watcher | PASS | Temporary comment triggered an update; source restored byte-for-byte |
| Metro error-log inspection | No matching transform/runtime exception lines | Host log only; no connected application |
| ADB detection | No attached devices | Physical testing blocked |
| React Native inspector | Zero connected targets | No development-client connection verified |

Metro is running from `apps/mobile` with `expo start --dev-client --lan --port 8081 --clear`, launched through the root development helper. Demo/gallery/payment-test-login flags are disabled. LAN address at test time: `http://192.168.0.104:8081`. Fast Refresh is ready on the host; its setting and visual effect on a handset remain unverified.

No new APK, OTA update, production deployment, Google Play submission, backend write, authentication bypass, credential rotation or real payment was performed by this testing attempt. Existing Supabase, Firebase, native MapLibre/OpenFreeMap, PostGIS and Razorpay TEST implementations were preserved.

## Physical-device results

All following checks are DEVICE TEST PENDING: install/update the exact APK while preserving app data; development-client launch and Metro connection; crash monitoring; English/Tamil glyphs and layout; language selection; onboarding and real authentication; navigation/back behavior; map rendering/attribution; GPS permission grant/deny/retry; job-form typing, keyboard behavior and location preservation; responsiveness; FCM registration; native Razorpay TEST checkout. No live job or payment was created.

## Resume procedure

The remaining external action is to connect a data-capable USB cable, enable Android USB debugging and accept the debugging authorization on the phone. Do not clear application data or uninstall the existing app. Once ADB reports an authorized device, the agent can perform these commands itself:

```powershell
# Repository root
cd 'C:\PROJECTS\NEAR HIRE'
npm run start:dev -- --port 8081
# Reuse the running server rather than starting a second copy.
adb devices -l
adb -s <authorized-device> reverse tcp:8081 tcp:8081
# If the installed development APK is absent or stale, install the verified APK with adb install -r.
adb -s <authorized-device> shell am start -a android.intent.action.VIEW -d 'exp+nearhire://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081' app.nearhire.mobile
```

Then inspect the application PID's logs and screenshots, record model/Android version and actual results, and request human Google consent/OTP or system-permission actions only when needed. Do not collect or print OTPs, access tokens, personal addresses or unrelated phone logs. Test posting/payment writes only with a clearly designated test account and explicit test intent. Keep development and Preview results separate.
