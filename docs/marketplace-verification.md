# Task 4 marketplace verification — 27 October 2026

> Follow-up: [isolated staging](staging.md) has now been created, all 13 migrations deployed and 20 real authenticated hosted marketplace checks passed. The earlier blocker/results below are retained as the pre-staging record. Real phone OTP and full physical two-party testing remain pending; production was not deployed.

**PARTIAL: automated lifecycle verification passed; hosted two-party and physical end-to-end verification is BLOCKED by the absence of an isolated staging environment and its authenticated employer/worker accounts.** No production marketplace records were created or changed. No production deployment, OTA publication, payment, APK build or authentication bypass was performed.

## Environments and evidence

- Repository base: `e17e31f`, following the provider-independent location implementation `6ca3db9`.
- Supabase `mxsltkyebhboaglbspse` is the only active NearHire project. Project/branch inventory returned no NearHire staging project or development branch. Unrelated inactive projects were not used or modified.
- Existing designated test credentials supported normal Supabase password sign-in for read-only checks on the live project. No second marketplace account was created. Tokens and account details were held in memory, never printed; only the newly created test session was signed out.
- Disposable PGlite/PostGIS applied every repository migration and enforced the actual business SQL, grants and RLS. Auth identities and cron registration are test shims. These are **local database integration tests**, not genuine hosted authentication or PostgREST/concurrency tests.
- Phone: existing vivo V2204, Android 12, development APK `ac22ccd3-3c58-4f70-a26b-bff9515f3f02`, package `app.nearhire.mobile`. USB reverse and a real Metro inspector target on port 8081 were verified. Native source/runtime remains unchanged; current JavaScript loaded through Fast Refresh.

## Workflow results

PASS below applies only to the named scope. BLOCKED does not mean a failing implementation has been proven.

| Major workflow | Local database/integration | Hosted end-to-end | Physical end-to-end |
| --- | --- | --- | --- |
| Residential draft and publication | PASS: persisted GPS/manual point, My Posts, one-credit debit, retry and 24-hour lifetime | BLOCKED: isolated staging unavailable | BLOCKED: form rendering only passed |
| Business draft and publication | PASS: separate business/category payload and full lifecycle | BLOCKED | BLOCKED: business form rendering only passed |
| Nearby discovery through PostGIS | PASS: kind/radius filtering, correct stored point, no exact address/phone leakage | BLOCKED for newly published test jobs | BLOCKED for a newly published test job; earlier native map/GPS test remains valid |
| Application rules | PASS: self, duplicate, filled, expired, suspended job/poster/worker and unrelated acceptance denied | BLOCKED | BLOCKED |
| Employer acceptance/capacity | PASS: authorized acceptance fills required capacity and removes filled job from discovery | BLOCKED | BLOCKED: Applicants screen rendering only passed |
| Contact and exact location unlocking | PASS: pending/outsider denied; accepted participants receive exact selected coordinates/contact | BLOCKED | BLOCKED: no accepted staging relationship available to render the new private map |
| Start and completion | PASS: valid employer start; both participant confirmations; invalid actors/transitions denied; repeated completion does not duplicate notifications | BLOCKED | BLOCKED |
| Reviews by both participants | PASS: completion required, both subject mappings correct, rating bounds, duplicate and outsider reviews denied | BLOCKED | BLOCKED |
| 24-hour expiry | PASS: exact boundary hidden and cannot apply/accept before cron; expiry is idempotent | PASS for scheduler configuration/recent execution only; a real 24-hour test job was not created | BLOCKED for a real aged job |
| Repost | PASS after local migration: same selected point, kind, urgency/time/history, fresh 24 hours, stable-request debit once; unauthorized/colliding requests rejected | FAIL for the existing timed-repost implementation by source parity and isolated reproduction; fix NOT DEPLOYED | BLOCKED pending migration/staging |
| Credit entitlements while purchases disabled | PASS: both complete lifecycles use normal welcome/monthly grants with local payment flags off; no payment settlement funds these fixtures | BLOCKED for hosted publication/debits | BLOCKED for actual publication |

Existing regression coverage also verifies insufficient-credit publication/repost rollback, immutable/owned ledgers and purchased-credit entitlements. The lifecycle fixture never fakes a payment confirmation. Separate pre-existing payment regression tests use isolated SQL fixtures; no provider checkout or hosted payment was performed.

## Confirmed defects and fixes

