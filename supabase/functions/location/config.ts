import { LocationProviderError, OlaMapsProvider, type LocationSearchProvider } from "./provider.ts";

// Deliberately returns errors, never fabricated addresses or coordinates.
class UnavailableProvider implements LocationSearchProvider {
  constructor(private code: string) {}
  search(_query: string): Promise<never> {
    return Promise.reject(new LocationProviderError(this.code));
  }
  geocode(_query: string): Promise<never> {
    return Promise.reject(new LocationProviderError(this.code));
  }
  resolve(_id: string): Promise<never> {
    return Promise.reject(new LocationProviderError(this.code));
  }
  reverse(_latitude: number, _longitude: number): Promise<never> {
    return Promise.reject(new LocationProviderError(this.code));
  }
}

export function configuredLocationProvider(
  name: string | undefined,
  key: string | undefined,
  request: typeof fetch = fetch,
) {
  const mode = name?.trim().toLowerCase() || "ola";
  const reason =
    mode === "disabled" ? "disabled" : mode !== "ola" || !key?.trim() ? "not_configured" : null;
  return {
    capabilities: { search: reason === null, reverseGeocoding: reason === null, reason },
    provider:
      reason === null
        ? new OlaMapsProvider(key!.trim(), request)
        : new UnavailableProvider(
            reason === "disabled" ? "LOCATION_PROVIDER_DISABLED" : "LOCATION_NOT_CONFIGURED",
          ),
  };
}
