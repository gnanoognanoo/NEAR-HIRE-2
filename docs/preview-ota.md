# Friend testing and OTA updates

The current commands, CI setup, production separation and 22 October delivery diagnosis are in [Android update workflow](android-updates.md). The guarded publisher now validates/tests before uploading; use `-CheckOnly` on the PowerShell wrapper for a read-only compatibility check.

The preview profile builds a standalone internally distributed Android APK for app.nearhire.mobile.preview (NearHire Preview). It uses the existing EAS project and the preview environment/channel. Development remains a dev-client workflow. Production uses its own production channel and is not published by this workflow.

Testers install the APK once; Metro, Expo Go and developer tools are not required. Preview and development install side by side. Development remains app.nearhire.mobile and nearhire://auth/callback; preview uses nearhire-preview://auth/callback. Browser Google OAuth still uses the existing Supabase Web OAuth client, not a native Google sign-in SDK.

Expo checks for compatible updates on launch, downloads in the background and applies on the next cold restart. It never reloads an active workflow. Settings → About NearHire shows version, native build, runtime, channel and update ID.

About NearHire also shows embedded/downloaded origin, OTA enabled state, check result and emergency recovery state. Check for Updates downloads a compatible update and offers Restart to Apply. Preview checks on foreground at most once every 15 minutes after native startup. A downloaded update shows a restart notice. Restart is explicit, and is blocked while checkout/verification, sign-in, publication or another app mutation is active. Web and development mode cannot run release OTA checks. Failed checks are retryable and never display raw request headers or URLs. No automatic restart is performed.

## Publishing

From apps/mobile, with APP_VARIANT=preview and the same preview environment and Firebase configuration used by the binary:

```sh
npx eas-cli build --platform android --profile preview
npx eas-cli update --channel preview --platform android --environment preview --message "Describe the change"
```

Never publish this smoke test to production. Verify the computed runtime equals the preview binary before publishing. Fingerprint policy prevents updates reaching incompatible binaries. Keep GOOGLE_SERVICES_JSON available from the external secure directory during local OTA export (EAS secret file variables are not readable locally).

Use the guarded publisher from the repository root for future updates:

```powershell
.\scripts\publish-preview-update.ps1 -BuildId '<finished-preview-build-id>' -GoogleServicesFile 'C:\PROJECTS\NEARHIRE-SECRETS\google-services-preview.json' -Message 'Describe the change'
```

It sets APP_VARIANT and release flags explicitly, verifies the target APK package/channel and native fingerprint, and always publishes with `--environment preview`. Build-profile env values alone are insufficient for `eas update`. The shared EAS preview environment must also keep APP_VARIANT=preview, production Supabase public configuration, the Preview Firebase file variable and development-only UI/auth flags false. Never override runtime to make an incompatible update appear eligible.

## Delivery investigation — 18 October 2026

The previously distributed finished APK e387fb67-9245-4743-b6bd-d1d72752db6d was inspected directly: package app.nearhire.mobile.preview, channel preview, updates enabled, project 9788df17-3b02-4cd3-b594-8daff14abcad, and embedded assets/fingerprint dfbfa612664aad9ae6fb3e2462aa7f237b07065d. Its manifest uses the SDK 57 `file:fingerprint` sentinel, which correctly resolves to that asset; the sentinel is not its effective runtime.

The redesign update group 6b20bcad-c64b-4a37-87b5-f3805b40f055 has the same runtime and resolved Preview package/scheme. Preview maps to its branch. An anonymous Expo Updates protocol request with that APK's headers returned HTTP 200 and the expected update. Its Hermes bundle contains the new canvas/surface/accent colors and NeoThemeProvider. All 23 referenced assets downloaded with matching SHA-256 hashes using the server's per-asset authorization headers from multipart extensions (as expo-updates does). Omitting those headers yields HTTP 403 in a hand-written download probe; that is not evidence of a native client download failure.

EAS insights reported zero installs, unique users and failed installs for the redesign across the available 14-day window. This does not prove the phone downloaded it, crashed, or rolled back. APP_VARIANT mismatch and channel/runtime mismatch were ruled out for this published update and this distributed APK. The exact device-side cause remains unverified without device diagnostics. The prior behavior offered no explicit check/restart controls and only applied downloads on cold restart. The user uninstalled Preview and requested a fresh cloud APK with the latest source embedded, superseding investigation of that installation. No account/server data is removed by this build.

Compatible JS, styles, translations, validation, API queries and assets normally need only an OTA update. Native dependency changes, Expo SDK upgrades, Android manifest/config/plugins, permissions, package changes, Firebase configuration, MapLibre or Razorpay native upgrades require a new APK. A fingerprint change means build a new compatible binary; do not override the runtime to force delivery.

Google consent test-user restrictions and real phone SMS delivery must be verified for each tester rollout. Payments remain Razorpay TEST through hosted configuration. Never put server credentials into public env variables or updates.
