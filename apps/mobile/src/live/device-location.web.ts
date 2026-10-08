import { createLocator, type DeviceFix } from "./location-acquisition";
let cache: DeviceFix | null = null;
export async function needsLocationExplanation() {
  if (!globalThis.isSecureContext || !navigator.geolocation) return false;
  try {
    return (await navigator.permissions.query({ name: "geolocation" })).state === "prompt";
  } catch {
    return true;
  }
}
export const deviceLocation = createLocator({
  permission: async () => {
    if (!globalThis.isSecureContext || !navigator.geolocation)
      throw new Error("LOCATION_UNAVAILABLE");
    try {
      const p = await navigator.permissions.query({ name: "geolocation" });
      return { status: p.state === "denied" ? "denied" : "granted", canAskAgain: false };
    } catch {
      return { status: "granted", canAskAgain: true };
    }
  },
  requestPermission: async () => ({ status: "granted", canAskAgain: true }),
  services: async () => true,
  fresh: () => {
    let stopped = false;
    const promise = new Promise<DeviceFix>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          if (stopped) return;
          cache = { coords: p.coords, timestamp: p.timestamp };
          resolve(cache);
        },
        (e) =>
          reject(
            new Error(
              e.code === 1
                ? "LOCATION_PERMISSION_DENIED"
                : e.code === 3
                  ? "LOCATION_TIMEOUT"
                  : "LOCATION_UNAVAILABLE",
            ),
          ),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 18000 },
      );
    });
    return {
      promise,
      cancel: () => {
        stopped = true;
      },
    };
  },
  cached: async () => cache,
});
