# API contracts

Mobile calls Supabase with the signed-in user's bearer token. Business mutations are RPCs; clients cannot directly write protected tables.

| Service      | RPCs / endpoints                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Profile      | save_profile(p), save_preferences(p)                                                                                                                                   |
| Jobs         | create_job(p, p_request_id), update_draft(p_job_id,p), publish_job(p_job_id), repost_job(p_job_id,p_request_id), fill_job(p_job_id), transition_job(p_job_id,p_status) |
| Discovery    | nearby_jobs(p_lat,p_lng,p_radius,p_filter,p_offset)                                                                                                                    |
| Applications | apply_job(p_job_id), decide_application(p_application_id,p_status), confirm_completion(p_application_id), private_contact(p_application_id)                            |
| Trust        | submit_review(p_application_id,p_stars,p_body), safety_action(p_action,p_target,p_reason,p_detail)                                                                     |
| Lists        | my_activity(p_mode,p_offset), toggle_saved(p_job_id)                                                                                                                   |
| Devices      | register_device(p_token,p_platform), read_notification(p_id)                                                                                                           |
| Admin        | admin_overview(), admin_list(p_table,p_query,p_offset), admin_moderate(p_action,p_target,p_reason), admin_pricing(p_free,p_price)                                      |
| Payments     | payment-order Edge Function; razorpay-webhook Edge Function                                                                                                            |
| Location     | location Edge Function: search, resolve, reverse                                                                                                                       |
| Deletion     | delete-account Edge Function with explicit confirmation                                                                                                                |

## Discovery

Radius is restricted to 1000, 3000, or 5000 metres. Filters include kind, category, query, employment_type, language, min_pay, and sort. Sort values: recommended, nearest, pay, newest. Returns 20 rows with `job`, `distance_m`, `match_score`, `approx_lat`, `approx_lng`. There is no exact address field in discovery.

Recommended matching weights: distance 35, category 25, availability 15, language 10, compatible pay unit/amount 10, poster rating up to 5. Missing signals do not earn points. This is deterministic and uses no AI.

## Edge authentication

`location`, `payment-order`, and `delete-account` verify bearer tokens with Auth and reject missing/suspended profiles. `razorpay-webhook` validates HMAC-SHA256 over raw bytes. `notification-dispatch` requires the configured scheduler secret. All external fetches have timeouts.

Error codes such as AUTH_REQUIRED, JOB_UNAVAILABLE, CREDITS_REQUIRED, ALREADY_APPLIED, and RATE_LIMITED are translated into user-facing copy. Raw secrets and OTPs must not be logged.

## Idempotency

Persist request UUIDs across retries. A server-created payment order that is reserved but lacks a provider ID needs reconciliation, not a fresh checkout retry. Query Razorpay by receipt and update the matching order only after checking user/order/amount/currency. Webhook retries are safe after reconciliation.
