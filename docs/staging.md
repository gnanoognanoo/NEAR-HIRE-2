# NearHire isolated staging — 27 October 2026

## Current status

**Staging setup and hosted marketplace API tests: PASS. Real SMS/phone OTP: BLOCKED pending provider account inspection. Beta readiness: PARTIAL.**

| Setting | Verified value |
| --- | --- |
| Organization | GNANOO (`aisvkpzhmksmtamgqvjq`) |
| Project | `nearhire-staging` |
| Reference | `jovdckzwiprxjxtmogqk` |
| Region | Mumbai, `ap-south-1` |
| Health | ACTIVE_HEALTHY |
| API | `https://jovdckzwiprxjxtmogqk.supabase.co` |
| SMS hook | `https://jovdckzwiprxjxtmogqk.supabase.co/functions/v1/send-sms` |
| Phone Auth / automatic confirmation | Enabled / OFF |
| OTP | Six digits; 300-second expiry; minimum 60-second resend interval |
| Hosted limits | `rate_limit_sms_sent=10`, `rate_limit_verify=30` (project SMS/hour and verification/IP token-bucket settings) |
| Fixed hosted test OTPs | None |
| Payments | Live OFF; TEST purchases also OFF in staging |
| Geocoder | Disabled provider; GPS/manual selection and keyless OpenFreeMap remain available |
| Current SMS delivery | **PAUSED** (`SMS_DELIVERY_ENABLED=false`) after unexpected voice delivery |
| Native APK | Existing development build reused; no new APK |

Only one staging project was created. The interrupted creation completed under “NearHire Staging”; that same project was renamed, rather than creating a duplicate. Supabase quoted $0/month on the current Free organization. No unrelated project was changed or resumed.

## Production isolation

Production remains `mxsltkyebhboaglbspse`. The root checkout's `supabase/.temp/project-ref` still points there; it was **not relinked**. Staging migrations ran from a separate external deployment directory with an explicit staging project reference. Every management write was guarded to staging. Separate Supabase database/Auth/project keys and independent cryptographic hook/recipient-HMAC secrets were generated. No production accounts, jobs, credentials, Auth settings, functions or migrations were changed.

Read-only hashes of production Auth configuration, deployed function metadata and migration history were compared before/after: **all unchanged**. This is configuration-isolation evidence, not a claim to have inspected every production data row.

All 13 original migration versions were applied in filename order through normal `supabase db push`, followed by the synthetic category seed. This includes **`20261027134512_marketplace_repost_compatibility.sql`**. Hosted migration history and a subsequent dry run agree: **up to date, no pending migrations in staging**. The repost migration remains intentionally unapplied to production.

## 2Factor delivery implementation and observed blocker

Supabase creates the OTP and verifies it with `verifyOtp({ phone, token, type: 'sms' })`; 2Factor is delivery-only. The Edge Function verifies the Standard Webhooks raw-body signature/timestamp before handling the recipient/code. Real Supabase hook attempts reached the reservation/provider boundary, proving the Auth-to-hook signature path works. Separate hosted probes returned unsigned 401, tampered 401 and correctly signed invalid payload 400, without sending SMS.

The adapter supports two explicitly selected account contracts. There is **no automatic fallback or second send**:

- `template-json`: the provider's public JSON example, POST `/API/V1/OTP/SEND`, `X-API-Key` and `{to,template_name,var1}`. The actual staging request returned **HTTP 404**. It is not a working route for this setup.
- `manual-otp`: the provider's detailed manual-code reference uses **POST** `/API/V1/{key}/SMS/{phone}/{supabase_otp}/{template}`. The supplied Supabase OTP is passed verbatim. Only HTTP success plus `Status: Success` and a nonempty `Details` acknowledgement counts as accepted. No provider generation or verification endpoint is called. This is the currently selected staging mode.

