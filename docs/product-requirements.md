# NEARHIRE — FULL-STACK PRODUCTION BUILD MASTER PROMPT

You are a senior full-stack engineer, mobile architect, backend engineer, DevOps engineer, database architect, security engineer, QA engineer, and product engineer working together on a real startup called **NearHire**.

Your task is to take my **existing NearHire project/demo folder** and convert it into a **complete, production-ready, full-stack application that can be deployed and launched to real users**.

This is NOT a prototype, mockup, UI demo, hackathon demo, or proof of concept.

The final result must be structured, secure, scalable, tested, maintainable, deployment-ready, and suitable for launching NearHire as a real startup.

---

# 1. FIRST RULE — INSPECT BEFORE CHANGING ANYTHING

Do NOT immediately rebuild the application from scratch.

First:

1. Open the complete existing NearHire repository.
2. Inspect every important folder.
3. Identify:

   * frontend framework
   * backend
   * database
   * authentication
   * existing UI components
   * navigation
   * APIs
   * environment variables
   * existing mock data
   * map implementation
   * existing reusable screens/components
   * existing design system
4. Run the current project if possible.
5. Identify what already works.
6. Identify what is demo-only.
7. Identify missing production features.
8. Preserve working code whenever possible.
9. Refactor only when necessary.
10. Do NOT remove useful existing functionality.

Before implementing major changes, create a short technical assessment inside:

`docs/current-state-analysis.md`

Include:

* existing architecture
* good reusable parts
* technical debt
* missing backend functionality
* security issues
* production blockers
* recommended upgrade path

After that, begin implementation automatically.

Do not wait for my confirmation after every step.

---

# 2. PRODUCT DEFINITION

NearHire is a **hyperlocal work and hiring marketplace**.

Its purpose is to connect:

* people looking for nearby work
* shops/businesses looking for workers
* residents looking for people to perform residential services

NearHire focuses heavily on **local jobs within approximately 1–5 km**.

The application must support two primary actions:

## FIND WORK

and

## POST WORK

Users must NOT be permanently locked into roles such as:

* Worker
* Employer
* Resident

The same account must be capable of both finding work and posting work.

Example:

A person may work part-time today and hire an electrician tomorrow.

---

# 3. TARGET PLATFORMS

Build NearHire primarily for:

## Android Mobile App

Preferred:

* React Native
* Expo
* TypeScript

If the current repository already uses a strong React Native/Expo setup, continue using it.

If the current project uses another architecture, evaluate whether migration is necessary.

Avoid unnecessary rewriting.

Also build:

## Admin Dashboard

Preferred:

* Next.js
* TypeScript

The admin dashboard must be deployable separately.

---

# 4. RECOMMENDED TECHNOLOGY STACK

Preferred architecture:

## Mobile

* React Native
* Expo
* TypeScript
* Expo Router where appropriate
* React Query / TanStack Query
* Zustand or equivalent lightweight state management only if needed
* React Hook Form
* Zod validation

## Backend

Use:

* Supabase

Including:

* Supabase Auth
* PostgreSQL
* PostGIS
* Supabase Storage
* Supabase Realtime where appropriate
* Supabase Edge Functions
* Supabase database functions/RPC
* Supabase scheduled jobs/cron where appropriate

Avoid adding a separate Node backend unless truly necessary.

Business-critical operations must still be enforced server-side.

## Maps

Use:

* MapLibre for map rendering

Create a provider abstraction for:

* geocoding
* autocomplete
* reverse geocoding
* routing

Preferred initial provider:

* Ola Maps

However:

DO NOT tightly couple NearHire to Ola Maps.

Create an interface such as:

`LocationProvider`

with implementations such as:

* OlaMapsProvider
* GoogleMapsProvider
* MapplsProvider
* MockLocationProvider

This allows the provider to be replaced later without rewriting the app.

## Nearby Job Search

DO NOT use Google Places Nearby Search to discover NearHire jobs.

All NearHire jobs must be stored with latitude and longitude in PostgreSQL/PostGIS.

Use PostGIS queries to find:

* jobs within 1 km
* jobs within 3 km
* jobs within 5 km
* workers within specified distances

## Notifications

Use:

* Firebase Cloud Messaging

Create a notification service abstraction.

## Payments

Use:

* Razorpay

