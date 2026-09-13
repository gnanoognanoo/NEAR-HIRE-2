# NearHire final UI review — 11 September 2026

Preview: http://localhost:8093/ . APK NOT BUILT. Android builds remain paused until the owner explicitly says `UI APPROVED — BUILD APK`.

## Changes in this review

- Consumer header no longer displays DEV controls. In development preview, long-press NearHire for one second to open the isolated onboarding/screen gallery. Production does not import this gallery.
- Shared public JobSummary shows description, pay, kind/category, locality/distance, hours, workers, languages, skills and expiry when supplied. It never renders exact addresses or coordinates.
- Live Apply now requires confirmation, disables repeated submission after success, and uses the existing guarded mutation runner and server duplicate checks. Successful mutations invalidate the Applications query.
- Live Applications, Applicants and My Posts have status filters. Application cards no longer mislabel the applicant's own name as an employer. Dates are shown where returned.
- Expired posts no longer offer the invalid Filled action. Publication/repost confirmation includes public job information, balance, posting cost and 24-hour expiry. Existing server credit and historical repost behavior is unchanged.
- Worker cards open a privacy-preserving public profile. Applicant cards can expand their existing skills, rating and experience data.
- Live Edit Profile returns to Profile after successful saving. Residential forms omit business-only fields.
- The isolated consumer preview connects apply, withdrawal, publication, acceptance, work transitions and repost state. Repost retains the old expired item. No fake authenticated session or production writes are involved.

## Verification

TypeScript (mobile/admin), ESLint, 23 mobile/unit tests, 2 localization tests and production web export pass. Six browser scenarios cover the 25-screen gallery, both languages, workspace navigation/persistence, map/list, 1–50 km radius, location success/errors/retry, worker privacy, apply/withdraw, acceptance and repost history. Requested 360/390/412 widths were exercised. Screenshots of details, Profile, Tamil worker profile and Tamil residential form were visually inspected.

No database or backend changes in this review, so database/PostGIS tests were not rerun here. Their previous result is not claimed as a fresh run. Native GPS, SMS, FCM, native MapLibre and live multi-account actions still require authenticated/physical-device testing. Browser GPS tests use controlled browser location responses.

Production web export contains ProductionApp and excludes the development gallery. The source safety scan reported no credential findings. Changes are local and uncommitted, including work from preceding UI tasks; no push was performed.

## Full-requirement gaps (not claimed complete)

The following are genuine existing implementation/data-contract gaps, not failed compilation or broken preview navigation:

- Nearby worker RPC does not supply photo, languages, experience, expected pay or completed-job counts. Profile renders `Not shared` rather than fabricated values. Expanding public fields needs a deliberate privacy-reviewed API change, which this UI-only task prohibited.
- Applications RPC lacks employer/business name and locality/distance. My Posts lacks applicant counts. Existing data is shown without inventing these fields.
- Profile photo upload is not implemented. Name/locality/languages edit and work preferences remain supported; credits, verification and rating are not editable.
- Posting uses the existing combined schedule field rather than separate date/time/duration/working-days controls. Preview publication is presentation-only; it is not proof of real credit deduction or publication.
- Settings currently has language, notification opt-in, preferences, credits, configured privacy-policy link, logout and deletion. A dedicated blocked-user list, Help destination and configured Terms destination are still missing. Development-only settings/report actions must not be interpreted as proof of external operations.
- Live urgency metadata is not currently returned; no urgency is fabricated for hosted jobs. The preview demonstrates green normal and red urgent markers.

The preview is ready for the owner's final visual review, but these gaps prevent claiming the entire requested production feature checklist has passed. APK approval remains separate.