1. **Timed repost fails `INVALID_TIME`.** The old `repost_job` passed `to_jsonb(j)` directly to `create_job`. SQL `time` serializes as `09:30:00`, while strict create validation expects `09:30`. The new residential lifecycle test failed at that call before the fix. Hosted function-body hashes match the old source for all 13 reviewed marketplace functions, so this is also present in the deployed implementation. The new migration formats the repost time as `HH24:MI`, preserving the original job fields/location and using the existing atomic credit-backed publication.
2. **Interrupted repost could create a second job on retry.** The activity screen generated a new request UUID for every confirmation. It now persists the request per account/source job before calling the backend, shares simultaneous requests and retains it after an ambiguous failure/restart. Success clears it; no passwords, tokens or locations are stored in this recovery record. The backend additionally rejects reuse of a request belonging to another source job instead of changing an unrelated `repost_of` link.
3. **Expired, partly staffed jobs lacked a UI path to start/completion.** Existing `fill_job` supports expired jobs with an accepted worker, but the UI hid the action after the expiry timestamp. My Posts now keeps the action for active/expired states; server ownership, accepted-worker and transition checks remain authoritative. Both residential/business integration scenarios prove fill → start → mutual completion after expiry.
4. **GPS-only jobs unlocked coordinates on the server but omitted them from the contact UI.** The modal showed only phone/address; a legitimately empty street address left no usable work-location map. It now renders the existing read-only MapLibre map from validated coordinates returned by the authorized `private_contact` RPC. No fallback point, public-list coordinate, extra geocoding or new provider is used. English/Tamil privacy text was added. Phone rendering with an accepted staging application remains unverified.

## Hosted read-only checks — 10/10 PASS

Normal existing-account authentication; own profile readable; foreign profiles hidden; foreign raw job rows hidden; own My Posts, Applications and Applicants API reads; both category kinds readable; unknown private-contact request denied; anonymous activity RPC denied. No lifecycle write RPC was called on the live project.

Catalog inspection confirmed RLS on `profiles`, `jobs`, `job_locations`, `applications`, `reviews`, `job_credits` and `credit_transactions`. All 13 reviewed function bodies matched the pre-fix migrations; anonymous execution is revoked and authenticated grants match the intended API (`expire_jobs` is server-only). This comparison establishes source parity, not a hosted mutation/concurrency test.

`nearhire-expire` is active once per minute. Its latest observed successful execution was **27 October 2026, 19:19 IST**, with zero recorded failed runs in the previous 24 hours. No job timestamps were altered in the hosted database. Live payments remain disabled; the existing Razorpay TEST flag remains enabled and was not changed. Payment-disabled lifecycle verification ran only in the disposable database.

Security advisors report the existing signed-in `SECURITY DEFINER` API warnings and leaked-password protection disabled. The reviewed marketplace RPCs intentionally mediate writes using `private.actor()` plus ownership/state checks, with anonymous access revoked; no grants or RLS were relaxed. Internal audit/event tables intentionally retain default-deny policies. Password-auth protection remains an external security review item; no Auth settings were changed. See [RPC advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Validation

- TypeScript (mobile/admin): PASS.
- ESLint: PASS.
- Mobile tests: 145 PASS, including new recovery/action/private-point tests and existing auth, OTP, posting, payment, navigation and location regressions.
- Localization/update-workflow tests: 8 PASS; English/Tamil key parity and referenced keys checked.
- Database/PostGIS: 81 PASS (63 existing plus 18 separate residential/business lifecycle scenarios).
- Hosted read-only checks: 10 PASS; not counted as full E2E workflows.
- Android/Hermes export and source/exported-bundle secret scan: PASS; no native change or APK build.
- External private-value comparison: PASS; no matching supplied private credentials in source.
- Physical safe smoke: My Posts and Applicants rendered, residential/business forms rendered separately, development client remained connected; zero matching app-process JS/native runtime error lines observed. No job/application/review/payment was submitted on the phone.

Run local validation with `npm run check`, `npm run lint`, `npm test`, `npm run test:db`, `npm run export:android`, then `node scripts/scan-update.cjs`. `npm run test:db` creates only its in-memory disposable database, never a hosted connection.

## Required before real-world beta

1. Supply/provision a dedicated NearHire staging project or branch and legitimate employer/worker test accounts through ordinary Auth. Configure the development client’s Metro environment for staging without copying private credentials into public variables. No new native module is needed.
2. Apply migrations through the normal workflow in staging, including **`20261027134512_marketplace_repost_compatibility.sql`**. This migration only replaces `repost_job`; tables, RLS, identity architecture and payment settings remain unchanged. It is intentionally **not deployed to the live project**, in accordance with this task’s no-production-publication instruction.
3. Run both kinds of job through actual authenticated publication, nearby discovery, applications, acceptance, private-map/contact unlocking, both completion confirmations, reviews and repost. Include two real client sessions, network interruption, competing acceptances, process restart and delayed responses. Test an expiry boundary/aged fixture only in staging, then observe the real scheduler.
4. Repeat the workflow on the existing Android development build and visually verify the new private location map and expired-job action in English/Tamil. A compatible JS update suffices; no new APK is required by these changes. Promote the migration/UI only after staging verification and explicit production release authorization.

Optional Ola address lookup remains disabled because its credentials were rejected. This does not block GPS/manual job locations, MapLibre/OpenFreeMap or PostGIS. Existing Supabase Auth, Firebase/FCM and Razorpay TEST integration were preserved; no new end-to-end success is claimed for those unrelated services.