Support:

* test mode
* production mode
* webhook verification
* payment records
* job credits

Never trust client-side payment confirmation.

## Admin

Use:

* Next.js
* Supabase
* server-side protected admin authentication

---

# 5. MONOREPO STRUCTURE

If appropriate, structure the repository like:

```text
NEARHIRE/
│
├── apps/
│   ├── mobile/
│   │
│   └── admin/
│
├── packages/
│   ├── types/
│   ├── validation/
│   ├── config/
│   ├── ui/
│   └── utils/
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   ├── seed.sql
│   └── config.toml
│
├── docs/
│   ├── current-state-analysis.md
│   ├── architecture.md
│   ├── database.md
│   ├── api.md
│   ├── deployment.md
│   ├── security.md
│   └── testing.md
│
├── .env.example
├── package.json
├── README.md
└── turbo.json or equivalent if useful
```

Do not force a monorepo migration if the existing structure is already clean.

---

# 6. ENVIRONMENT CONFIGURATION

Create proper environment handling.

Create:

`.env.example`

Include placeholders only.

Example:

```text
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

OLA_MAPS_API_KEY=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

ADMIN_APP_URL=
MOBILE_APP_SCHEME=
```

Never:

* hardcode secrets
* commit production secrets
* expose service-role keys to mobile
* expose Razorpay secret
* expose server Firebase credentials

---

# 7. INTERNATIONALIZATION

Before authentication, the user must first select language.

Initial languages:

* English
* Tamil

Architecture must allow:

* Hindi
* Telugu
* Malayalam
* Kannada
* other Indian languages later

First screen:

```text
NEARHIRE

Choose your language

English
தமிழ்

[Continue]
```

Save:

`preferred_language`

The language should remain selected on subsequent app launches.

Allow changing it later:

Profile → Settings → Language

All UI strings must use translation files.

Do NOT hardcode UI copy directly throughout screens.

Example:

```text
locales/
├── en.json
└── ta.json
```

---

# 8. AUTHENTICATION

Use phone number OTP authentication.

Flow:

```text
Splash
↓
Language
↓
Phone number
↓
OTP
↓
Profile setup
↓
Home
```

Implement:

* international phone number validation
* India +91 default
* OTP resend cooldown
* loading states
* wrong OTP errors
* expired OTP handling
* network failures
* logout
* account deletion
* session persistence
* refresh handling

---

# 9. USER PROFILE

Initial profile must remain simple.

Basic information:

* name
* phone
* profile picture optional
* preferred language
* locality
* approximate location
* latitude
* longitude
* spoken languages

Do NOT force users to fill long forms initially.

After profile setup show:

```text
What do you want to do?

[Find Work]

[Post Work]
```

---

# 10. FIND WORK FLOW

When user selects:

## Find Work

Ask:

```text
What type of work are you looking for?

Residential Work

Shop / Business Work
```

---

# 11. RESIDENTIAL WORKER PROFILE

If Residential Work is selected, allow services such as:

* Electrician
* Plumber
* Cleaning
* Painter
* Carpenter
* Gardening
* AC repair
* Appliance repair
* Driver
* House shifting
* Loading/unloading
* Delivery
* Cook
* Event helper
* General helper
* Other

Collect:

* service categories
* experience
* expected price
* pricing type
* per hour
* per day
* per work/job
* availability
* available days
* available time
* maximum travel radius
* languages spoken
* portfolio images optional
* rating
* completed jobs

---

# 12. BUSINESS WORKER PROFILE

If Shop / Business Work is selected:

Employment types:

* Full-time
* Part-time
* Daily wage
* Temporary
* Weekend
* Shift-based

Categories:

* Shop helper
* Cashier
* Salesperson
* Waiter
* Kitchen helper
* Delivery
* Warehouse
* Loader
* Office assistant
* Data entry
* Driver
* Security
* Housekeeping
* Technician
* General helper
* Other

Collect:

* categories
* employment preferences
* expected salary/pay
* working-hour preferences
* availability
* skills
* experience
* preferred radius
* languages

---

# 13. POST WORK FLOW

When user selects:

## Post Work

Ask:

```text
What type of work are you posting?

Residential Work

Shop / Business Work
```

---

# 14. RESIDENTIAL JOB POST

Fields:

