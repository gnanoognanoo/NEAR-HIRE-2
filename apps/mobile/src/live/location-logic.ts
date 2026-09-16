export type Position = {
  latitude: number;
  longitude: number;
  label?: string;
  locality?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  formatted_address?: string;
};
export function coordinates(latitude: unknown, longitude: unknown): Position {
  if (
    (typeof latitude === "string" && latitude.trim() === "") ||
    (typeof longitude === "string" && longitude.trim() === "") ||
    latitude == null ||
    longitude == null ||
    typeof latitude === "boolean" ||
    typeof longitude === "boolean"
  )
    throw new Error("INVALID_LOCATION");
  const lat = Number(latitude),
    lng = Number(longitude);
  if (!Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180)
    throw new Error("INVALID_LOCATION");
  return { latitude: lat, longitude: lng };
}
export function activeNearby<T extends { job: { id: string; status: string; expires_at: string } }>(
  rows: T[],
  now = Date.now(),
): T[] {
  const seen = new Set<string>();
  return rows.filter(
    (r) =>
      r.job.status === "active" &&
      Date.parse(r.job.expires_at) > now &&
      !seen.has(r.job.id) &&
      !!seen.add(r.job.id),
  );
}
export function mapStyleUrl(value?: string) {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || /demotiles\.maplibre\.org|demotiles/.test(u.hostname))
      return null;
    return value;
  } catch {
    return null;
  }
}
export function locationErrorKey(e: unknown) {
  const code = (e as { message?: string })?.message || "";
  return (
    (
      {
        LOCATION_PERMISSION_DENIED: "locationDenied",
        LOCATION_PERMISSION_PERMANENT: "locationPermanent",
        GPS_DISABLED: "gpsDisabled",
        LOCATION_TIMEOUT: "gpsTimeout",
        INVALID_LOCATION: "invalidLocation",
        LOCATION_RATE_LIMIT: "locationRateLimit",
      } as Record<string, string>
    )[code] || "locationUnavailable"
  );
}
export async function boundedLocation<T>(p: Promise<T>, ms = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("LOCATION_TIMEOUT")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
/** Basemap only: business data stays in PostGIS. */
export interface MapProviderConfig {
  styleURL: string;
  providerName: string;
  attribution: string;
}
export const OPEN_MAP: MapProviderConfig = {
  styleURL: "https://tiles.openfreemap.org/styles/liberty",
  providerName: "OpenFreeMap",
  attribution: "OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors",
};
export function resolveMapProvider(style?: string, attribution?: string): MapProviderConfig {
  const url = mapStyleUrl(style);
  if (!url || !attribution?.trim()) return OPEN_MAP;
  const host = new URL(url).hostname;
  if (/(^|\.)(maptiler\.com|openstreetmap\.org)$/.test(host)) return OPEN_MAP;
  return { styleURL: url, providerName: "Custom basemap", attribution: attribution.trim() };
}
export function configuredMapProvider(): MapProviderConfig {
  return resolveMapProvider(
    process.env.EXPO_PUBLIC_BASEMAP_STYLE_URL,
    process.env.EXPO_PUBLIC_BASEMAP_ATTRIBUTION,
  );
}
