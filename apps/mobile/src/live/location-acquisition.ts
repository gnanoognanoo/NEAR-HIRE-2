import { coordinates, boundedLocation, type Position } from "./location-logic.ts";
export type DeviceFix = {
  coords: { latitude: number; longitude: number; accuracy: number | null };
  timestamp: number;
};
type Permission = { status: string; canAskAgain: boolean; approximate?: boolean };
export const MAX_CACHE_AGE = 120000;
export const MAX_CACHE_ACCURACY = 1000;
export function fixPosition(
  fix: DeviceFix,
  cached: boolean,
  approximate = false,
  now = Date.now(),
): Position {
  const age = now - fix.timestamp,
    accuracy = fix.coords.accuracy;
  cached = cached || age > 15000;
  if (
    !Number.isFinite(fix.timestamp) ||
    age < -10000 ||
    age > MAX_CACHE_AGE ||
    (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) ||
    (cached && (accuracy === null || accuracy > MAX_CACHE_ACCURACY))
  )
    throw new Error("LOCATION_UNAVAILABLE");
  return {
    ...coordinates(fix.coords.latitude, fix.coords.longitude),
    source: cached || age > 15000 ? "cached" : "live",
    timestamp: fix.timestamp,
    accuracy: accuracy ?? undefined,
    approximate: approximate || accuracy === null || accuracy > 100,
  };
}
/** Shared across entry points; one foreground request, cancelled on completion/timeout. */
export function createLocator(deps: {
  permission: () => Promise<Permission>;
  requestPermission: () => Promise<Permission>;
  services: () => Promise<boolean>;
  fresh: (approximate: boolean) => { promise: Promise<DeviceFix>; cancel: () => void };
  cached: () => Promise<DeviceFix | null>;
  timeout?: number;
}) {
  let pending: Promise<Position> | null = null;
  async function acquire() {
    let permission = await deps.permission();
    if (permission.status !== "granted" && permission.canAskAgain)
      permission = await deps.requestPermission();
    if (permission.status !== "granted")
      throw new Error(
        permission.canAskAgain ? "LOCATION_PERMISSION_DENIED" : "LOCATION_PERMISSION_PERMANENT",
      );
    if (!(await deps.services())) throw new Error("GPS_DISABLED");
    const fresh = deps.fresh(!!permission.approximate);
    try {
      return fixPosition(
        await boundedLocation(fresh.promise, deps.timeout ?? 20000),
        false,
        permission.approximate,
      );
    } catch (error) {
      fresh.cancel();
      if (/^LOCATION_PERMISSION_/.test((error as Error).message)) throw error;
      // Never fall back after a revoked permission or disabled GPS.
      const current = await deps.permission();
      if (current.status !== "granted")
        throw new Error(
          current.canAskAgain ? "LOCATION_PERMISSION_DENIED" : "LOCATION_PERMISSION_PERMANENT",
        );
      if (!(await deps.services())) throw new Error("GPS_DISABLED");
      try {
        const cached = await boundedLocation(deps.cached(), 3000);
        if (cached) return fixPosition(cached, true, current.approximate);
      } catch {
        /* No stale, unbounded or unknown-accuracy cache substitution. */
      }
      throw error;
    } finally {
      fresh.cancel();
    }
  }
  return () => {
    if (!pending)
      pending = acquire().finally(() => {
        pending = null;
      });
    return pending;
  };
}
export function locationStatus(p: Position, t: (k: string) => string) {
  const label = t(
    p.source === "cached"
      ? p.approximate
        ? "cachedApproximateLocation"
        : "cachedLocation"
      : p.approximate
        ? "approximateLocation"
        : p.source === "live"
          ? "currentLocation"
          : "selectedLocation",
  );
  return p.accuracy === undefined ? label : label + " · ±" + Math.ceil(p.accuracy) + " m";
}
