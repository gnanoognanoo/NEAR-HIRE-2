# NearHire Job Credits — Razorpay test integration

## Architecture and current state

Workers do not pay to create a profile, search or apply. Posting costs one credit using the existing transactional `publish_job` RPC; repost creates a new job, preserves the old record and spends one credit. The auth-user creation trigger awards five starter credits once per account. `signup:<user-id>` and a partial unique index prevent duplicate awards. Login, reinstall, profile edits and workspace changes do not grant credits. Account recreation eligibility/anti-abuse is a separate policy from same-account idempotency.

Existing infrastructure was extended, not replaced: `credit_packages`, `job_credits`, `credit_transactions`, `payment_orders`, `payments`, `payment_events`, `prepare_payment`, `settle_payment`, native `react-native-razorpay`, and the admin dashboard. Migration `202609130001_test_payments.sql` replaces launch catalog values, adds server test configuration, refund event recording and accounting retention. Historical orders keep their snapshotted prices and credit counts.

| ID | Credits | Amount in paise | Label |
|---|---:|---:|---|
| single | 1 | 900 | Occasional Hiring |
| five | 5 | 3900 | Popular |
| ten | 10 | 6900 | Best Value |

All prices are INR. Savings are calculated from the active single-credit price: ₹6 for five and ₹21 for ten at launch. Live UI reads the catalog from the server; development fixtures are separate and never used for settlement. Old packages are inactive rather than deleted.

`job_credits.balance` is a transactional cache of ledger deltas. Clients have no write authority to credit balances, ledger, payment statuses, provider IDs or package prices. RLS restricts user reads. Admin payment orders include account, package, amount, credits, both provider IDs, status and timestamp; search `paid`, `failed`, `created`, `pending`, or `refunded` to inspect statuses. Credit transactions remain separately visible. There was no admin credit-adjustment feature to preserve; no unlogged balance-edit UI was added.

## Secure request flow

1. `payment-order` authenticates the user, requires `PAYMENTS_ENABLED=true`, and rejects any key ID that does not begin with `rzp_test_`. `prepare_payment` independently checks the server's `payment_config.payments_enabled_test` flag. `live_enabled` has a database constraint requiring false.
2. Client supplies only a package ID and a persisted idempotency request UUID. Amount, credit count and currency are read server-side. A request UUID cannot be reused for a different package. New orders are limited to ten per user/hour; idempotent retries reuse the order.
3. A compare-and-set reservation prevents competing external order creation. Ambiguous provider timeouts remain reserved, never automatically create another order. The receipt is the internal order UUID.
4. Native checkout receives only public key ID, provider order ID, amount and currency. Checkout returns payment ID, order ID and signature; it never changes the balance itself.
5. `payment-verify` loads the user's stored order under RLS, checks HMAC-SHA256 over stored order ID + `|` + payment ID, fetches the payment using server credentials, and requires captured status plus matching amount, currency and order before settlement.
6. `razorpay-webhook` verifies the exact raw body before parsing. `payment.captured` and `order.paid` share settlement. Provider event ID, payment ID, order ID and unique ledger reference prevent duplicate awards across client verification and webhooks.
7. `settle_payment` locks the order and atomically writes the payment, increments the balance, writes one purchase ledger entry and marks the order paid. Any failure rolls back everything. Closing the app does not stop webhook settlement. Reopening reads the server balance. Retrying a previously settled order returns its paid state without opening checkout again.

Native UI distinguishes order creation, checkout, verification, success, cancellation and unresolved failure. It polls server state after a pending verification. Cancellation/disconnection is not assumed to prove provider failure; users should refresh/retry the existing order before another purchase. The pending-job purchase modal keeps the underlying form mounted and returns to review; purchase never automatically publishes. Unsaved forms are not persisted across OS process termination.

## Credentials and hosted setup

Razorpay credentials were absent from the process, known external secrets folder and hosted secret-name listing during this task. **RAZORPAY TEST CREDENTIALS REQUIRED.** Do not claim real checkout, delivery or capture passed. No live money is enabled.

1. Sign in to Razorpay Dashboard and select **Test Mode**. Generate test API keys under **Account & Settings → API Keys** (dashboard navigation may be called Developers). Save the key ID and secret in an external file, e.g. `C:\PROJECTS\NEARHIRE-SECRETS\razorpay-test.env`. Do not commit it or paste secrets into chat/source.
2. That external file must define `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` and `PAYMENTS_ENABLED=true`. The API ID must be a test ID. Set a separate random webhook secret; it is not the API secret. No Razorpay secrets belong in `EXPO_PUBLIC_*`.
3. Configure Edge secrets with `npx supabase secrets set --project-ref mxsltkyebhboaglbspse --env-file C:\PROJECTS\NEARHIRE-SECRETS\razorpay-test.env`. Do not print file contents or CLI debug logs. Keep `payment_config.payments_enabled_test=true` and `live_enabled=false`.
4. Deploy `payment-order`, `payment-verify`, `razorpay-webhook` with `npx supabase functions deploy FUNCTION --project-ref mxsltkyebhboaglbspse`. JWT gateway verification is disabled in function config because order/verify perform explicit user authentication and webhook performs its own HMAC authentication.
5. In Razorpay Test Mode **Developers → Webhooks**, add `https://mxsltkyebhboaglbspse.supabase.co/functions/v1/razorpay-webhook`. Enter the same external webhook secret. Subscribe to `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`. Enable the webhook.
6. Configure automatic capture in **Account & Settings → Payment Capture**. Authorization alone earns no credits. Use Razorpay's current official test instruments, not real card/payment details.
7. Inspect function logs for safe event/status IDs. Never log request bodies, signatures, full provider payloads, card data or key secrets.

