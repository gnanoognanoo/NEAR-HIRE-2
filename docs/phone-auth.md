> Current provider decision, hosted readiness and existing-APK instructions: [authentication.md](authentication.md). Results below are historical; do not reinitialize EAS or build another APK from this older checklist.

# Task 2: phone OTP — BLOCKED on SMS provider setup

The repository implementation is ready for provider integration testing. The cleanup migration is deployed and verified. Real OTP testing still requires SMS configuration and the real-device checks below. No SMS credentials or hosted OTP bypasses were added.

## Inspection and architecture

The existing signInWithOtp/verifyOtp, SecureStore sessions and language-first onboarding were retained. Gaps addressed: generic errors; changing the phone during verification; no session-restore retry; incomplete profile routing; missing device-token cleanup.

Flow: English/Tamil selection → phone (India default, explicit international codes supported) → send → six-digit OTP → verify → fetch profile → new/incomplete user completes name/locality → home; completed profiles go directly home.

PhoneAuth holds only ephemeral phone/code/loading/error state. Full libphonenumber metadata validates mobile numbers and rejects malformed input, extensions and known landlines. A shared request gate prevents overlapping sends/verifications. Its 60-second absolute cooldown is reserved before sending, even on ambiguous failures, and survives screen remounts/background time within the process. Restarting the process resets this UI timer; Supabase server limits remain authoritative. SMS sends are never automatically retried. Changing the number clears the code. No OTP is stored or logged.

English/Tamil messages cover invalid format, invalid/expired codes, rate limits, network failure, provider unavailability and success. Supabase may use otp_expired for both wrong and expired codes; the message covers both without inventing a distinction. Failed verification clears the entered code and permits retry.

Native sessions remain in SecureStore with persistSession, autoRefreshToken and processLock. Foreground starts refresh; background stops it. Session loading errors show retry without deliberately erasing saved login. Sign-out clears cached user data, location and modal state. Web preview intentionally uses tab-scoped sessionStorage.

Logout serializes with device registration, unregisters the current user's current push token, signs out the current Supabase session (scope local), then removes device bookkeeping. Other devices remain signed in. If cleanup or sign-out fails, logout remains retryable and does not report success. Reconnect before retrying offline logout. Already queued pushes cannot be recalled. Automatic expiry without explicit logout may leave a stale push registration and must be checked on devices.

## Supabase and SMS setup

Project: mxsltkyebhboaglbspse. Confirmed on 7 September 2026: hosted phone auth is disabled. No provider setting was changed. Database connectivity recovered and the cleanup migration was deployed through the normal Supabase workflow.

1. Open Authentication → Sign In / Providers → Phone in the existing Supabase dashboard.
2. Current decision: use the signed Supabase Send SMS Hook with 2Factor. Follow authentication.md for the template API, credentials, reservation migration and controlled setup. The previous built-in Twilio recommendation is superseded.
3. Enable Phone and new-user signup. Match this app with six-digit SMS OTPs. Configure an explicit expiry (suggested 300 seconds) and minimum send interval of 60 seconds. Review SMS-send and verification rate limits against expected traffic and budget. The service can require a longer wait than the UI timer.
4. Verify the SMS template includes Supabase's required token placeholder and matches the provider-approved template. Never configure fixed hosted test OTPs or copy local config.toml test_otp settings into production.
5. Retain appropriate nearhire:// and HTTPS redirects where needed; direct code entry needs no OAuth redirect. If enabling CAPTCHA, first implement a compatible client token flow; this app does not currently supply CAPTCHA tokens.
6. Migration 202609070001_auth_device_cleanup.sql is already applied to this project; do not rerun it manually. It adds only the owner-scoped unregister_device RPC; anonymous access is denied. For a different environment, use the normal Supabase migration workflow.

Environment remains apps/mobile/.env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY (public anon/publishable only), EXPO_PUBLIC_DEMO_MODE=false. No new public environment value is needed. Provider secrets/service-role keys stay server-side.

