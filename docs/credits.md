# NearHire credit system V2

Migration: `202609140001_credit_entitlements_v2.sql`. Supabase Auth identity and Razorpay TEST-only payments remain unchanged; SMS setup is postponed. No APK/AAB is built by this task.

## Entitlements

- New accounts: 10 welcome credits exactly once, plus 2 for the current UTC calendar month (12 initially).
- Monthly grants use a first-of-month UTC date and expire 30 days after the actual grant. No historical catch-up. Late-month signup is eligible immediately. Adjacent grants may overlap because expiry is 30 days, not the calendar boundary.
- Welcome and purchased credits do not expire. Publishing/reposting each cost 1. All worker discovery/application activity remains free.
- Packages remain 1/₹9, 5/₹39, 10/₹69. Existing order snapshots, HMAC verification, captured-payment checks, webhook/payment uniqueness and refunds policy are unchanged.

`pricing_config.free_post_limit` is the existing welcome-credit configuration (now 10); it is not a lifetime posting limit. Added config: monthly_free_credits=2, monthly_enabled=true, monthly_expiry_days=30, publish_cost=1, repost_cost=1. Costs are constrained to 1 for this V1. No parallel welcome setting was introduced. Historical grants store actual amounts, month and expiry and never change when configuration changes.

## Accounting and migration

`credit_transactions` remains the audit trail. New `credit_lots` rows track original and remaining amounts, source and expiry, linked uniquely to each positive transaction. The ledger accounting trigger is the sole new arithmetic path: a ledger insert changes lots and `job_credits.balance` together. Payment settlement no longer increments the cache separately. All modifications are in one PostgreSQL transaction.

Before migration, cached balances must equal ledger totals or deployment aborts with CREDIT_RECONCILIATION_REQUIRED. Existing positive entries become non-expiring lots; old debits are allocated FIFO without rewriting entries or changing balances. Historical allocation is a deterministic reconstruction, not a claim that old software tracked lots.

An old exactly +5 signup with no ambiguous positive admin/test adjustments receives a separate +5 `welcome_upgrade`, reference `welcome_v2_adjustment:<UUID>`. Existing signup entries remain +5. A unique per-user upgrade index and reference protect retries. Accounts with other positive adjustment sources are conservatively skipped for manual review, even if their current balance is low. Purchases do not disqualify an otherwise eligible old signup. No user receives another +10 on migration.

`welcome_once` remains the signup uniqueness constraint. Provisioning is idempotent. Monthly grants have a unique `(user_id, grant_month)` partial index and stable monthly reference. The server decides user eligibility, current period, amount and expiry; clients cannot submit those fields.

## Spending and expiry

Account-row locks serialize granting, spending, expiry and purchase accounting for each UUID. Spend selects unexpired lots with earliest expiry first; then welcome/upgrade, then other non-expiring sources (including purchases). Insufficient funds roll the entire transaction back. The existing publish job lock, active-job retry behavior, repost request identity and payment order locks are preserved.

Expired lots are never selected for spending. `monthly_expired` records only the unused remainder as a negative ledger entry, once per lot. Welcome/purchases remain intact. The balance cache may await scheduled/lazy expiry materialization; clients must use `credit_summary()` for spendable balance, not sum raw ledger entries or read the cache directly. Admin overview excludes expired lots immediately.

`credit_summary()` is an authenticated no-argument RPC. It checks the caller, expires unused credits, ensures the current month's grant, and returns total/monthly/other/welcome/purchased, next expiry and server time. Mobile chip, wallet and publish review share its query cache; no frontend grants or balance arithmetic writes exist.

## Scheduler and eligibility

One named pg_cron job `nearhire-credit-entitlements` runs `15 0 * * *` (00:15 UTC daily). It calls the same private ensure function used by credit access/publish. Named registration and grant uniqueness prevent duplicate awards. No separate external scheduler or notifications were added. Only the current UTC period is granted. A missed schedule can be repaired by access in the current period.

