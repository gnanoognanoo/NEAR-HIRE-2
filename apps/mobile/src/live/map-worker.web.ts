import { setWorkerUrl } from "maplibre-gl";
// Same-origin ESM worker and shared module are copied by metro.config.js.
// No credentials are embedded in these static assets.
if (typeof window !== "undefined") {
  setWorkerUrl(new URL("/maplibre/maplibre-gl-worker.mjs", window.location.origin).href);
}