A manual-route GET attempt ended with an unconfirmed provider result and left its reservation pending; the owner reported receiving a **call instead of an SMS**. The detailed reference was then checked, the method corrected to POST, tested and deployed. **No further real delivery was attempted after the call.** Delivery is paused pending read-only account inspection of the SMS route, balance, template/sender mapping and possible voice fallback. The call does not prove SMS delivery or successful Supabase OTP verification. A read-only transactional-balance endpoint accepted the API credential; that does not establish SMS-OTP entitlement, SMS balance or template readiness. Do not keep retrying or change shared account-wide fallback settings without checking their production impact.

The approved values supplied by the owner are template **NearHireOTP**, sender **NEARHR**, one OTP variable. Sender mapping belongs to the approved provider template; an unsupported sender field is not invented in API requests. Portal approval/balance/fallback have not been independently rechecked because the existing 2Factor tab requires sign-in.

The manual route necessarily includes sensitive data in its HTTPS path as specified by the provider. The request URL is constructed only inside the server handler, with redirects refused, cache disabled, no referrer and a bounded two-second provider timeout. Never add outbound URL/request-body tracing. Exceptions and provider bodies are never logged or returned. Operator diagnostics contain only fixed category codes and numeric HTTP status. Successful completion is recorded only after provider acceptance. Timeout/ambiguous reservations remain pending to prevent duplicate sends. Supabase's five-second HTTP-hook budget must be respected; increasing a timeout past that budget is not a fix for a slow provider route.

The durable server guard retains 60 seconds per recipient, 5 attempts/recipient/hour and a global 60-attempt/hour ceiling. Only service-role code can reserve/complete deliveries; rows contain event IDs and secret-keyed recipient hashes, never OTPs or raw phone numbers. These controls complement hosted Auth limits and the app's cooldown. Staging additionally requires an allowlist, currently restricted to the one owner-authorized recipient held outside Git. The kill switch blocks all sends until deliberately re-enabled after provider review.

## External configuration and commands

Generated/supplied files under `C:\PROJECTS\NEARHIRE-SECRETS`:

- `nearhire-staging.env`: staging reference/URL, public anon key and private server role key; server tooling only.
- `mobile-staging.env`: public staging values only; demo/gallery/alternate-test-login flags false.
- `send-sms-staging.env`: provider key, approved template, `TWOFACTOR_API_MODE=manual-otp`, fresh signing/HMAC secrets, staging environment, recipient allowlist and paused delivery switch.
- `staging-test.env`: owner-authorized destination; never print or commit it.
- `staging-marketplace-<run-id>.json`: random staging account passwords/IDs from the test runner; private and outside Git.

No credential or real phone value belongs in source, examples, logs, screenshots or reports. The existing provider key was reused securely; its account settings/credential were not altered. Production Supabase keys were not reused for staging.

```powershell
cd 'C:\PROJECTS\NEAR HIRE'
npm run start:staging
# Guarded Metro on 8082, only the staging URL/key; dotenv disabled in that child.
# Use the existing development APK, not Expo Go or a new EAS project.

# Explicitly opt in to a NEW synthetic hosted run; creates three staging Auth accounts.
node scripts/test-staging-marketplace.cjs --run --env-file 'C:\PROJECTS\NEARHIRE-SECRETS\nearhire-staging.env'

# Subsequent staged function deployments must always name staging explicitly.
npx supabase functions deploy send-sms location --project-ref jovdckzwiprxjxtmogqk --use-api
```

The launcher checks the exact staging URL, validates a legacy public key's role/project, rejects privileged keys and fixture/alternate-login flags, and exposes only an allowlist of public variables from the file. A development-only STAGING banner identifies the environment. Production settings and its running configuration file are left alone. Do not use a bare linked `db push` for staging from the production-linked checkout. Future migration deployment should repeat the external staging-directory workflow and inspect a staging-targeted dry run first; never repair/rewrite migration history to hide a failed deployment.

## Real hosted marketplace results — 20 checks PASS

