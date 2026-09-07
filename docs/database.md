# Database

Apply migrations in filename order. Migration 004 contains the category catalog so a production `db push` does not depend on running development seeds.

| Area          | Tables                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Identity      | profiles, worker_profiles, admin_users                                                                      |
| Marketplace   | job_categories, jobs, job_locations, applications, application_status_history, saved_jobs                   |
| Trust         | reviews, reports, blocked_users, admin_actions                                                              |
| Money         | pricing_config, credit_packages, job_credits, credit_transactions, payment_orders, payments, payment_events |
| Notifications | notifications, user_devices, private.notification_outbox                                                    |
| Events        | analytics_events, private.rate_limits                                                                       |

Phone numbers stay in `auth.users`. `profiles` has no phone field. `job_locations` has a geography point with a GiST index and exact address. Profiles are self-readable only; the applicant RPC returns selected work-profile fields to the hiring party.

`jobs.status` supports draft, active, filled, in_progress, completed, cancelled, expired, reported, and suspended. The public table does not contain the sensitive address. Both timestamps must exist together, and expiry must equal publication plus 24 hours.

Scheduled expiry runs every minute. Discovery, application submission, and acceptance independently check `expires_at > now()`. Therefore a delayed cron tick does not extend discovery or acceptance.

Credits are granted once per Auth account by the signup trigger. This is not a claim of phone-level lifetime anti-abuse protection: deleting/recreating accounts needs a business decision about eligibility retention before paid launch. Every publication is associated with one unique ledger reference. Payment settlement locks the order and applies a unique payment reference.

## Local integration tests

`npm run test:db` uses embedded PostgreSQL and the actual PostGIS extension. It applies the real migrations. Only Supabase's Auth/storage platform definitions and cron registration are shimmed. Identity is set explicitly for each test role. This verifies SQL behavior and RLS, not Supabase Auth delivery, PostgREST configuration, concurrent multi-process load, or hosted cron execution.

After linking Supabase, generate application database types:

```powershell
npx supabase gen types typescript --linked > packages/core/database.generated.ts
```

The current live service response types need to be tightened against that generated schema before release.