* title
* category
* description
* budget
* pricing type
* date required
* preferred start time
* duration
* number of workers
* approximate locality
* exact address
* coordinates
* required language
* optional instructions
* optional images

IMPORTANT:

Exact residential address must NOT be shown publicly.

Before acceptance show only:

* locality
* approximate map position
* approximate distance

After worker is accepted, reveal exact address/contact according to privacy settings.

---

# 15. BUSINESS JOB POST

Fields:

* job title
* business name
* category
* employment type
* salary/pay
* salary type
* working hours
* working days
* experience required
* skills
* required language
* number of workers
* start date
* location
* coordinates
* description
* benefits optional
* contact rules

---

# 16. JOB EXPIRY — VERY IMPORTANT

Every published job must expire exactly:

## 24 HOURS AFTER PUBLICATION

Example:

```text
published_at:
2026-09-06 16:30

expires_at:
2026-09-07 16:30
```

Database must include:

* published_at
* expires_at
* status

Possible statuses:

```text
draft
active
filled
in_progress
completed
cancelled
expired
reported
suspended
```

After expiry:

* remove from worker discovery
* remove from active maps
* stop new applications
* keep application history
* keep job in employer history
* allow employer to repost

Implement expiry using BOTH:

1. database/query safety
2. scheduled backend expiry task

Never rely only on the mobile app timer.

Query active jobs using:

```text
status = active
AND
expires_at > now()
```

Also periodically update old records to:

`expired`

---

# 17. REPOSTING

Expired jobs must show:

```text
Expired

[Repost]
```

Reposting should:

* copy relevant information
* create a fresh active posting
* reset published_at
* set new expires_at = +24 hours
* retain linkage to original job for analytics
* safely consume a credit when monetization is active

Do NOT overwrite historical job records.

---

# 18. LOCATION SYSTEM

Ask location permission clearly.

User must be able to:

* allow GPS
* manually select locality
* search address
* move map pin if needed

Store:

* latitude
* longitude
* locality
* city
* district
* state
* optional geohash
* PostGIS geography/geometry point

Use PostGIS.

Example concept:

```sql
ST_DWithin(
  jobs.location,
  user_location,
  radius_meters
)
```

Create indexes suitable for geospatial search.

---

# 19. LOCATION PRIVACY

Do NOT expose worker/residential exact coordinates unnecessarily.

For public discovery:

* show approximate distance
* show locality
* optionally slightly obfuscate visual map point where necessary

Exact sensitive location becomes available only after required workflow state.

---

# 20. NEARBY JOB DISCOVERY

Default user radius:

3 km

Allow options:

* 1 km
* 3 km
* 5 km
* custom later

Show:

* Map view
* List view

Filters:

* distance
* category
* pay
* employment type
* residential/business
* date
* availability
* language

Sorting:

* recommended
* nearest
* highest paying
* newest

---

# 21. RULE-BASED MATCHING ENGINE

NO AI in V1.

Create a deterministic scoring system.

Example:

```text
Distance          35%
Skill/category    25%
Availability      15%
Language          10%
Pay compatibility 10%
Rating             5%
```

Return a score like:

```text
92% Match
```

Create this logic in a reusable backend/service layer.

Do not bury it directly inside UI components.

Design the schema so AI can replace/improve this system later.

---

# 22. JOB APPLICATIONS

Worker can:

* apply
* view application
* withdraw before acceptance where permitted

Employer can:

* view applicants
* open worker profile
* shortlist optional
* accept
* reject

Application states:

```text
pending
shortlisted
accepted
rejected
withdrawn
cancelled
completed
```

Prevent duplicate applications.

Use database constraints.

---

# 23. ACCEPTANCE

After employer accepts a worker:

* worker receives notification
* employer receives confirmation
* contact details can become available
* exact work location may become available
* applicant state becomes accepted

If enough workers are accepted:

Job becomes:

`filled`

Then remove from new applicants.

---

# 24. WORK START / COMPLETION

Flow:

```text
Active
↓
Worker Accepted
↓
Filled
↓
In Progress
↓
Completed
```

Allow both parties to confirm completion if required.

Prevent invalid state transitions.

Build a server-side job state transition validator.

---

# 25. CONTACT PRIVACY

Phone numbers should not be publicly visible.

Before acceptance:

* use in-app application workflow
* hide phone
* hide exact private address

After acceptance:

* optionally reveal phone
* reveal exact location if job requires it

Keep this controlled server-side.

---

# 26. RATINGS AND REVIEWS

After completion:

Worker can rate employer.

Employer/resident can rate worker.

Use:

* 1–5 stars
* optional review text
* review date
* linked completed job

Prevent:

* rating before completion
* duplicate rating
* self-rating

Store aggregate rating securely.

---

# 27. REPORTING & SAFETY

Support:

## Report user

Reasons:

* fake profile
* harassment
* spam
* fraud
* inappropriate behaviour
* no-show
* other

## Report job

Reasons:

* fake job
* misleading pay
* dangerous work
* inappropriate content
* spam
* scam
* other

## Block user

Blocked users must not be able to freely interact with each other.

---

# 28. ADMIN DASHBOARD

Build:

`apps/admin`

Admin pages:

## Overview

Metrics:

* total users
* active users
* completed profiles
* workers
* job posters
* residential posts
* business posts
* active jobs
* expired jobs
* applications
* filled jobs
* completed jobs
* reports
* revenue
* credits

## Users

Search/filter users.

Actions:

* view
* suspend
* unsuspend
* verify
* review reports

## Jobs

View:

* active
* expired
* cancelled
* reported
* completed

Moderate job content.

## Reports

Moderation queue.

## Payments

View:

* transactions
* successful payments
* failed payments
* credit purchases
* refunds if supported

## Analytics

Show:

* jobs/day
* applications/job
* job fill rate
* completion rate
* time to first application
* repeat employers
* repeat workers
* city/locality usage
* category demand

---

# 29. JOB PRICING SYSTEM

Workers must always be free to:

* create worker profile
* search jobs
* apply
* receive earnings

Do NOT charge workers to access employment.

Current launch pricing:

## Beta

First:

5 free job posts

After free posts:

₹10 per job post

Implement pricing as server-side configuration.

Do NOT hardcode ₹10 throughout the application.

Example:

```text
pricing_config

free_post_limit = 5
job_post_price = 10
```

Allow admin modification later.

---

# 30. JOB CREDIT SYSTEM

Implement:

```text
1 credit = 1 job post
```

During beta:

User gets:

5 free credits

Later packages can include:

```text
1 credit = ₹10

10 credits = ₹90

25 credits = ₹199
```

Pricing may change, so package definitions must come from database/config.

Credit balance must be managed server-side.

Prevent double spending.

Use transactions/locking where needed.

---

# 31. RAZORPAY

Implement production-quality Razorpay architecture.

Flow:

```text
User selects credit pack
↓
Server creates Razorpay order
↓
Mobile opens payment
↓
Payment succeeds
↓
Server verifies signature/webhook
↓
Payment stored
↓
Credits added
```

Never trust:

`payment_success = true`

from the mobile client alone.

Create:

* payment_orders
* payments
* payment_events/webhooks
* credit_transactions

Use idempotency.

Handle webhook retries.

---

# 32. OPTIONAL MONETIZATION FIELDS

Prepare schema for later:

* boost
* urgent hire
* featured job
* subscription

Do not overcomplicate initial UI.

Possible future pricing:

```text
Boost: ₹49

Urgent Hire: ₹79
```

But V1 focus remains job posting.

---

# 33. DATABASE DESIGN

Design normalized production tables.

Likely entities:

```text
profiles
user_preferences
worker_profiles
worker_services
worker_business_preferences
spoken_languages

jobs
job_locations
job_categories
job_required_skills

applications
application_status_history

reviews
ratings

reports
blocked_users

user_devices
notifications
notification_preferences

job_credits
credit_transactions

payment_orders
payments
payment_events

admin_users
admin_actions

verification_requests

app_config
pricing_config
```

Use enums or constrained tables carefully.

Do not over-normalize trivial fields.

---

# 34. DATABASE CONSTRAINTS

Add constraints for:

* valid salary
* positive budget
* valid expiry
* valid latitude/longitude
* unique application per job/user
* no self-application
* valid job states
* valid application transitions
* valid review relationships
* credit balance consistency

---

# 35. ROW LEVEL SECURITY

RLS is mandatory.

Create policies so that:

