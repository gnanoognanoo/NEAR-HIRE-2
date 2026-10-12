# NearHire Premium Soft UI

The release redesign applies to `ProductionApp` and `src/live`; it is not a replacement demo. The app retains actual Supabase data, its current navigation, authentication and posting controllers, wallet entitlements, native Razorpay TEST checkout, GPS, MapLibre/OpenFreeMap, PostGIS and notifications. No database migration, dependency, package ID or EAS project change is needed.

## Design system

`neo-tokens.ts` centralizes the blue-grey canvas, soft surface, purple brand, spacing, semantic state colors and platform shadow fallback. Primary and secondary body text, brand labels, positive/error/warning badges meet 4.5:1 contrast; input boundaries meet 3:1. System fonts and generous line heights support Tamil and dynamic text. Cards use 24dp corners and controls use 16dp corners, with 48dp touch targets (compact existing map targets remain at least 44dp).

`ui.tsx` supplies NeoSurface, NeoCard, NeoButton, NeoIconButton, NeoInput, NeoChip, NeoSegmentedControl, NeoHeader, NeoBottomNavigation, NeoModal, NeoBottomSheetSurface, NeoStatusBadge, NeoFeedback, NeoNavRow, NeoToggle and NeoOptionPicker. Existing Button/Choice/Field imports use the same design system. Selection uses both visible marks/outlines and accessibility states; inputs have clear focus and inline-error boundaries. A single NeoThemeProvider observes reduced-motion preferences. Press feedback is immediate, with a bounded 90ms transform only when motion is permitted, and never delays the action.

The installed Expo 57 / React Native 0.86 supports boxShadow. Android 9+ supports outset shadows; inset shadows require Android 10+. Android 7/8 use low elevation and highlight/border fallbacks; Android 9 uses a border fallback for inset controls. The native runtime does not gain any new native module. See [React Native shadow support](https://reactnative.dev/docs/0.86/view-style-props#boxshadow).

## Live screen coverage

- Branding, language selection, Google/phone login and OTP: soft header/welcome, tactile sign-in, recessed inputs and semantic feedback. OAuth/OTP authority and transports unchanged.
- Find Work / nearby workers: small floating surfaces, location selector, icon controls, filter sheets, softer list cards and no-location state. Marker colors and geometry, attribution, privacy and nearby query rules unchanged.
- Post Work: compact category picker, grouped work/pay/schedule/location/details fields, strong urgent toggle, inline validation and premium review. All field names, request IDs, draft persistence, credit cost and publication callbacks unchanged.
- Job detail: compensation surface, location/schedule hierarchy, skill/language tags, urgency and status badges; only public fields rendered.
- Posts, applications, updates, reports, profile, preferences/settings/security and account screens inherit the shared card/button/input/modal styles. Profile has a soft avatar and navigation rows; nested screens retain their parent tab treatment.
- Job Credits: server-priced ₹9/₹39/₹69 radio packages, selection marks, balance, credit breakdown, transaction cards and distinct pending/failure/success presentation. Configuration loading does not falsely announce that purchases are disabled. The existing native Razorpay checkout is unchanged.

## Validation and delivery

Run root TypeScript, ESLint, mobile/localization tests and actual database/PostGIS regressions. The design tests check readable contrast, semantic colors and supported Android fallbacks. Edge Function checks/tests, web/admin builds, Android/Hermes export, public Expo config, runtime fingerprint and private-credential scan protect the existing integration.

Browser review uses the real live application and an existing dedicated TEST account. No job publication or checkout is performed for screenshots. Responsive review covers 360/390/412px and a larger width, both English and Tamil, visible control geometry, focus/selection, sheets and navigation. Review images are saved outside the Git repository. The current Preview APK remains standalone and uses the existing `preview` EAS Update channel.

Native Android shadows, real keyboard/gesture insets, font scaling/Tamil glyph rendering, GPU frame rates, GPS permission UX, FCM and native checkout must still be reviewed on an actual phone; web checks are not reported as physical-device validation. This release requires no new APK when the fingerprint matches the existing distributed runtime.
