# Android UI updates: development, Preview and production

## Which app receives which changes?

| Installation | Source | How changes arrive | Reinstall for JS/UI? |
| --- | --- | --- | --- |
| NearHire development (`app.nearhire.mobile`, development client) | This computer's Metro server | Fast Refresh while connected | No |
| NearHire Preview (`app.nearhire.mobile.preview`, standalone) | EAS `preview` channel → `preview` branch | Tested, published compatible update; background download then restart | No |
| NearHire production (`app.nearhire.mobile`, release binary) | EAS `production` channel → `production` branch | Manually approved compatible production update | No |

Development and Preview coexist. Development and production share the original package, so their APKs are not a separate pair of simultaneous installations. A production build is a release binary, not the development client. This workflow creates no new Expo project and changes no package, scheme, native dependency or backend configuration.

## Investigation: 22 October 2026

The existing project is `gnanoos-team/nearhire`, ID `9788df17-3b02-4cd3-b594-8daff14abcad`, Expo SDK 57. `expo-updates` and `expo-dev-client` are already installed. Updates URL and fingerprint runtime policy were already correct.

- Latest finished Preview APK: `50bd3e5b-9622-402f-bef5-55835113634b`, built from `d501e3334e6176b7e3cff1466275fd7a3c14794b` on 18 October, with the redesign and explicit update controls embedded.
- Runtime: `dfbfa612664aad9ae6fb3e2462aa7f237b07065d`.
- Preview's latest published update: ID `01a14e20-aa1f-7d8d-862b-ab0afb9a39c2`, group `59fddb09-0456-4089-8eb9-e561b1d6af2a`, commit `29535b77ec64ac8fcaccac5d0ccf4de32823fe28`. It uses that same runtime and the correct Preview package/scheme. The channel is not paused and maps to the correct branch.
- The older Preview APK `e387fb67-9245-4743-b6bd-d1d72752db6d` also uses that runtime. Do not call SDK 57's native `file:fingerprint` sentinel a mismatch: its fingerprint asset contains the effective runtime.
- Development APK `f20ca7b1-416f-44e5-8b88-ba374a7906a5` is a development client, not a standalone Preview-channel subscriber.
- No Android device was attached during this investigation, so the currently installed binary, its downloaded update ID, crash recovery and device network state could not be inspected. There was initially no Metro server running. No exact phone-side download failure is claimed.

Confirmed workflow gaps: saving code did not publish it; CI only tested code and never sent a Preview update. Fast Refresh requires an open Metro session in the development client. Preview/production intentionally do not watch local files. The normal root test command omitted OTA, payment, posting and other regression files; it now discovers every mobile `*.test.ts`. Release update checks previously ran only at launch/Preview foreground transitions; the application now also checks periodically while active, for both release channels, at most once every 15 minutes.

New workflow tools are at the repository root deliberately: this app's fingerprint includes `apps/mobile/eas.json` and mobile package scripts. Altering those files for convenience alone would change the runtime unnecessarily. They remain unchanged; the check-only publisher confirms the existing Preview APK remains compatible. No ignore rule or runtime override weakens native compatibility.

## Fast Refresh on your development build

From the repository root:

```powershell
cd 'C:\PROJECTS\NEAR HIRE'
npm run start:dev -- --port 8081
```

This launches `expo start --dev-client --lan`, explicitly selecting the real app and clearing development gallery/demo flags in the child process. Open **NearHire**, not **NearHire Preview**, and select this Metro server/scan the development QR code. Keep both devices on the same reachable LAN. In React Native's development menu, Fast Refresh must be enabled (it is on by default). Save a component or style file to refresh it. Shared package sources are watched by the existing Metro monorepo configuration.

If Metro caches an old graph, stop that server and run:

```powershell
npm run start:dev -- --port 8081 --clear
```

For a USB connection (only if you choose to use USB):

```powershell
adb reverse tcp:8081 tcp:8081
npm run start:dev -- --port 8081 --localhost
```

Open the development app at `http://localhost:8081` through its launcher for USB, or use Metro's displayed LAN URL. Windows Firewall must allow this Node process on your private network; do not disable the firewall. A reachable `/status` should return `packager-status:running`. Expo Go cannot run NearHire's MapLibre/Razorpay native modules. Changing a non-component module can legitimately trigger a full JS reload instead of preserving React state. Native dependency/config changes require a new development binary.

## Standalone Preview update and verification