* users can read/update their profile
* users cannot edit other users
* job posters can edit their own jobs
* workers can create their own applications
* employers can view applicants for their jobs
* users cannot directly modify their credit balances
* users cannot directly mark payment successful
* users cannot view sensitive reports not belonging to them
* admin/service actions use secure elevated access

Document all policies in:

`docs/security.md`

---

# 36. STORAGE SECURITY

Supabase Storage buckets may include:

```text
avatars
job-images
verification-documents
```

Rules:

Avatars can be public or controlled.

Verification documents must be PRIVATE.

Never expose verification documents via permanent public URL.

Use signed URLs when necessary.

---

# 37. NOTIFICATIONS

Implement notification events:

```text
Nearby job posted
Application received
Application accepted
Application rejected
Job filled
Job expired
Job reposted
Work starting
Work completed
New review
Account/report status
```

Use Firebase Cloud Messaging.

Store device tokens securely.

Handle token refresh.

Create notification preferences.

---

# 38. JOB EXPIRY NOTIFICATION

Before expiry optionally notify employer:

```text
Your NearHire job will expire soon.
```

After expiry:

```text
Your job post has expired.

[Repost]
```

Do not spam users.

---

# 39. UI/UX QUALITY

The application must look like a real startup application, not a college project.

Prioritize:

* large readable text
* simple cards
* clear buttons
* minimal clutter
* good contrast
* clear bottom navigation
* Tamil rendering
* accessibility
* loading skeletons
* empty states
* offline errors
* retry actions
* success confirmations

Keep flows simple for non-technical users.

---

# 40. MOBILE HOME SCREEN

Preferred structure:

```text
NearHire

Location: Anna Nagar

What do you need today?

[Find Work]
[Post Work]

Nearby Opportunities

[Residential]
[Business]

Nearby jobs...
```

Bottom navigation:

```text
Home

Jobs

Applications

Notifications

Profile
```

Adapt based on final UX.

---

# 41. MAP UI

Map screen should include:

* user location
* job markers
* distance radius
* search locality bar
* map/list toggle
* filter button

Click marker:

Show small job card.

Do not make the map expensive by repeatedly requesting geocoding unnecessarily.

Cache address results when sensible.

---

# 42. API / SERVICE ARCHITECTURE

Create reusable services:

```text
authService
profileService
jobService
applicationService
locationService
mapProvider
notificationService
paymentService
creditService
reviewService
reportService
analyticsService
```

Avoid direct database code scattered across screen components.

---

# 43. FORM VALIDATION

Every important form must validate:

* client-side
* server/database-side

Use Zod or equivalent.

Examples:

Job budget cannot be negative.

Workers required must be >= 1.

Expiry must be valid.

Latitude/longitude must be valid.

Phone must be valid.

---

# 44. ERROR HANDLING

Implement centralized error handling.

User-friendly errors:

Instead of:

```text
PostgrestError PGRST116
```

Show:

```text
We couldn't load nearby jobs.
Please try again.
```

Log technical details separately.

---

# 45. LOADING STATES

Every asynchronous screen must handle:

* loading
* success
* empty
* error
* retry

No blank screens.

---

# 46. OFFLINE / POOR NETWORK

NearHire may be used by people with weak internet.

Handle:

* slow connections
* request timeout
* offline mode
* retry
* cached job list where safe
* optimistic updates only when safe

---

# 47. SECURITY

Protect against:

* IDOR
* unauthorized profile access
* job modification
* credit manipulation
* fake payment confirmation
* repeated API abuse
* OTP abuse
* file upload abuse
* malicious text
* SQL injection
* duplicate applications
* location leakage

Apply:

* RLS
* rate limiting where possible
* server-side validation
* secure secrets
* signed uploads
* content limits

---

# 48. LOGGING

Implement structured logging for important backend events.

Examples:

* auth failures
* job creation
* job expiration
* payment confirmation
* credit usage
* moderation action
* major system errors

Never log:

* OTP
* full payment secrets
* sensitive private identity documents

---

# 49. ANALYTICS

Implement startup analytics.

Track:

```text
signup_started
signup_completed

profile_completed

find_work_clicked
post_work_clicked

job_created
job_published
job_expired
job_reposted

job_viewed

application_started
application_submitted
application_accepted
application_rejected

job_filled
job_started
job_completed

payment_started
payment_success
payment_failed
```