## Required native test checkout

APK build is paused until explicit owner approval. Web preview only displays payment UI; selecting a package and continuing does not create a Razorpay order or add credits.

Once an approved Android development app and hosted phone login are available:

- Sign in with a dedicated test account. To reach zero, publish five legitimate test listings or use a separately reviewed audited test fixture; do not silently edit production balances.
- Buy one credit for ₹9 using Razorpay Test Mode. Check order amount is 900 paise, capture/webhook succeeds, balance becomes one, and exactly one `purchase` +1 ledger row exists.
- Publish a reviewed test job. Verify balance zero and one `publish` −1 entry. Retry publication: no second deduction. Zero credit blocks another publication without losing the draft.
- Buy five credits for ₹39; exactly five are awarded, not amount divided by nine. Ten-credit ₹69 logic is covered by SQL integration tests; also exercise native checkout before release.
- Close the app during checkout after payment; confirm webhook settlement and correct balance after reopen. Repeat webhook delivery and verification: still one purchase entry.
- Cancel, fail, disconnect, provide an invalid signature in an isolated API test, and retry. No unverified payment may award credits. Test a pending authorization followed by capture.
- Expire a listing and repost after review; expect one credit deduction and a new 24-hour listing with the original history retained.

## Retention, refunds and reconciliation

Deleting a personal account detaches payment orders and ledger rows using nullable user references. Payments cannot be cascade-deleted by deleting their order. Order/payment IDs, amounts, timestamps and accounting references remain. Future settlement for a detached order retains a detached ledger entry but does not recreate a user balance. This is **retention implemented, duration/access/anonymization policy decision required**; no legal-compliance claim is made. Ledger metadata may include a public job title and historical reference identifiers; these records are detached, not claimed fully anonymized.

`refund.processed` marks the order refunded and records the event. Credits are not automatically clawed back, especially if spent. Partial refunds are conservatively flagged refunded for manual review; consult Razorpay for the exact refund amount. Refund approval, credit recovery, accounting treatment and retention periods require explicit business rules. There is no automatic refund initiation or silent admin adjustment.

For `ORDER_PENDING_RECONCILIATION`, inspect the internal order's receipt in Razorpay Test Mode. If the provider created an order, reconcile its exact amount/currency/receipt/provider ID under a reviewed service-role operation. Do not clear a reservation and blindly retry creation after a timeout. If confirmed absent, an operator may resolve/release the reservation with an audit trail. Automatic reconciliation is not implemented.

Troubleshooting: `PAYMENTS_DISABLED` requires both server flags/config and test secrets; `SERVICE_NOT_CONFIGURED` means missing secret or rejected live key. Signature errors require unchanged raw webhook bytes and the appropriate API/webhook secret. Pending credits require checking captured status, webhook delivery and amount/order matching. A provider timeout is not proof of failure. Public-key config alone is insufficient for payments.

## Validation and release policy

Run `npm run check`, `npm run lint`, `npm test`, `npm run test:db`, `npx deno check supabase/functions/*/index.ts`, `npx deno test supabase/functions/_shared`, and `npm --prefix apps/mobile run build:web`. Browser tests include `tests/payment-preview.cjs` and existing workspace/map/UI suites. SQL tests use real PostGIS/PGlite with only Supabase Auth identity/cron primitives simulated. Unit signature tests do not prove an actual Razorpay transaction.

Credits unlock digital in-app posting functionality. Before a Play-distributed release, the owner must resolve Play Billing versus an eligible India alternative-billing program, enrollment, required UX/reporting/fees and applicable terms. Do not enable Razorpay live keys merely by changing an environment flag: the current integration explicitly rejects them. A provider-policy review and separately tested implementation change are required.

Primary references reviewed 13 September 2026:

- [Razorpay checkout signature verification](https://razorpay.com/docs/payments/payment-gateway/quick-integration/integration-steps/)
- [Raw-body webhook validation, duplicates and ordering](https://razorpay.com/docs/webhooks/validate-test/)
- [Razorpay payment capture](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)
- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)
- [India alternative billing requirements](https://support.google.com/googleplay/android-developer/answer/13306652?hl=en)