Sources: [Phone login](https://supabase.com/docs/guides/auth/phone-login), [rate limits](https://supabase.com/docs/guides/auth/rate-limits), [error codes](https://supabase.com/docs/guides/auth/debugging/error-codes), [React Native sessions](https://supabase.com/docs/guides/auth/quickstarts/react-native), [sign-out](https://supabase.com/docs/reference/javascript/auth-signout).

## Android procedure and verification checklist

After provider setup and migration deployment, use real numbers you control, including a new number and an existing completed profile. Use a native development build, not Expo Go, because this project includes MapLibre and Razorpay native modules. If needed, configure your Expo/EAS project, run `npx eas-cli build --platform android --profile development` from apps/mobile, then install the resulting APK. Run `npx expo start --dev-client --lan` from apps/mobile; connect phone/computer to the same Wi-Fi and open the development URL in the installed app. Firebase configuration is required for the push-cleanup check. No signed APK was created by this task.

Record results in both languages without capturing phone numbers, tokens or codes.

| Test            | Expected verification                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A Correct OTP   | Latest code signs in once, profile/home loads; reuse is rejected.                                                                                                    |
| B Incorrect OTP | Wrong six digits show invalid/expired guidance, no new session; correct retry works.                                                                                 |
| C Expired OTP   | Wait beyond configured expiry; rejection then successful fresh-code request.                                                                                         |
| D Resend OTP    | Rapid taps create one request; wait 60 seconds; latest code works. Background time counts; change-number clears code.                                                |
| E Rate limiting | Controlled provider test returns localized rate-limit feedback; no retry loop or repeated SMS flood.                                                                 |
| F Close/reopen  | Swipe app away after login, reopen to same profile. Repeat after access-token expiry and verify foreground refresh.                                                  |
| G Logout/login  | Enable push, logout, verify current device row removed and reopen stays signed out. Log in again; other device registration survives.                                |
| H New user      | New verified account reaches name/locality setup, save routes home.                                                                                                  |
| I Existing user | Completed profile goes home; incomplete profile resumes setup.                                                                                                       |
| J No network    | Send/verify show retryable errors. Reconnect and retry once. Expired-session reopen recovers. Offline logout reports failure; reconnect and retry to finish cleanup. |

## Tests and troubleshooting

Run npm run check, npm run lint, npm test, npm run test:db from the root. Auth tests cover normalization, validation, exact cooldown boundaries, duplicate prevention, failure retries, routing, session result handling and error mapping. Database tests cover owner-only/idempotent cleanup and anonymous denial. These do not prove SMS delivery or physical-device persistence.

No SMS: check Phone toggle, credentials, provider balance, country permissions, sender/template approvals and redacted delivery logs. Invalid code: use latest SMS for the displayed number; confirm length/expiry then resend once. Rate limit: wait for the server window; do not weaken limits to hide retry defects. Profile errors: check signup trigger and RLS, then retry. Logout error: check network, cleanup migration and Firebase token access. Web session loss after tab closure is expected; validate persistence on Android.

## Changed files and results

Mobile: src/live/PhoneAuth.tsx, auth-logic.ts, auth-logic.test.ts, LiveApp.tsx, client.ts, services.ts, locales/en.json and locales/ta.json; apps/mobile/package.json adds auth tests. Database: supabase/migrations/202609070001_auth_device_cleanup.sql. Tests: tests/database.mjs and tests/localization.mjs. Root .gitignore excludes the Android verification export. This document contains setup and the A–J real-device checklist.

Validation: mobile/admin TypeScript PASS; ESLint PASS; 8 auth tests, 3 existing marketplace tests and 2 localization tests PASS; 14 database scenarios PASS; Android/Hermes export PASS (not a signed APK). Session restore has a tested 25-second timeout and retry so a stalled refresh cannot hold the initial spinner indefinitely. No physical-phone or live SMS success is claimed. The Task 2 changes are prepared for the requested commit: feat: productionize phone OTP authentication.

Final deployment result: APPLIED AND VERIFIED on 7 September 2026, project mxsltkyebhboaglbspse. The dry run listed only 202609070001_auth_device_cleanup.sql. Normal db push applied that migration; the previous four migrations were not rerun. Subsequent migration list confirmed all five local/remote versions match. No migrations remain pending.

The repository checks were rerun before commit: TypeScript, ESLint, 8 auth tests, 3 marketplace tests, 2 localization tests and 14 database/PostGIS scenarios all passed. Source inspection found no mobile SMS-provider secrets, service-role keys, production OTP bypasses or hardcoded real OTPs. India remains the default; both English and Tamil are covered.

Current external blocker: provision/configure the SMS provider and enable hosted Phone Auth. Real SMS delivery has not been tested. After setup, use these commands from the mobile directory (EAS account/project setup is required if not already configured):

```powershell
cd "C:\PROJECTS\NEAR HIRE\apps\mobile"
npx eas-cli login
npx eas-cli init
npx eas-cli build --platform android --profile development
# Install the resulting APK on the Android phone, then:
npx expo start --dev-client --lan
```

Use the existing EAS project if one is already linked; do not initialize a duplicate. Match the existing public Supabase environment values in the development build environment. Connect phone and computer to the same Wi-Fi, open the development URL in the installed build, and complete the A–J checklist. No Expo Go or SMS bypass substitutes for this test.