Analytics should support future product decisions.

---

# 50. IMPORTANT BUSINESS METRICS

Admin dashboard should calculate:

## Job Fill Rate

```text
filled jobs / total valid jobs
```

## Average Applications per Job

## Time to First Application

Calculate difference:

```text
job.published_at

to

first application.created_at
```

## Repeat Employer Rate

## Worker Retention

## Job Completion Rate

## Expired Without Applicant Rate

---

# 51. TESTING

Create tests for core logic.

At minimum:

## Job expiry

* job remains active before 24h
* job unavailable after expires_at
* expired job cannot accept new application
* repost creates valid new listing

## Nearby search

* jobs inside radius returned
* jobs outside radius excluded
* sorting by distance correct

## Applications

* duplicate application blocked
* accepted worker valid
* rejected transitions valid
* cannot apply to expired job

## Credits

* free credits awarded once
* publishing consumes credit where applicable
* credit cannot go negative
* payment adds correct credits

## Privacy

* unaccepted worker cannot read residential exact address
* unrelated user cannot see applicant private data

---

# 52. END-TO-END TESTS

Create important E2E scenarios where tooling allows:

## Scenario A

```text
New user
→ choose language
→ phone login
→ profile
→ find work
→ residential
→ see nearby jobs
→ apply
```

## Scenario B

```text
User
→ post work
→ create business job
→ publish
→ worker applies
→ employer accepts
→ mark in progress
→ complete
→ review
```

## Scenario C

```text
Publish job
→ 24 hours passes
→ job expires
→ disappears from search
→ employer reposts
```

---

# 53. SEED DATA

Create development seed data.

Include:

* test users
* Tamil/English users
* Chennai localities
* residential workers
* business workers
* active jobs
* expired jobs
* applications
* reviews

Do not use real personal information.

---

# 54. CHENNAI PILOT

Seed/demo environment can focus on Chennai.

Use areas such as:

* Anna Nagar
* Mogappair
* Ambattur
* Porur
* Velachery

But architecture must NOT be limited to Chennai.

Support:

* city
* district
* state
* country

for later expansion.

---

# 55. ADMIN SECURITY

Do NOT simply store:

`isAdmin = true`

and trust mobile/client state.

Implement secure admin authorization.

Admin dashboard should not expose service-role secrets to browser.

Use secure server-side actions.

Log admin moderation actions.

---

# 56. DEPLOYMENT

The final project must be ready for deployment.

Prepare:

## Mobile

* Expo EAS configuration
* development build
* preview build
* production Android AAB

Add:

`eas.json`

## Supabase

Include all migrations.

Document:

```text
supabase link
supabase db push
supabase functions deploy
```

or correct current equivalent.

## Admin

Deploy to:

* Vercel

or comparable hosting.

Prepare environment setup.

---

# 57. GOOGLE PLAY READINESS

Ensure application has:

* proper package identifier
* app icon placeholders/documentation
* splash
* versioning
* privacy policy URL configuration
* account deletion flow
* permission explanations
* location permission explanation
* notification permission
* production app name

App name:

## NearHire

---

# 58. PERMISSIONS

Ask permissions only when required.

Location:

Explain:

```text
NearHire uses your location to show nearby jobs and workers.
```

Do NOT request unnecessary permissions.

---

# 59. PRIVACY

Build with privacy-first design.

Provide user controls for:

* account deletion
* profile visibility
* location handling
* notification preferences

Do not unnecessarily store precise historical location.

---

# 60. README

Create an excellent:

`README.md`

It must include:

## Project overview

## Architecture

## Prerequisites

## Setup

## Environment variables

## Supabase setup

## Database migration

## Running mobile app

## Running admin app

## Location provider configuration

## Firebase setup

## Razorpay setup

## Testing

## Production build

## Deployment

## Troubleshooting

A beginner should be able to follow it.

---

# 61. DEPLOYMENT DOCUMENT

Create:

`docs/deployment.md`

Include exact steps for:

1. Supabase production project
2. migration deployment
3. storage configuration
4. RLS verification
5. Edge Functions
6. Firebase
7. map provider
8. Razorpay
9. admin Vercel deployment
10. Expo EAS
11. Android production AAB
12. Play Console
13. production smoke test

---

