# NearHire development UI review

APK build is paused until explicit UI approval. Open http://localhost:8093.

The 25-screen development gallery uses shared live controls and translations with presentation fixtures. It never imports auth/services, creates sessions, writes backend records or changes credits. Only MapTiler map assets are requested externally. The Developer info panel explains fixtures and switches between 5 and 0 credits. Release exports exclude the gallery; production navigation stays separate.

## Starting the preview

From apps/mobile, set EXPO_PUBLIC_UI_PREVIEW=true and EXPO_PUBLIC_DEMO_MODE=false in the current shell. Load EXPO_PUBLIC_MAP_STYLE_URL from the external client configuration, then run:

```powershell
npx expo start --web --port 8093 --localhost
```

The current launcher reads C:\PROJECTS\NEARHIRE-SECRETS\maptiler-client.env without displaying its key. The key is a temporary development client credential and must be rotated/restricted before production. Never copy credentials into committed source. No EAS build or new Expo project is needed for review.

## Web map

JobMap.web.tsx and LocationPin.web.tsx use MapLibre GL JS 6 with the configured style. Native MapLibre is preserved. Metro copies the installed package's ESM worker and shared module to ignored public/maplibre assets and exposes the monorepo shared package directory. map-worker.web.ts sets the local worker URL. These files are also copied into web exports, so deployments must serve the maplibre directory from the site root.

The map supports pan, zoom, approximate job markers, selection cards, and a movable/clickable work-location pin. Provider errors show a retry state; absent configuration shows an explicit configuration message. Normal screens display locality, never coordinate inputs. Live raw-coordinate diagnostics require development mode and explicit expansion. Selecting a map viewport does not confirm a location; the user must choose a point and confirm its locality. Exact addresses remain governed by existing acceptance/RLS rules.

The preview uses Anna Nagar fixtures and locally filters them; those distances and expiry labels are presentation examples, not a live PostGIS result. Native GPS, OTP, FCM and accepted-worker access still require real integration/device testing.

## Credits

JobCreditBalance is shared between preview and live mode, used for the full Profile wallet only (see the September 10 refinement below). Live reads use job_credits.balance and the latest 30 own credit_transactions under existing RLS. The ledger labels signup grants, purchases and publishing charges; the database does not separately track remaining free versus purchased credits, so the UI does not invent a split.

One credit per publication matches publish_job's atomic debit. Client estimates are display-only; create/publish/repost remain existing RPCs. Zero balances disable confirmation and link to credits. Failed balance requests show an unavailable/retry state, not a fake zero. Query invalidation refreshes credit data after mutations. No migration or credit write API was added.

Purchasing is hidden by default. EXPO_PUBLIC_PAYMENTS_ENABLED=true is only an optional future UI visibility flag; it does not enable the server. The existing PAYMENTS_ENABLED server guard, pricing packages and Razorpay configuration remain authoritative. This review did not enable payments. Workers see that finding and applying for jobs is free. Initial signup credits remain driven by pricing_config.free_post_limit.

## Checks

Run npm run check, npm run lint, npm test, and npm --prefix apps/mobile run build:web from the root. The browser test is node --test tests/ui-preview.cjs with Playwright installed/resolvable (NODE_PATH can point to a tooling installation), Edge installed and the preview running. PREVIEW_URL can override the URL.

Tests cover all screens in English/Tamil, 5/0 balances, one-credit confirmation copy, 360/390/412px overflow, hidden coordinate inputs, real map loading/marker/pin interactions, explicit map failure and no backend HTTP requests. Provider resources are allowed only from api.maptiler.com. A production export also includes locally hosted worker assets. Browser map validation does not establish native GPS/MapLibre/FCM success.

## September 10 refinement: custom distance and Profile wallet

Search distance accepts every integer from 1 to 50 km (default 3 km). DistanceControl uses touch-sized minus/plus buttons and an accessible numeric input. Invalid drafts show validation feedback and do not replace the last valid search. radius-logic converts kilometres to metres; services validate metres before RPC calls. nearby_jobs also rejects null, out-of-range and non-1000-multiple radii, preserving indexed ST_DWithin, existing coarsened match scoring, privacy projection, throttling and 20-row pagination.

Migration 202609100001_custom_search_radius.sql replaces only the discovery RPC and worker preference radius constraint. Prior migrations were not edited. It has been applied to mxsltkyebhboaglbspse; all seven local/hosted versions agree. The hosted smoke test uses a transaction and rolls all changes back. It verifies 1/3/10/17/50 km, invalid radii, row limits, the geography index and privacy. Local real-PostGIS tests additionally cover 17/50 km inclusion/exclusion and wide-radius pagination.

