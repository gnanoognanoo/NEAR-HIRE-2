# Friend testing and OTA updates

The preview profile builds a standalone internally distributed Android APK for app.nearhire.mobile. It uses the existing EAS project and the preview environment/channel. Development remains a dev-client workflow. Production uses its own production channel and is not published by this workflow.

Testers install the APK once; Metro, Expo Go and developer tools are not required. Because the package remains unchanged, installing preview replaces an installed development build on the same device. The development profile and existing artifact remain available.

Expo checks for compatible updates on launch, downloads in the background and applies on the next cold restart. It never reloads an active workflow. Settings → About NearHire shows version, native build, runtime, channel and update ID.

## Publishing

From apps/mobile, with the same preview environment and Firebase configuration used by the binary:

```sh
npx eas-cli build --platform android --profile preview
npx eas-cli update --channel preview --platform android --environment preview --message "Describe the change"
```

Never publish this smoke test to production. Verify the computed runtime equals the preview binary before publishing. Fingerprint policy prevents updates reaching incompatible binaries. Keep GOOGLE_SERVICES_JSON available from the external secure directory during local OTA export (EAS secret file variables are not readable locally).

Compatible JS, styles, translations, validation, API queries and assets normally need only an OTA update. Native dependency changes, Expo SDK upgrades, Android manifest/config/plugins, permissions, package changes, Firebase configuration, MapLibre or Razorpay native upgrades require a new APK. A fingerprint change means build a new compatible binary; do not override the runtime to force delivery.

Google consent test-user restrictions and real phone SMS delivery must be verified for each tester rollout. Payments remain Razorpay TEST through hosted configuration. Never put server credentials into public env variables or updates.