# 62. ARCHITECTURE DOCUMENT

Create:

`docs/architecture.md`

Include architecture diagram such as:

```text
                  NEARHIRE MOBILE
                        │
             ┌──────────┴───────────┐
             │                      │
        Supabase                MapLibre
             │                      │
     ┌───────┼─────────┐        Map Provider
     │       │         │
    Auth PostgreSQL Storage
             │
           PostGIS
             │
       Nearby Matching
             │
        Edge Functions
        │            │
      Razorpay      FCM


                ADMIN DASHBOARD
                      │
                    Next.js
                      │
                   Supabase
```

---

# 63. FUTURE AI READINESS

Do NOT build AI yet.

However ensure the system stores useful structured data for future NearHire AI:

* job category
* worker skills
* search activity
* job views
* applications
* accept/reject
* successful completion
* distance
* salary
* availability
* languages
* rating
* location region
* timestamps

Future AI features could include:

* natural-language job search
* job recommendations
* intelligent matching
* skill-gap detection
* course recommendation
* labour-market intelligence

Do not implement them now.

---

# 64. PERFORMANCE

Optimize:

* database indexes
* PostGIS indexes
* pagination
* lazy loading
* image compression
* React Native list performance
* map marker rendering
* API query count
* cache strategy

Do not download thousands of jobs to the mobile client and filter them locally.

Filtering must happen server/database-side.

---

# 65. PAGINATION

All large lists must support pagination/infinite loading.

Examples:

* nearby jobs
* applications
* notifications
* job history
* admin users
* admin jobs

---

# 66. SEARCH

Support search for:

* jobs
* categories
* locality

Debounce search input.

Avoid API calls for every keystroke when unnecessary.

---

# 67. DESIGN SYSTEM

Create reusable components:

```text
Button
Input
PhoneInput
Select
Card
JobCard
WorkerCard
Badge
Avatar
Modal
BottomSheet
MapMarker
EmptyState
ErrorState
LoadingSkeleton
Toast
ConfirmDialog
```

Use consistent:

* spacing
* typography
* border radius
* colors
* icons

---

# 68. ACCESSIBILITY

Support:

* readable font sizes
* screen readers where possible
* proper button labels
* sufficient touch target size
* contrast
* English/Tamil text resizing

---

# 69. DO NOT BUILD THESE FEATURES YET

Do NOT waste development time on:

* custom LLM
* RAG
* chatbot
* resume AI
* AI interview
* blockchain
* cryptocurrency
* complex escrow
* video calling
* social media feed
* nationwide scaling infrastructure
* Kubernetes
* unnecessary microservices

Focus on NearHire's core marketplace.

---

# 70. FINAL V1 USER FLOW

```text
Launch App
      ↓
Choose Language
      ↓
Phone OTP
      ↓
Basic Profile
      ↓
What do you want to do?
    ↙              ↘
Find Work        Post Work
    ↓              ↓
Residential     Residential
or              or
Business        Business
    ↓              ↓
Preferences      Job Form
    ↓              ↓
Nearby Jobs      Publish
    ↓              ↓
Apply          Active for 24h
    ↓              ↓
Employer reviews applicant
         ↓
       Accept
         ↓
       Filled
         ↓
     In Progress
         ↓
      Completed
         ↓
       Rating
```

---

# 71. WORK IN PHASES

Implement in this exact order.

## PHASE 1 — REPOSITORY AUDIT

* inspect
* run
* document
* preserve useful work

## PHASE 2 — PROJECT FOUNDATION

* structure
* TypeScript cleanup
* environment configuration
* linting
* formatting
* shared types

## PHASE 3 — DATABASE

* migrations
* PostGIS
* schema
* indexes
* RLS
* seed data

## PHASE 4 — AUTH + LANGUAGE

* language selection
* OTP
* sessions
* onboarding

## PHASE 5 — PROFILE

* basic profile
* work preferences
* categories
* availability
* languages

## PHASE 6 — JOB POSTING

* residential form
* business form
* draft
* publish
* validation

## PHASE 7 — 24-HOUR JOB EXPIRY

* expires_at
* scheduled expiry
* query-level safety
* expired history
* repost

## PHASE 8 — LOCATION

* permission
* GPS
* autocomplete
* geocoding
* MapLibre
* PostGIS
* distance