An account must have both an auth user and a non-suspended profile; admin-only accounts are excluded from subsequent monthly processing. Deleted/orphan accounts receive nothing. Promoting a previously normal account to admin does not retroactively revoke earlier grants. Existing dedicated payment-test account remains eligible; no fake auth fixture was created in hosted production.

The private function's timestamp argument is restricted from public/anon/authenticated and exists for deterministic database tests; the public RPC and scheduled job always use database now(). RLS allows owners to read their lots, never write. Admin ledger inspection remains gated by existing admin membership and AAL2. No admin balance editor was added. Account deletion detaches retained financial ledger/lots; balances disappear and credits cannot transfer to another UUID.

## UI and testing

Profile → Job Credits shows spendable total, monthly/other breakdown, welcome/purchased balances, next expiry and history. The Post Work chip remains compact; Find Work is not pressured to buy. Package cards and zero-credit buy navigation remain. English/Tamil labels cover monthly additions, expiry and welcome upgrade. The DEV-only preview uses 12=10+2 fixtures with no backend writes.

Run:

```powershell
npm run check
npm run lint
npm test
npm run test:db
npx deno check --config supabase/functions/deno.json supabase/functions/location/index.ts supabase/functions/payment-order/index.ts supabase/functions/payment-verify/index.ts supabase/functions/razorpay-webhook/index.ts supabase/functions/notification-dispatch/index.ts supabase/functions/delete-account/index.ts
npx deno test --config supabase/functions/deno.json --allow-env supabase/functions/_shared supabase/functions/location/provider_test.ts
npm --prefix apps/mobile run build:web
npm --prefix apps/admin run build
```

Database coverage: new/repeated/mid-month grants; old +5 adjustment and ambiguous-admin skip; rollover/config snapshots; duplicate monthly attempts; monthly-first publish; partial expiry; non-expiring sources; zero/expired-only balance; competing publishes; repost/history; eligibility; RLS/admin; balance/lot/ledger reconciliation. All existing package/settlement/refund/ownership and PostGIS/marketplace regressions run against V2.

PGlite executes real SQL/PostGIS but serializes database requests; Promise-based competing-call tests verify idempotency and atomic results, not independent PostgreSQL session contention. Production protection relies on row locks and unique indexes, not browser gating. No live-money, hosted SMS or physical-device success is inferred from these tests.

## Deployment and review

Use normal Supabase migration list / db push --dry-run / db push --linked workflow. Never edit applied migrations, reset hosted data or repair migration history to pretend deployment. Inspect only redacted aggregate ledger, config, scheduler count and existing test balance afterward. Keep all payment history.

Preview: http://localhost:8095/ — Post Work → top-right credit chip, or Profile → Job Credits. DEV gallery supplies zero-credit/publish fixtures. Hot reload remains enabled. This is presentation data; live mode uses the RPC. Review the existing native development app later; no new build requested here.

## Validation result (14 September 2026)

Local: 28 mobile/unit tests, 2 localization tests, 50 SQL/PostGIS scenarios and 4 Edge tests passed. Mobile/admin TypeScript, ESLint, all six Edge entrypoint type checks, Expo web export and admin production build passed. Generic tracked/untracked secret scan and exact private-credential scan found no matches. UI inspection verified English/Tamil 12=10+2, package prices/savings, safe preview checkout, 12→11 publish confirmation, zero-credit disabled publish and buy navigation.

Hosted deployment: **pending explicit approval required by automatic review**. Normal migration dry-run confirms only this migration is pending. Two deployment attempts were rejected before execution; no migration was applied and no hosted credits changed. Do not report the hosted test balance as 12 until deployment/read-back succeeds. The previously verified balance remains 5. Push is held until the new credit RPC exists in hosted Supabase, so the connected application cannot deploy a client against a missing RPC.

Legacy `PreviewApp`/`marketplace.ts` has an isolated five-post demonstration cap. It is not production accounting or the current UI preview and was intentionally not rewritten. Current DEV entry is WorkspacePreview/ScreenPreview; production is LiveApp.
