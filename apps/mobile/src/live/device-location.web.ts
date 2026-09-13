import { coordinates } from "./location-logic";
export async function needsLocationExplanation() {
  if (!globalThis.isSecureContext || !navigator.geolocation) return false;
  try {
    return (await navigator.permissions.query({ name: "geolocation" })).state === "prompt";
  } catch {
    return true;
  }
}
export async function deviceLocation() {
  if (!globalThis.isSecureContext || !navigator.geolocation)
    throw new Error("LOCATION_UNAVAILABLE");
  return new Promise<ReturnType<typeof coordinates>>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        try {
          resolve(coordinates(p.coords.latitude, p.coords.longitude));
        } catch {
          reject(new Error("LOCATION_UNAVAILABLE"));
        }
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
      { enableHighAccuracy: false, maximumAge: 0, timeout: 15000 },
    );
  });
}