The selected Jobs radius is held in the live app navigation state, so leaving and returning retains it. On login it loads the existing saved worker preference; Work Preferences can persist a new radius through the existing save_preferences RPC. No location history was added. Notification publication fanout retains its existing separate 5 km cap; this change expands discovery, not notification volume.

Home now shows only CreditBalanceChip at the top-right. It opens the Profile → Job Credits subpage directly. Full wallet cards were removed from Home and Post Work. Post Work displays compact one-credit cost copy near Publish and a zero-credit link to the same subpage. The confirmation shows a balance estimate without embedding a wallet card. All live credit observers share creditBalanceKey and refresh via existing mutation invalidation. Credit authority remains in SQL.

The DEV gallery uses one fixture balance for chip and wallet; its simulated publication decrements that fixture only, never a backend account. Developer info can reset 5/0 states. Browser tests verify direct navigation, 5→4 refresh, zero-credit navigation, 17 km retention, invalid-distance feedback and English/Tamil layouts at 360/390/412px.

Validation commands additionally include npm run test:db and npx supabase db query --linked --file tests/hosted-radius-smoke.sql. The APK remains unbuilt pending explicit UI approval.


## Map-first review — September 10, 2026

DiscoverySurface is shared by live Jobs and the DEV gallery. The map fills available space above existing navigation. Floating count/search/locality controls, horizontal All/Business/Residential chips, filter sheet (custom 1–50 km radius and existing advanced filters), map/list switch and recenter replace the stacked map layout. Existing detail/application/bookmark/report actions are retained.

Counts represent loaded, filtered, unexpired map results, not a database-wide total. Existing PostGIS pagination uses 20 rows with Load more in list mode. Rendering is capped at 100 markers. Clustering is deferred: the native Marker and web DOM Marker implementations need a coordinated source/layer conversion. Nearby search architecture and privacy are unchanged.

Green normal pins and red urgent pins are independent of category; selected pins enlarge without changing color. No yellow job markers remain. User location retains purple. The backend has no urgent-hiring field, so real jobs are green; red is demonstrated only by DEV fixtures. No backend urgency field or migration was invented.

Location selection has its own full map, pin, search/GPS controls and locality/private-address confirmation sheet. Provider errors retain manual pin selection. The picker has no job markers. DEV posting opens an isolated presentation picker with no backend writes. White/purple branding, Home credit chip, Profile credits, auth, payments and bottom navigation are unchanged. Profile screenshots were not used for a profile redesign.

Validation passed: mobile/admin TypeScript, ESLint, 20 mobile/unit tests, 2 localization tests, 3 browser tests and production web export. Browser tests cover all 25 gallery screens, English/Tamil, 360/390/412px widths, map height, semantic/selected pins, filtering, radius persistence, map/list, recenter, credits and failure/retry. Production export excludes the DEV gallery. This map-layout pass does not modify database code; prior PostGIS verification is documented above.

Preview: http://localhost:8093. Command: npx expo start --web --port 8093 --localhost, with DEV preview flag and external MapTiler client configuration. Hot reload is active. Clustering and native rendering/GPS/device safe-area verification remain deferred. No APK built; wait for UI APPROVED — BUILD APK.

## Two workspaces — September 10, 2026

The current DEV entry is WorkspacePreview. Choose Find work or Post work; a separate DEV Onboarding action demonstrates Language -> phone -> code -> basic profile -> workspace choice using presentation fixtures. DEV Screens retains the earlier isolated screen gallery for inspection; its old Home is not the current application's daily entry.

LiveApp keeps the existing React state navigation framework. Find tabs are Jobs, Applications, Saved, Updates, Profile. Post tabs are Nearby Workers, My Posts, Applicants, Updates, Profile. Each activity tab initializes its existing server activity mode directly. Profile opens an account overview, with Edit Profile, Job Credits, work preferences, settings, activity shortcuts and a Find/Post switch. The full credit wallet and transaction history remain under Profile. Post mode has the compact credit shortcut and a Post a Job action followed by Residential/Business choice. No payments were enabled.

Workspace is a UI preference on the same profile (profiles.last_workspace), saved by set_workspace and restored after the existing session/profile load. It is not an authorization role. No new accounts, sessions, or duplicated profiles are created. DEV uses its own nearhire.dev.workspace storage namespace. The live job and worker surfaces remain mounted across tabs so each retains its own map/list, search and radius state. Back from account subpages goes to Profile, and Back from tabs returns to the current workspace, without switching modes. Native modal dismissals retain their existing handlers.

### Worker discovery privacy

Migration 202609100002_workspaces_worker_discovery.sql adds discoverable_for_hire=false to worker_profiles, reuses the existing available field and private.worker_locations, and adds set_worker_discovery and nearby_available_workers. Consent is distinct from push-alert enrollment and can be revoked in Work Preferences. Enabling uses the user's chosen GPS permission; the RPC also validates coordinates. No existing user was opted in by migration.

