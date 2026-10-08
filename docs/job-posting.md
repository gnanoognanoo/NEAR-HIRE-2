# Job posting recovery

Post Work validates title, category, description, pay, worker count, schedule and locality before review. Optional date uses YYYY-MM-DD; optional local start time uses 24-hour HH:mm. Publication expires exactly 24 hours after publication, independently of the requested work date. Urgent jobs have red discovery markers; normal jobs have green markers.

GPS, movable pin and manual coordinates use the existing location picker. Reverse geocoding and a street address are optional. The selected posting coordinates are separate from discovery GPS and remain private; nearby queries retain coarsened coordinates and omit the private address.

Each signed-in user's unfinished posting form is stored in the OS SecureStore (tab-scoped session storage on web), including its stable request UUID and selected coordinates. Navigating back and app restart retain the form. Saving a draft does not spend credits. Retrying always saves current edits through create_job with the same request ID. Published jobs cannot be mutated by this retry path. No payment completion automatically publishes a job.

publish_job remains the credit V2 transaction: owner-authenticated row lock, credit entitlement synchronization, one immutable publish debit, activation and 24-hour expiry in one transaction. Repeated calls return the existing active job without another debit. A failed transaction rolls back the debit. Insufficient funds open Job Credits; the user returns and explicitly confirms publication. Network errors preserve the request ID, so retry recovers an ambiguous success without duplicating the job.

Successful publication shows Job Published Successfully, refreshes React Query observers (My Posts, nearby jobs and credit wallet), and opens My Posts. Other users see the job in nearby discovery; self-posts remain excluded by the existing RPC.

Migration: 20261008090813_job_posting_recovery.sql. Adds is_urgent/start_time, allows an empty optional private address, updates only the owner's draft on create_job retry, and includes public urgency/time fields in nearby_jobs. Does not change authentication, payment mode, publish credit accounting, RLS, native dependencies, basemap or expiry policies.

## Verification

Automated tests cover normal/urgent publication, required fields, amounts/dates/times, optional address, manual coordinates, edited-draft retry, double-tap guarding, interrupted response retry, secure-storage failure, permission errors, insufficient entitlements, exact one-credit debit, public nearby privacy, My Posts persistence and 24-hour expiry. Database tests use real PostGIS and actual migrations, with simulated Auth identity/cron only. Hosted smoke tests are rolled back and create no lasting jobs or wallet changes.

Physical Android review remains required: update the existing Preview APK by reopening it online and restarting after download; create normal and urgent jobs with GPS and manual pin, navigate away/back before review, confirm exact one-credit spend and My Posts, and use a second account to inspect green/red nearby markers. Also test disabled GPS, denied permission, invalid pay, insufficient funds, quick repeated taps, airplane mode/retry, close/reopen and Tamil messages. These checks are not claimed as completed until run on a phone. No new APK is required for this JS/database-only change; Razorpay remains TEST.