## PHASE 9 — DISCOVERY

* list
* map
* filters
* ranking
* pagination

## PHASE 10 — APPLICATIONS

* apply
* withdraw
* accept
* reject
* fill job
* contact unlock

## PHASE 11 — COMPLETION + RATINGS

* in progress
* completed
* ratings
* reviews

## PHASE 12 — SAFETY

* reports
* blocks
* moderation

## PHASE 13 — NOTIFICATIONS

* FCM
* device tokens
* event notifications

## PHASE 14 — PAYMENTS + CREDITS

* 5 free posts
* ₹10 architecture
* Razorpay
* webhook
* credit ledger

## PHASE 15 — ADMIN

* admin auth
* dashboard
* moderation
* analytics
* payments

## PHASE 16 — TESTING

* unit
* integration
* E2E
* security
* edge cases

## PHASE 17 — DEPLOYMENT

* Supabase
* Vercel
* EAS
* Android AAB
* docs

---

# 72. AFTER EACH PHASE

After completing each phase:

1. Run lint.
2. Run TypeScript checks.
3. Run available tests.
4. Fix failures.
5. Confirm existing functionality still works.
6. Update docs if architecture changed.
7. Commit logically if Git is available.

Do NOT knowingly leave broken builds while moving forward.

---

# 73. NEVER FAKE COMPLETION

Do not claim something works if:

* credentials are missing
* tests failed
* build failed
* backend isn't configured

Instead clearly mark:

```text
IMPLEMENTED — credentials required

or

BLOCKED — external credential required
```

Provide exact setup instructions.

---

# 74. DO NOT USE FAKE DATA IN PRODUCTION LOGIC

Mock data may be used only in:

* development
* story/demo mode
* testing

Production screens must read from real backend data.

---

# 75. FINAL QUALITY CHECK

Before declaring completion verify:

## MOBILE

* application boots
* language works
* OTP works or setup documented
* profile works
* Find Work works
* Post Work works
* map works
* nearby jobs work
* applications work
* expiry works
* repost works
* ratings work
* reports work
* notifications architecture works
* payment architecture works

## BACKEND

* migrations reproducible
* RLS enabled
* PostGIS working
* expiry reliable
* credits protected
* payments verified server-side
* secrets secure

## ADMIN

* protected
* users visible
* jobs visible
* moderation works
* analytics works

## BUILD

* lint passes
* type check passes
* tests pass
* Android build succeeds
* admin production build succeeds

---

# 76. FINAL DELIVERABLE

At the end, provide a detailed deployment readiness report:

```text
NEARHIRE PRODUCTION READINESS

Mobile App: READY / PARTIAL / BLOCKED

Admin Dashboard: READY / PARTIAL / BLOCKED

Supabase Backend: READY / PARTIAL / BLOCKED

PostGIS: READY / PARTIAL / BLOCKED

Authentication: READY / PARTIAL / BLOCKED

Map System: READY / PARTIAL / BLOCKED

Notifications: READY / PARTIAL / BLOCKED

Razorpay: READY / PARTIAL / BLOCKED

Testing: PASS / FAIL

Android Build: PASS / FAIL

Admin Build: PASS / FAIL
```

For every PARTIAL/BLOCKED item explain exactly what remains.

Also provide:

## Required credentials

## Deployment commands

## Remaining manual steps

## Production checklist

---

# 77. IMPORTANT EXECUTION BEHAVIOUR

Do not repeatedly ask me what to do next.

Make reasonable professional engineering decisions.

Do not stop after creating folders.

Do not stop after generating UI screens.

Do not stop after creating Supabase tables.

Continue through the implementation until the application reaches the strongest deployable state possible.

Whenever something fails:

1. inspect the error
2. identify root cause
3. fix it
4. rerun
5. verify

Do not simply bypass errors.

---

# FINAL OBJECTIVE

Turn the existing NearHire demo into:

> **A real, secure, full-stack, Android-first hyperlocal employment marketplace that can be deployed, tested with real users, submitted to Google Play, and later expanded into NearHire AI.**

The final product must feel like a startup application, not a hackathon project.

Begin by inspecting the existing repository and writing `docs/current-state-analysis.md`, then proceed through the implementation phases without waiting for further instructions unless an external credential or unavoidable dependency truly prevents progress.