The runner used two normal authenticated actors (employer/worker) and a third normal observer for negative authorization tests. These are explicitly synthetic email accounts provisioned with Admin SDK and confirmed email solely for staging, then signed in through `signInWithPassword`. Their business operations use public client keys and real Auth JWTs through PostgREST/RPCs, with RLS enabled. No JWT was forged, no `auth.uid()` setting was overridden and no production identity was reused. This verifies real password-based staging sessions, **not phone ownership or SMS login**.

For residential and business independently: create/publish/My Posts; exact one-credit debit and repeated publication; PostGIS discovery; private-row/profile isolation; self/duplicate application rejection; pending contact denial; unauthorized acceptance denial; capacity enforcement; exact coordinate/private-address unlock for accepted participants; filled-job exclusion; employer start; mutual completion; both reviews; duplicate/outsider review rejection; expiry rejection before cron; hosted expiry execution; timed repost preserving location/urgency/time/history and one debit on stable-request retry. Synthetic email actors have no verified phone, so a real phone-number contact unlock still awaits phone verification.

The expiry test first verifies an exact 86,400-second lifetime, then advances **only that run's synthetic staging job** to the expiry boundary using trusted tooling. It calls the real hosted expiry function and verifies API exclusion/rejection. This is not an actual 24-hour handset soak test. No production timestamp was edited.

Purchases were disabled throughout; only normal 10 welcome + 2 monthly grants funded posting. A separate authenticated call with the correct `prepare_payment(p_package,p_request_id)` signature explicitly returned `PAYMENTS_DISABLED`, with no payment created. Returning password login preserved UUID, wallet and single welcome/monthly grants. No fake payment capture/confirmation funded the tests.

## Validation, device scope and remaining actions

TypeScript (mobile/admin), ESLint, 145 mobile tests, 9 localization/workflow tests, 81 local PostGIS scenarios, **36 Edge tests**, strict checks of all seven Edge entrypoints, web/admin builds, Android/Hermes export and secret scans passed. Hosted marketplace results above are additional to those local tests. CI now includes all SMS-hook and payment Edge tests, which were previously omitted.

The existing vivo V2204 development APK connected to staging Metro and rendered the real unauthenticated phone UI. It submitted the controlled delivery attempts; no phone session was established. Existing `sms-otp`/`oneTimeCode` autofill hints were retained and `importantForAutofill=yes` added. Actual Android SMS autofill is unverified because successful SMS delivery was not demonstrated. HTTP 503 hook failures now show provider-unavailable guidance rather than incorrectly claiming the phone has no network.

Remaining: sign in to the existing 2Factor tab for read-only SMS-route/balance/template/fallback inspection; establish a working SMS-only route with acceptable hook latency; deliberately re-enable only the allowlisted staging recipient; request one fresh code and have the owner enter it in the app. Then verify new/returning phone provisioning, +10/+2 once, wrong/expired codes, resend/rate limits, logout/relogin, SecureStore restoration and English/Tamil on-device behavior. Do not use a call as proof of SMS delivery, read/log OTPs, enable fixed test OTPs, or modify shared provider settings silently. Full physical two-party marketplace testing remains pending despite the hosted API pass.

Advisors still flag the intentional authenticated `SECURITY DEFINER` API surface and default-deny internal event tables; negative RLS tests passed and no grants were relaxed. Leaked-password protection is an external review item for password-based accounts. See [RPC advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

References verified: [Supabase SMS hook](https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook), [hook security/time budget](https://supabase.com/docs/guides/auth/auth-hooks), [Auth limits](https://supabase.com/docs/guides/auth/rate-limits), [2Factor manual-code POST reference](https://2factor.in/API/DOCS/SMS_OTP.html), [approved custom-template syntax](https://dial2verify.com/corp/support-system/tkt/knowledgebase.php?article=21), [advertised JSON example](https://2factor.in/v4/services/bulk-sms-api.html). Published examples were tested against the account rather than assumed operational.
