# Open map architecture

MapLibre React Native renders mobile maps; MapLibre GL JS renders web maps. MapLibre is a library, not a tile service. The MVP basemap is keyless OpenFreeMap Liberty, using OpenMapTiles and OpenStreetMap data.

All four map surfaces share MapProviderConfig in location-logic.ts: styleURL, providerName, attribution. MapTiler is no longer required. Legacy EXPO_PUBLIC_MAP_STYLE_URL is not read, so stale EAS values cannot activate it. External credential files are preserved. No MapTiler SDK is installed.

For future custom hosting set BOTH EXPO_PUBLIC_BASEMAP_STYLE_URL (HTTPS) and EXPO_PUBLIC_BASEMAP_ATTRIBUTION. Leave empty for OpenFreeMap. Serve reachable style JSON, TileJSON/vector tiles, glyphs and sprites with CORS and correct licenses/source attribution. Never put private credentials in public configuration. MapTiler and public OSM tile hosts are rejected as overrides.

Future: MapLibre → NearHire regional OpenMapTiles/vector endpoint/CDN. No screens need changing. PMTiles requires an HTTP tile adapter compatible with both renderers or separately validated protocol support; raw PMTiles URLs are not a drop-in native replacement. Nothing is self-hosted now. Monitor OpenFreeMap availability and prepare owned infrastructure as scale demands.

PostGIS remains authoritative for nearby jobs/workers, matching and 1–50 km radius. Database, indexes and RLS are unchanged. Maps consume existing approximate discovery positions. Provider requests fetch viewport tiles, never job/worker records. Existing capped markers are preserved; no new clustering or excessive native marker allocation.

GPS is Expo Location/device services, browser geolocation on web. Pin confirmation works when optional reverse geocoding fails. Address search remains behind the separate LocationSearchProvider/Edge Function. Ola code is retained; its credential remains blocked. No Nominatim substitution or paid routing was added. External directions remain unchanged.

Web attribution is expanded; native maps add a visible attribution footer alongside provider controls. Official setup: https://openfreemap.org/quick_start/.

## Preview and device checklist
From apps/mobile set EXPO_PUBLIC_UI_PREVIEW=true and EXPO_PUBLIC_DEMO_MODE=false, then run npx expo start --web --port 8095 --localhost. No map key is needed. DEV fixtures do not write backend data. Check Find/Post maps, pan/zoom, green normal/red urgent markers, radius, Map/List state, GPS permissions and pin confirmation. Test Android performance and GPS on a real phone.

NEW DEVELOPMENT BUILD REQUIRED for earlier native authentication changes. No EAS build is submitted by this migration.

## Migration validation

35 mobile/map/marketplace/auth tests, 2 localization tests and 54 database/PostGIS scenarios passed (91 total). TypeScript, ESLint, web export and admin build passed. OpenFreeMap style, raster/vector sample tiles, glyphs and sprite JSON/PNG returned HTTP 200. Web Find/Post maps, visible attribution, pan/zoom, worker list and manual pin confirmation were reviewed. Browser GPS timed out with a recoverable manual-location fallback; real GPS and native rendering remain DEVICE TEST REQUIRED. Tracked source/web export credential scans found no secrets or old MapTiler key. No backend deployment or EAS build was performed.
