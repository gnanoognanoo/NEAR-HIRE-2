# NearHire authentication

Reviewed 14 September 2026. **Supabase Auth retained; Firebase is FCM only.**

## Current status

Linked project `mxsltkyebhboaglbspse`: public Auth settings confirm **Phone disabled**. Dashboard is signed out, so private OTP/rate settings are unverified. No SMS provider account/configuration was changed. Real SMS and physical Android tests remain pending. No APK built in this task.

## Architecture

English/Tamil language → phone → signInWithOtp → six-digit verifyOtp(type: sms) → genuine Supabase session → incomplete profile setup or completed-profile workspace. India is default; libphonenumber converts 9876543210 to +919876543210 and supports international mobile numbers. Invalid/landline inputs are rejected.

`auth-operations.ts` contains the production transport boundary, injected with Supabase by `services.ts` and with responses by tests. Only Supabase verifies codes. The shared gate prevents overlap and reserves 60 seconds between sends, including ambiguous network failures. UI clears codes after verification attempts and localizes provider, invalid/expired/used code, rate and network errors. No OTP bypass or token logging added.

Native SecureStore is device-only; web storage is tab-scoped sessionStorage. Supabase persists/refreshes sessions with processLock; AppState controls refresh, restoration has timeout/retry handling. Logout drains pending registration, unregisters the device while authenticated, signs out locally, then clears its token. Failures remain retryable. Auth state changes clear queries, user screen state and subscriptions. Profile data is not deleted.

Identity remains Supabase UUID → profiles.id → auth.uid/RLS/private.actor and all job/application/payment/ledger ownership. Existing signup trigger provisions profile, worker profile, credit account and **10 welcome credits plus 2 current-month credits** (see [Credit V2](credits.md)). Signup reference uniqueness and `welcome_once` prevent repeat awards. Supabase identity is unchanged; the subsequent credit migration is documented in credits.md.

## SMS provider decision

Recommendation: **Twilio Messaging**, conditional on provider confirmation of the eligible India route, DLT setup and cost. It fits the built-in Supabase integration and allows Supabase-owned 300-second OTP expiry. This is an integration recommendation, not a measured delivery reliability ranking. Pilot across Jio/Airtel/Vi before production.

Supabase documents Twilio, MessageBird, Vonage and community-supported Textlocal. This is the documented product support list; the signed-out project's dropdown was not inspected. [Supabase phone login](https://supabase.com/docs/guides/auth/phone-login).

| Provider         | India/setup                                                                                                                                           | Testing/pricing                                                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Twilio Messaging | Built-in; domestic route requires DLT company/sender registration. Confirm route/template eligibility before funding.                                 | Delivery diagnostics; per-segment route price, retries, sender charges and taxes. Obtain account quote from current rate card. |
| Twilio Verify    | Managed verification adds service setup and separate token policy.                                                                                    | Default 10-minute validity; 5 minutes requires Support. Verification fee plus SMS price. Less direct fit for requested expiry. |
| MessageBird/Bird | Built-in legacy adapter; confirm new account has compatible SMS API and India DLT route.                                                              | Delivery reporting; route/volume quote required; real carrier pilot required.                                                  |
| Vonage           | Built-in, but India guidance supports international enterprise traffic only. Not first choice for domestic NearHire without eligibility confirmation. | Destination pricing; confirm restrictions and permitted test recipients.                                                       |
| Textlocal        | Community-supported; confirm current API/account availability, DLT sender/template and support.                                                       | Test mode does not transmit SMS. Obtain current domestic quote; current numeric tariff not independently verified.             |

Do not use international routing to evade domestic requirements. SMS delivery reports do not prove receipt/verification. Tamil SMS may cost multiple segments; UI translation does not translate the hosted SMS template automatically. Dynamic/route-specific price pages did not establish a reliable comparable numeric India quote; no price is invented.

