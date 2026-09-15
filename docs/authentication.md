# NearHire authentication

Reviewed 15 September 2026. Supabase Auth owns consumer identity and sessions. Firebase is FCM only. Admin authentication/MFA and payment ownership remain unchanged.

## Implementation and verified limits

Language selection precedes authentication. The login screen offers Google first and Phone second, in English and Tamil. Both paths use the same Supabase client, SecureStore on Android, tab-scoped sessionStorage on web, refresh lifecycle and UUID ownership. Google uses browser OAuth with PKCE, not Firebase Auth or a separate native Google identity SDK. No Google secret is needed in the app.

Hosted project `mxsltkyebhboaglbspse`: public Auth settings currently report Google disabled and Phone disabled. The supplied Firebase Android file is present, but no separate Google OAuth/2Factor credential file was found. Edge secret names TWOFACTOR_API_KEY, TWOFACTOR_TEMPLATE_NAME, SEND_SMS_HOOK_SECRET and SMS_RECIPIENT_HASH_SECRET are absent. Google Cloud consent/client configuration has not been independently verified. No real Google login or SMS was attempted.

The Send SMS Hook and its reservation migration are repository implementations, not deployed/configured hosted services yet. Provider calls are mocked in automated tests. Production SMS is not enabled. The existing EAS build is unchanged; a NEW DEVELOPMENT BUILD IS REQUIRED for the newly added expo-web-browser native module. Do not submit one until approved.

## Google setup

Use the existing Google Cloud project if appropriate; Firebase google-services.json is not proof that an OAuth client/consent screen is configured.

1. In Google Auth Platform configure NearHire branding, support contacts, audience and test users. Request only openid, email and profile scopes. Complete Google verification required for public release later.
2. Create/use an OAuth **Web application** client. Its authorized redirect URI is exactly `https://mxsltkyebhboaglbspse.supabase.co/auth/v1/callback`. This is Google's callback to Supabase, not the app deep link.
3. Store the Web client ID and client secret in Supabase Authentication → Sign In / Providers → Google; enable Google only with valid credentials. Never put the client secret in EXPO_PUBLIC variables, Git, or mobile assets. Leave nonce checks enabled.
4. In Supabase URL Configuration allow the app callback `nearhire://auth/callback`, and exact web development roots in use, such as `http://localhost:8095/` and `http://localhost:8081/`. Add the actual future HTTPS web origin root at deployment. Keep Site URL appropriate to the deployed site. Do not use wildcard production origins or localhost as a production fallback.
5. This implementation obtains its web callback from the current origin and returns to `/`, so a web export needs no server callback route. Web OAuth stays in the same tab to retain the PKCE verifier in sessionStorage. Run the live app (`EXPO_PUBLIC_UI_PREVIEW=false`, `EXPO_PUBLIC_DEMO_MODE=false`), not the fixture gallery, for real authentication. Localhost callbacks require the matching allowlist; hosted previews require their exact origin.
6. Android development and future production both use the existing scheme `nearhire`, package `app.nearhire.mobile`, and a system-browser auth session. **The same Web OAuth client is required for this browser flow on both Android and web. An Android OAuth client/SHA fingerprint is not required by this chosen flow.** If a future task explicitly replaces it with a native Google Sign-In SDK, register separate Android clients for the development signing certificate and production/Play App Signing certificate, and configure the Web client as server audience. Do not confuse this optional future setup with today's browser flow.
7. Enable manual identity linking in Supabase Authentication settings before offering a successful Link Google operation. Existing login remains available when linking is disabled; the app displays a friendly configuration error.

