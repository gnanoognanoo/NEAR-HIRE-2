# Deployment runbook

Do not launch to real users until the readiness report's release blockers are closed. Never place server secrets in an EXPO_PUBLIC or NEXT_PUBLIC variable.

## 1. Local prerequisites

Install Node 22 LTS+, Git, and Docker Desktop for the full local Supabase stack. Android local compilation also requires a supported JDK and Android SDK; a JRE alone is insufficient. EAS cloud builds are the alternative.

```powershell
cd "C:\PROJECTS\NEAR HIRE"
npm ci
npm --prefix apps/mobile ci
npm --prefix apps/admin ci
npx supabase start
npx supabase db reset
```

Local test phone numbers and OTPs are declared only in `supabase/config.toml`. Never configure those test OTPs in hosted production. The category catalog ships through migration 004.

## 2. Create and link Supabase

Create separate development/staging and production projects in your Supabase account. Choose the appropriate region. Save the database password securely.

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Verify the extensions, table policies, and `nearhire-expire` cron job. Migrations create private Storage buckets and policies. Run a two-account staging smoke test before exposing data.

## 3. Mobile environment

Create `apps/mobile/.env` with the public project URL/key, optional tile style URL, and privacy policy URL. Set `EXPO_PUBLIC_DEMO_MODE=false`. Restart Expo after changing environment values.

```text
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
EXPO_PUBLIC_DEMO_MODE=false
EXPO_PUBLIC_MAP_STYLE_URL=https://YOUR_LICENSED_PROVIDER/style.json
EXPO_PUBLIC_PRIVACY_POLICY_URL=https://YOUR_DOMAIN/privacy
```

Configure phone Auth in Supabase with an SMS provider and test delivery to your actual region. Set the custom mobile redirect scheme to `nearhire`. Do not put SMS provider credentials in the mobile app.

## 4. Edge secrets and deployment

Create an ignored secrets file outside committed source with the names in `.env.example`. Supabase provides SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY to Edge Functions; configure external provider secrets yourself.

```powershell
npx supabase secrets set --env-file PATH_TO_PRIVATE_EDGE_ENV
npx supabase functions deploy location
npx supabase functions deploy payment-order
npx supabase functions deploy razorpay-webhook
npx supabase functions deploy notification-dispatch
npx supabase functions deploy delete-account
```

Functions configured without platform JWT verification perform their own authentication/signature checks. Do not remove those checks.

## 5. Maps

Provision Ola Maps for address search and set OLA_MAPS_API_KEY as an Edge secret. Configure a licensed MapLibre-compatible style/tiles endpoint in the mobile public environment. The key in a style URL is public: apply provider restrictions. Test autocomplete, details, reverse geocoding, manual locality selection, GPS denial, and tiles on a physical device. The server adapter interface allows replacing Ola without rewriting screens.

## 6. Firebase and push delivery

Create a Firebase Android app with package `app.nearhire.mobile`. Download `google-services.json` and keep it outside source control. Set the `GOOGLE_SERVICES_JSON` file path for app.config.js/EAS. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY as Edge secrets. Give the service account only the messaging permissions it needs.

Generate a random OUTBOX_SECRET. Store it in Edge secrets and Supabase Vault as `nearhire_outbox_secret`. Add `nearhire_functions_url` to Vault, then run `supabase/schedule-notifications.sql` in the SQL editor. Check both scheduled HTTP calls and the outbox on staging. Push tokens must come from native Android builds; Expo Go/web are not a substitute for FCM testing.

## 7. Razorpay

Start with test keys. Configure RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET and PAYMENTS_ENABLED on the Edge Functions. Keep PAYMENTS_ENABLED=false until deletion/accounting review and staging tests are complete.

Point a Razorpay `payment.captured` webhook to `https://YOUR_PROJECT_REF.supabase.co/functions/v1/razorpay-webhook`. Test valid signatures, altered payloads, wrong amounts, retries, duplicate events, and provider timeouts. Credits must appear only after the webhook settles the server order. Native checkout is wired; its return value alone never changes balance.

The packages are stored in `credit_packages`, in paise. Single-post price defaults to ₹10 and five signup credits. `admin_pricing` changes the free-credit limit for future accounts and single-credit price. There is no refund workflow yet.

## 8. Admin / Vercel

Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in `apps/admin/.env.local` locally and Vercel's environment settings for hosting. No service-role key is required by admin.

Create an admin Auth user through the dashboard and insert their UUID into `public.admin_users` using the SQL editor. Never let a client assign itself membership. Enforce MFA before launch.

```powershell
npm --prefix apps/admin run dev
npm --prefix apps/admin run build
```

Import your Git repository into Vercel with root directory `apps/admin`, Next.js framework, install command `npm ci`, and build command `npm run build`. Add a custom domain and verify HTTPS/cookies. The admin build can succeed without credentials, but protected pages then show setup-required, not data.

## 9. Android / EAS

The proposed package identifier is `app.nearhire.mobile`; confirm ownership before publishing. Replace template icons and provide approved splash/store artwork. `app.config.js` reads optional EAS_PROJECT_ID and GOOGLE_SERVICES_JSON.

```powershell
cd apps/mobile
npx eas-cli login
npx eas-cli init
npx eas-cli build:configure
npx eas-cli build --platform android --profile development
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
```

Configure matching public environment variables and the Firebase file in EAS before building. Build profiles are defined in `eas.json`. A production profile creates an AAB; this repository does not already contain a signed AAB.

## 10. Play Console and release smoke test

Create your app listing, publish privacy/account-deletion web pages, complete Data Safety and permission disclosures, upload screenshots/artwork, and use internal testing first. Do not claim listing approval or policy compliance based only on code generation.

On two physical Android devices: choose language → real OTP → profile → choose locality → post residential/business work → find nearby job → apply → accept → verify private contact unlock → fill/start → confirm completion twice → review. Then test blocks, reports, expiry/repost, push delivery, failed network requests, payment retry/idempotency, and deletion. Verify the same records and moderation actions in admin.

## References

- https://supabase.com/docs/guides/cli/local-development
- https://docs.expo.dev/versions/v57.0.0/
- https://docs.expo.dev/build/introduction/
- https://maplibre.org/maplibre-react-native/docs/setup/getting-started/
- https://razorpay.com/docs/webhooks/