Sources: [Twilio India](https://www.twilio.com/en-us/guidelines/in/sms), [Twilio pricing](https://www.twilio.com/en-us/sms/pricing/in), [Verify pricing](https://www.twilio.com/en-us/verify/pricing), [Verify validity](https://www.twilio.com/docs/verify/api/rate-limits-and-timeouts), [Bird India](https://docs.bird.com/connectivity-platform/country-restrictions-and-regulations/india), [Bird pricing](https://bird.com/en/pricing/sms), [Vonage India](https://api.support.vonage.com/hc/en-us/articles/204017423-India-SMS-Features-and-Restrictions), [Vonage pricing](https://www.vonage.com/communications-apis/messages/pricing/), [Textlocal tests](https://api.textlocal.in/docs/bulkxml).

## External setup: approval and credentials required

1. Approve provider selection; complete business verification, route eligibility, billing and applicable India DLT entity/header/template registration and provider mapping. Obtain a route quote before funding.
2. For Twilio Messaging prepare Account SID, Auth Token and approved Message Service SID/sender service. Store securely outside Git. These are **Supabase Auth provider settings**, not ordinary Edge Function secrets and never EXPO_PUBLIC values.
3. Supabase project → Authentication → Sign In / Providers → Phone: choose Twilio and enter the SID/token/service fields after approval. Ensure the service uses the approved India sender/route. Match SMS text exactly to the approved template, retaining `{{ .Code }}` substitution. Enable Phone only after approved configuration.
4. Set/read back OTP length **6**, expiry **300 seconds**, SMS minimum frequency **60 seconds**. These are targets, not verified hosted values. Leave test-phone/OTP bypass mappings empty. Local config does not change hosted settings automatically.
5. Authentication → Rate Limits: suggested controlled-pilot budget **30 SMS/hour project-wide**, retaining stricter existing limits, platform verification/IP protections and per-recipient 60-second throttle. Record prior values, never weaken them for tests. Review capacity and spend before production traffic. Add provider spend alerts. See [Supabase limits](https://supabase.com/docs/guides/auth/rate-limits).
6. Preserve existing CAPTCHA protections. The current phone form does not supply a CAPTCHA token; if hosted CAPTCHA is enabled, integrate/test its challenge before rollout, never disable it to pass tests.
7. Record redacted saved settings and test on authorized phones. No provider secrets, service-role key, refresh token or Firebase private key may enter mobile public config.

## Android commands and A–J checklist

Use existing development APK, package `app.nearhire.mobile`, build `f63aeda2-8093-4ee3-9aff-e5c9e33ab74f`:
https://expo.dev/accounts/gnanoos-team/projects/nearhire/builds/f63aeda2-8093-4ee3-9aff-e5c9e33ab74f

No native dependency changed; reuse this development client, not Expo Go. Stop an old Metro instance on 8094 first. Keep phone/PC on the same Wi-Fi with Windows firewall permitting Metro.

```powershell
Set-Location 'C:\PROJECTS\NEAR HIRE\apps\mobile'
$env:EXPO_PUBLIC_DEMO_MODE = 'false'
$env:EXPO_PUBLIC_UI_PREVIEW = 'false'
$env:EXPO_PUBLIC_PAYMENT_TEST_AUTH = 'false'
# Keep existing public map/Firebase config loaded securely; never echo values.
npx expo start --dev-client --lan --port 8094 --clear
```

Existing ignored mobile .env supplies public Supabase values. Scan Metro QR in the installed development client. Do not use start-payment-test.ps1 for OTP testing: it explicitly enables the separate DEV email-test login. Do not run eas init/build.

| Test             | Required result                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| A Correct OTP    | Actual SMS arrives; successful verification yields genuine session/profile.                                           |
| B Incorrect/used | Safe error, no new session; successfully consumed code cannot be reused.                                              |
| C Expired        | Wait beyond confirmed hosted expiry; reject then allow resend.                                                        |
| D Resend         | 60-second timer, one request, repeated taps cannot duplicate.                                                         |
| E Rate limit     | Controlled rejection/recovery without flooding or raising limits.                                                     |
| F Close/reopen   | Force-close/reopen preserves identity; repeat after access-token expiry to test refresh.                              |
| G Logout/login   | Device unregistered, caches/subscriptions cleared, auth returns; re-login same UUID.                                  |
| H New user       | Profile/worker/credit account once; setup routing; welcome award 10 exactly once and monthly award 2 once per period. |
| I Existing user  | Workspace routing; logout/login, refresh, resend and profile edit add no credits.                                     |
| J Offline        | Send/verify/restore/logout show retryable errors, never false success.                                                |

Repeat in English/Tamil. Record redacted IDs/statuses only, never OTPs or tokens. After genuine phone login, validate TEST payment-order/payment-verify ownership, credit reads and publish_job with an authorized test draft; no live money. Existing genuine email-session tests support shared identity compatibility, but **phone-issued session payment compatibility remains pending**.

## Troubleshooting and evidence limits

Provider unavailable: verify Phone switch, credentials/service mapping, activation/balance, destination permissions and DLT template/route. Accepted send without delivery: inspect private provider delivery diagnostics, carrier rejection and template match; do not flood resend. Invalid/expired/used: request fresh code for same normalized number; Supabase may use the same error for invalid/expired codes. Rate limits: server window can exceed client cooldown. Restoration: check connectivity, secure storage, revocation/refresh expiry and retry. Logout: restore connectivity to finish authenticated cleanup; never claim success after failure. Credit discrepancy: audit UUID/trigger/ledger, never award from the client.

Unit tests cover the shared production transport with injected results, normalization, duplicate gate, cooldown, error mapping, restoration/routing and ordered logout. DB tests execute migrations/PostGIS with emulated Supabase platform primitives and verify provisioning plus duplicate ledger rejection through repeated authenticated operations/profile edits. These are not hosted SMS, token issuance or physical storage tests. Run root `npm run check`, `npm run lint`, `npm test`, `npm run test:db` and secret scan.