References: [Google provider](https://supabase.com/docs/guides/auth/social-login/auth-google), [mobile deep links](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

## Identity and provisioning

The auth.users INSERT trigger provisions profiles, worker_profiles and job_credits once for the Supabase UUID. Existing credit rules award 10 welcome and 2 current-UTC-month credits when eligible. Returning login, token refresh and linking operate on the same UUID and do not invoke custom signup or grant APIs. The existing immutable ledger constraints protect repeat grants. Tests exercise both phone-present and phone-absent Auth fixtures against the real SQL trigger, with repeated provisioning and updates; they do not claim to exercise Google's or Supabase's remote identity service.

Google-first users can add a phone during profile completion or in Profile → Login & Security. This calls authenticated `updateUser({ phone })`, then `verifyOtp({ phone, token, type: 'phone_change' })`. The transport revalidates the current user and requires the original UUID, confirmed timestamp and matching number after verification. It never calls signInWithOtp for linking. The UI adds an unverified number; changing an already verified phone (which can require confirmation of both numbers) is outside this flow.

Phone-first users sign in with their existing method, then use Profile → Login & Security → Link Google Account. This calls `linkIdentity`, not signInWithOAuth. OAuth completion checks the original UUID. An identity already owned by another account produces a friendly conflict, not a wallet/profile merge. Supabase may automatically link verified matching email identities under its own rules; NearHire performs no matching by entered name, email or phone. If someone independently signs up with unrelated Google and phone identities before linking, no safe way exists to infer they are the same person; they must return to their original account. The app explains this, and does not merge accounts or duplicate rewards as a linking side effect.

PKCE verifier persistence is managed by supabase-js. The pending callback stores only target, expected UUID and timestamp, expires after ten minutes, and is removed after completion or logout. Only the expected callback origin/path is accepted. Web callback query strings are removed before session exchange. No OTP/provider token is displayed or logged.

## 2Factor delivery setup (not enabled)

Supabase generates and verifies every six-digit OTP and issues the session. The hook uses the signed sms.phone destination from current Supabase Auth, including phone_change. Legacy login payloads may fall back to user.phone only when no pending phone_change exists; ambiguous change payloads fail closed. 2Factor only delivers the supplied code through the Send SMS Hook; no AUTOGEN or provider verification endpoint is used.

The current official [2Factor supplied-code template example](https://2factor.in/v4/services/bulk-sms-api.html) documents `POST https://2factor.in/API/V1/OTP/SEND`, an `X-API-Key` header, and JSON `to`, `template_name`, `var1`. The adapter sends the Supabase OTP as var1 and accepts only the documented `status: sent` response. Other 2Factor pages describe provider-generated OTP APIs; they are not interchangeable with this delivery-only integration. Before funding/testing, confirm this exact template API is available to the account. If the account exposes only the older key-in-URL API or a different response contract, obtain the account's official API reference and update/test the adapter; do not silently fall back or generate a different OTP. API acceptance is not proof of handset delivery.

Setup sequence:

1. Create/configure a 2Factor account, activate the supplied-code template route, obtain test credits and an approved NearHire verification template with one OTP variable. Obtain the template name. Confirm India DLT entity, sender/header and template requirements with 2Factor before production; production DLT go-live is a separate task. Keep the message transactional and minimal, without marketing.
2. Apply only the new `supabase/migrations/202609150001_sms_hook_guard.sql` through `npx supabase db push --linked`, after inspecting `npx supabase migration list --linked`. Confirm the linked project before deploying; never rerun older migrations manually.
3. In Supabase secure Edge settings configure:
   - TWOFACTOR_API_KEY: actual account API key.
   - TWOFACTOR_TEMPLATE_NAME: the approved supplied-code template name.
   - SEND_SMS_HOOK_SECRET: matching Supabase-generated Standard Webhooks signing secret, including its `v1,whsec_` prefix.
   - SMS_RECIPIENT_HASH_SECRET: independently generated cryptographic random secret, at least 32 characters, used only for recipient HMAC pseudonyms. Do not reuse the API key.
     Use secure external files or the dashboard. No real values belong in docs or the repository.
4. Deploy `npx supabase functions deploy send-sms --project-ref mxsltkyebhboaglbspse`. JWT verification is disabled only because this endpoint validates Standard Webhooks signatures instead. Unsigned public/anon calls must fail before any reservation/provider call.
5. Configure Authentication → Hooks → Send SMS HTTP endpoint as `https://mxsltkyebhboaglbspse.supabase.co/functions/v1/send-sms`, with its matching hook secret. Deploy the function and reservation migration before activating the hook.
6. Enable Phone signup/confirmation for the controlled test only after credentials and the hook are ready. Set six digits, 300-second expiry and at least 60 seconds between sends. Configure the hosted SMS and verification/IP limits conservatively; local config.toml is not an automatic hosted update. Remove any fixed test OTPs from hosted settings. Do not copy local test_otp fixtures into the hosted project.
7. Authorize one destination phone, send once, enter the received code, and confirm a genuine session. A success response from the mocked provider is not a delivery test. Do not automatically retry real SMS while debugging.

The hook signature verifier checks integrity/timestamp. Durable reservations prevent replay across Edge instances, using event ID and a secret-keyed recipient HMAC. A global lock enforces 60 seconds per recipient, 5 attempts per recipient per hour, and 60 attempts globally per hour (conservative development budget). Only service_role can execute these delivery RPCs. No OTP, raw phone or request body is stored. Old reservation rows are removed on the next reservation after 24 hours; during inactivity they remain until the next request. A provider timeout or ambiguous result leaves a pending reservation so the same event cannot send twice. The user waits and starts a fresh Supabase OTP request. Completed replay returns success without another send. These safeguards complement, not replace, Supabase's IP/verification limits. A production CAPTCHA flow, provider spend cap and production limits must be reviewed before public SMS activation.

Provider requests put credentials/OTP in headers/body, never URL paths; redirects are rejected and timeout is two seconds. HTTP failures, malformed responses and network errors are converted to generic hook errors without logging provider payloads. Hook timeout includes reservation and completion RPCs; measure cold-start latency during controlled testing.

References: [Send SMS Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook), [hook signatures/security](https://supabase.com/docs/guides/auth/auth-hooks), [phone updates](https://supabase.com/docs/reference/javascript/auth-updateuser), [OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp).

## Sessions, logout, payment and deletion

Both providers use the existing Supabase session; valid stored sessions enter their previous workspace. Native SecureStore stays device-only, foreground refresh uses processLock, and boot has retry handling. Web sessions remain tab-scoped. Logout drains token-registration work, unregisters the device while authenticated, signs out locally, clears pending OAuth/device state and user query caches, then returns to login. Cleanup failure remains retryable; logout does not unlink identities. Account deletion/financial retention and admin MFA are unchanged. Payment-order/payment-verify and credit/publish RPCs still validate the same Supabase user UUID. Razorpay remains TEST; real money is not enabled.

## Validation and real-device procedure

Repository checks: `npm run check`, `npm run lint`, `npm test`, `npm run test:db`, `npm run build`. Edge: `npx deno test --config supabase/functions/deno.json --allow-env supabase/functions/_shared supabase/functions/location/provider_test.ts supabase/functions/send-sms/handler_test.ts`; typecheck all seven function entrypoints with `npx deno check --config supabase/functions/deno.json`.

The existing Android build does not include the new native browser module. After approval for a new development APK, build the existing EAS development profile, install it, and run from apps/mobile:

```powershell
.\scripts\start-payment-test.ps1
```

This existing launcher loads public map/Firebase settings externally and starts `expo start --dev-client --lan --port 8094`, with real Supabase authentication and only the gated DEV payment-test email option. No Google or 2Factor private credentials are needed in the app. For consumer-only testing set EXPO_PUBLIC_PAYMENT_TEST_AUTH=false before starting Expo instead. Never use Expo Go as proof of native integration.

Controlled checklist (all real-provider/device items remain NOT RUN until configured):

- New Google user: sign in; confirm same returned Auth UUID in profile/worker/wallet and exactly 10+2 initial credits. Complete profile and choose workspace.
- Log out and repeat Google: same UUID/history/ledger; no extra grants. Cancel Google account selection; simulate no network and misconfigured provider/redirect; no raw internals or stuck loading.
- New Phone user: one authorized SMS; correct six-digit code creates genuine session. Repeat login preserves UUID. Wrong/expired code, resend before/after 60 seconds, rate limit, provider outage and no network show retryable errors without duplicate sends.
- Google-first → Verify Phone: prove phone ownership and unchanged UUID/wallet/ledger. Phone-first → Link Google: prove Google ownership and unchanged UUID/wallet/ledger. Attempt an already-owned identity; expect rejection, never a merge.
- Both methods: close/reopen app, refresh, switch Find/Post workspaces, logout/login and device-token cleanup. Repeat in Tamil and English.
- With each provider's real session, exercise TEST payment order/verification and publish against normal RLS. Check +1 purchase and monthly-first -1 publish exactly once. Do not fabricate capture/webhook success.
- Verify FCM registration and a real push separately. No phone OTP or FCM delivery claim follows from automated tests.

Troubleshooting: provider_disabled requires provider configuration; redirect_mismatch requires the Google Supabase callback and Supabase app allowlist; manual_linking_disabled requires manual linking enabled; identity/phone conflict means return to the original account; PKCE failure means retry in the original tab/device before the ten-minute pending window expires. SMS failures require verifying template API entitlement, funds, DLT/test route, signing secret, deployed migration and server rate limits. Inspect only sanitized error codes; never print bodies, tokens or OTPs.