Worker discovery requires an authenticated, unsuspended actor; only opted-in, available, visible, unblocked, unsuspended workers with a location updated within 30 days appear. Exact GPS, phone, address and last-seen timestamp are never returned. Coordinates are rounded to 0.01 degrees BEFORE spatial filtering, ordering and distance measurement; distances are rounded upward to 500m. A GiST expression index covers the coarsened geography, preventing exact-coordinate radius membership probes. Responses have an explicit ten-field allowlist. Radius accepts integer 1–50 km, pages contain 20 rows with deterministic tie ordering, and queries are rate-limited. Nearby jobs still use the unchanged nearby_jobs RPC.

The migration was applied through Supabase db push after a dry run confirmed it was the only pending migration. All eight local/hosted migrations matched afterward on mxsltkyebhboaglbspse. No fixture rows were inserted into hosted Supabase. Worker fixtures exist only in the DEV entry. Worker markers use purple avatars, distinct from green/red job urgency pins. Live jobs remain green until a real backend urgency field exists.

The worker map/list exposes loaded results rather than a global live-user count. It describes availability, never online presence. Rendering is capped at 100 markers; additional pages are available through the list. Clustering remains deferred. Profile uses an avatar placeholder because photo uploading is not part of the existing profile editor; server-controlled ratings, verification, IDs and credits are never editable. No fake rating is displayed on a live account.

Validation includes 23 mobile/unit tests, 2 localization tests, 31 database/PostGIS scenarios, workspace and legacy-gallery browser checks, mobile/admin TypeScript, ESLint, production web export and a credential scan. Edge Functions were not changed. Device back handling, native GPS and native MapLibre rendering still require later physical Android checks. The DEV preview does not bypass Supabase authentication/RLS or write fixture data to production.

Preview URL: http://localhost:8093. Launch uses the existing external map configuration with npx expo start --web --port 8093 --localhost and the DEV preview flag. APK remains NOT BUILT, pending explicit UI APPROVED — BUILD APK.

## Compact panels and current-location shortcut — September 10, 2026

The Post Work floating panel now uses compact title/locality/status rows and a 44px Post Job action alongside Map/List. The status/filter control opens the existing 1–50 km distance sheet. Find Work combines status and locality/map-list controls; search remains in its filter sheet. Colors, typography system, workspace routes, credits, Firebase and database schema are unchanged.

Normal workspace headers no longer contain English/Tamil or DEV Screens buttons. Language remains available during onboarding and in Profile -> Settings; the DEV preview stores language in its own namespace. The small DEV header control opens a development-only menu, including the old screen gallery. Production App gating excludes this entire preview branch.

CurrentLocationControl requests a fresh device position, displays a spinner and accessible loading label, and gates duplicate taps. When permission has not been requested it first shows the existing NearHire explanation. Web uses navigator.geolocation only in device-location.web.ts, with secure-context/support checks, a 15s timeout and sanitized denied/unavailable/timeout messages. Native device-location.ts reuses Expo Location permission/service checks and the bounded position request; permanent denial offers Open Settings. The existing locationService.gps delegates to the same platform helper, avoiding a second implementation/library. Errors offer retry and manual location selection; selecting the manual fallback clears the shortcut error.

Successful location requests update the workspace origin/user marker without resetting filters or radius. Live Find Work reuses nearby_jobs and Post Work reuses nearby_available_workers with the new origin. Previous query data remains visible while the replacement query loads. Ordinary camera pans do not change the query origin or call RPCs. Optional reverse geocoding is not required for this shortcut; without it the label becomes Current location rather than retaining a stale locality.

Native CameraRef.easeTo({center,zoom:13,duration:700}) uses the installed MapLibre 11.3.9 API. Web retains Map.easeTo at neighborhood zoom. The location control is 44x44 and sits above attribution at the bottom-right. Worker discovery retains purple avatar markers; job urgency colors remain green/red. No production credentials or backend data were added to the preview.

Validation passed: mobile/admin TypeScript, ESLint, web export, 23 mobile/unit tests, 2 localization tests, 31 database/PostGIS scenarios and 5 browser suites. Browser coverage includes success/recenter coordinates, duplicate-tap loading gate, denied/timeout/unsupported geolocation, manual fallback, retained radius, header language removal, DEV menu, Settings language switching and 360/390/412px layouts. Browser GPS is controlled test input; native GPS/permission behavior must still be checked on a physical Android device. No APK build was run.

Preview restarted at http://localhost:8093 with the existing external map configuration and npx expo start --web --port 8093 --localhost. Hot reload remains active. APK: NOT BUILT; UI approval is still required.
