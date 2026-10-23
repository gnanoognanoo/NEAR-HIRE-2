import { LocationProviderError, type LocationSearchProvider } from "./provider.ts";
export function locationRequest(value: unknown, provider: LocationSearchProvider) {
  const p = value as Record<string, unknown> | null;
  if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("INVALID_LOCATION_QUERY");
  if ((p.action === "search" || p.action === "geocode") && typeof p.query === "string") {
    const query = p.query.trim().replace(/\s+/g, " ");
    if (query.length >= 3 && query.length <= 500) {
      const action = p.action;
      return {
        key: JSON.stringify([action, query]),
        action,
        operation: () => (action === "search" ? provider.search(query) : provider.geocode(query)),
      };
    }
  }
  if (p.action === "resolve" && typeof p.id === "string" && p.id.trim() && p.id.length < 500) {
    const id = p.id;
    return {
      key: JSON.stringify(["resolve", id]),
      action: "resolve",
      operation: () => provider.resolve(id),
    };
  }
  if (
    p.action === "reverse" &&
    typeof p.latitude === "number" &&
    Number.isFinite(p.latitude) &&
    Math.abs(p.latitude) <= 90 &&
    typeof p.longitude === "number" &&
    Number.isFinite(p.longitude) &&
    Math.abs(p.longitude) <= 180
  ) {
    const { latitude, longitude } = p;
    return {
      key: JSON.stringify(["reverse", latitude, longitude]),
      action: "reverse",
      operation: () => provider.reverse(latitude, longitude),
    };
  }
  throw new Error("INVALID_LOCATION_QUERY");
}
export function locationFailure(error: unknown) {
  const code = error instanceof LocationProviderError ? error.code : "LOCATION_UNAVAILABLE";
  return {
    code,
    status: code === "LOCATION_RATE_LIMIT" ? 429 : code === "LOCATION_NOT_FOUND" ? 404 : 503,
    providerStatus: error instanceof LocationProviderError ? error.httpStatus : undefined,
  };
}