Install the latest standalone [Preview APK](https://expo.dev/artifacts/eas/4fdYNm31F-1xJXLG4c2j99cbMKlR5-J4FunH4sHjDdA.apk) if your installation lacks Settings → About NearHire → Check for Updates. Otherwise, first use those controls; a reinstall is not needed for a compatible update.

One-time prerequisites: normal EAS login to the existing project; correct external `C:\PROJECTS\NEARHIRE-SECRETS\google-services-preview.json`; reviewed committed source. The Firebase Android file is client configuration, never the Firebase Admin service account. It must remain outside Git. Both the build and update must use the same Firebase client configuration and EAS environment.

```powershell
# Compatibility/environment check only; does not upload anything.
npm run update:preview -- --build-id 50bd3e5b-9622-402f-bef5-55835113634b --google-services 'C:\PROJECTS\NEARHIRE-SECRETS\google-services-preview.json' --check-only

# After review and commit: validates, then publishes to preview only.
npm run update:preview -- --build-id 50bd3e5b-9622-402f-bef5-55835113634b --google-services 'C:\PROJECTS\NEARHIRE-SECRETS\google-services-preview.json' --message 'Describe the tested UI change'
```

The tool verifies the project, finished Android build/profile/package, channel mapping, shared release environment and native fingerprint. It refuses a dirty source tree and runs lint, TypeScript, all mobile/localization/update-policy tests, database/PostGIS scenarios, web/admin builds, Android/Hermes export and secret scans before upload. CI may reuse the successful `verify` job for the exact same commit. EAS exports a fresh bundle using `--environment preview`; the tool does not upload an old `dist` folder. Afterwards it checks update commit, branch and runtime and prints only safe update identifiers.

Verify from `apps/mobile`:

```powershell
npx eas-cli@25.3.0 channel:view preview --json --non-interactive
npx eas-cli@25.3.0 update:list --branch preview --json --non-interactive
npx eas-cli@25.3.0 update:view <update-group-id> --json
npx eas-cli@25.3.0 update:insights <update-group-id> --platform android --days 7 --json --non-interactive
```

On the phone, About NearHire should show channel `preview`, the reference runtime and the published Android Update ID. Check for Updates → wait for download → Restart to Apply. Without explicit restart, the downloaded update applies on the next cold launch. Simply returning from Android's home screen may resume the same process. Failed downloads are retryable. Updates never forcibly restart during checkout, sign-in, job publication or other protected mutations. An update must be published before any phone can download these new scheduling changes.

## Native compatibility and production

JS components, styles, translations, validation and bundled in-app images can be delivered OTA when the fingerprint matches. Changes to Expo SDK/React Native, native dependencies (including MapLibre/Razorpay), config plugins, Android permissions/package/scheme, Firebase Android file, icons/splash/native resources, or fingerprint-affecting build configuration require a new binary. If the guard reports `NATIVE_RUNTIME_CHANGED`, investigate and build; never hardcode the old runtime or ignore native inputs to force delivery.

The `production` channel/branch now exists in the same EAS project. Its shared environment has `APP_VARIANT=production`, fixture/test-auth flags false, the same public Supabase connection and the production-package Firebase Android file. Existing production build profile selects channel `production` and defaults to EAS environment `production`. No production binary was found in the inspected recent build records; supply a finished production reference build before publishing there.

```powershell
# Only after deliberate review, a production binary and device-tested Preview validation.
# The production publisher is blocked in CI and requires this explicit local flag.
npm run update:production -- --build-id <finished-production-build-id> --google-services 'C:\PROJECTS\NEARHIRE-SECRETS\google-services.json' --message 'Approved release' --confirm-production
```

Never run that command automatically after Codex edits. Native releases use the existing build profiles, explicitly authorized separately:

```powershell
cd apps/mobile
npx eas-cli@25.3.0 build --platform android --profile development
npx eas-cli@25.3.0 build --platform android --profile preview
# Production AAB only for an explicitly approved store release:
npx eas-cli@25.3.0 build --platform android --profile production
```

## Test-gated automatic Preview CI

`.github/workflows/ci.yml` runs all checks for pushes and pull requests. Its `preview-update` job requires the complete `verify` job to succeed, runs only for a push to `main`, serializes publication and skips superseded commits. It cannot publish production. A changed fingerprint fails the job with a new-binary requirement, not an incompatible OTA upload.

One-time setup in GitHub repository `gnanoognanoo/NEAR-HIRE-2`:

1. Create/use GitHub Actions environment `preview`.
2. Add environment secret `EXPO_TOKEN`: a dedicated Expo CI access token authorized for the existing project. Do not copy interactive login credentials, paste a token into source, or expose it in logs.
3. Add environment secret `GOOGLE_SERVICES_JSON_PREVIEW`: the raw contents of the external **Preview Android client** JSON, not the Firebase Admin JSON. The job writes it to `$RUNNER_TEMP`, outside the checkout, and removes it afterwards.
4. Set environment/repository variable `NEARHIRE_PREVIEW_BUILD_ID=50bd3e5b-9622-402f-bef5-55835113634b`. Update this reference after an intentional native Preview rebuild.
5. Set repository variable `NEARHIRE_PREVIEW_OTA_ENABLED=true` only after reviewing this workflow. Until then publication is disabled, while validation still runs. Commit/push the reviewed workflow to activate it.

No CI token was supplied during local setup; automatic publication is prepared but not claimed enabled. No update or APK build was submitted as part of configuration.

## Device acceptance checklist

- Development: connect the development client to Metro; save a visible component edit; confirm Fast Refresh. Confirm Firebase, maps, auth and checkout native modules still load.
- Preview: record channel/runtime/update ID; publish a tested compatible UI change; check/download/restart; verify the new ID and UI survive offline cold restart.
- Confirm network errors permit retry, repeated check taps do not duplicate downloads and no active auth/payment/publication is interrupted.
- Confirm a native input change is rejected by the guarded publisher and routes to a new binary.
- Confirm a failed CI check prevents the Preview publisher job; PRs never publish; production has no automatic publication job.

Local checks and cloud metadata do not substitute for these physical-device results.

Local verification on 22 October: Metro `/status` and Android development bundle returned HTTP 200; the React Refresh runtime was present; a real HMR WebSocket subscription received an update after a temporary source edit, which was restored. This verifies the server/watcher path, not rendering on a physical phone. TypeScript, ESLint, web/admin builds, Android/Hermes export, all 131 mobile tests, seven localization/workflow tests, 63 database/PostGIS scenarios, two Edge regression tests, Edge entry-point type checks and the decoded-bundle secret scan passed. Preview check-only publishing confirmed runtime compatibility with the existing APK.
