export type Place = {
  id: string;
  label: string;
  latitude?: number;
  longitude?: number;
  locality?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  formatted_address?: string;
};
export interface LocationSearchProvider {
  search(query: string): Promise<Place[]>;
  geocode(address: string): Promise<Place[]>;
  resolve(id: string): Promise<Place>;
  reverse(latitude: number, longitude: number): Promise<Place>;
}
type Row = Record<string, unknown>;
const row = (v: unknown): Row =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {};
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
export class LocationProviderError extends Error {
  constructor(
    public code: string,
    public httpStatus?: number,
  ) {
    super(code);
  }
}
function place(value: unknown, selected?: { latitude: number; longitude: number }): Place {
  const p = row(value),
    location = row(row(p.geometry).location);
  const latitude = selected?.latitude ?? location.lat,
    longitude = selected?.longitude ?? location.lng;
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  )
    throw new LocationProviderError("LOCATION_INVALID_RESPONSE");
  const components = Array.isArray(p.address_components) ? p.address_components.map(row) : [];
  const part = (type: string, short = false) => {
    const c = components.find((c) => Array.isArray(c.types) && c.types.includes(type));
    return text(c?.[short ? "short_name" : "long_name"]);
  };
  const country = part("country", true) || part("country");
  // Ola geocode examples use "India" as short_name; job data expects ISO alpha-2.
  const isoCountry = /^(india|in)$/i.test(country)
    ? "IN"
    : /^[a-z]{2}$/i.test(country)
      ? country.toUpperCase()
      : undefined;
  const label = text(p.formatted_address) || text(p.name);
  if (!label) throw new LocationProviderError("LOCATION_INVALID_RESPONSE");
  return {
    id: text(p.place_id) || `${latitude},${longitude}`,
    label,
    formatted_address: label,
    latitude,
    longitude,
    locality:
      part("sublocality_level_1") ||
      part("sublocality") ||
      part("neighborhood") ||
      part("postal_town") ||
      part("locality"),
    city: part("locality") || part("postal_town") || part("administrative_area_level_3"),
    district: part("administrative_area_level_2"),
    state: part("administrative_area_level_1"),
    country: isoCountry,
  };
}
export class OlaMapsProvider implements LocationSearchProvider {
  constructor(
    private key: string,
    private request: typeof fetch = fetch,
  ) {
    if (!key.trim()) throw new LocationProviderError("LOCATION_NOT_CONFIGURED");
  }
  private async get(
    path: "autocomplete" | "details" | "geocode" | "reverse-geocode",
    params: Record<string, string>,
  ) {
    const url = new URL(`https://api.olamaps.io/places/v1/${path}`);
    Object.entries({ ...params, api_key: this.key }).forEach(([k, v]) =>
      url.searchParams.set(k, v),
    );
    try {
      const response = await this.request(url, {
        headers: { "X-Request-Id": crypto.randomUUID() },
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      });
      if (!response.ok)
        throw new LocationProviderError(
          response.status === 401 || response.status === 403
            ? "LOCATION_PROVIDER_AUTH"
            : response.status === 429
              ? "LOCATION_RATE_LIMIT"
              : "LOCATION_UNAVAILABLE",
          response.status,
        );
      const data = row(await response.json()),
        status = text(data.status).toLowerCase();
      if (status && !["ok", "success", "zero_results"].includes(status))
        throw new LocationProviderError(
          /denied|unauthor|invalid.key/.test(status)
            ? "LOCATION_PROVIDER_AUTH"
            : /limit|quota/.test(status)
              ? "LOCATION_RATE_LIMIT"
              : "LOCATION_UNAVAILABLE",
          response.status,
        );
      return data;
    } catch (error) {
      if (error instanceof LocationProviderError) throw error;
      // Fetch errors can contain the credential-bearing URL. Never propagate raw errors.
      throw new LocationProviderError(
        error instanceof Error && /^(TimeoutError|AbortError)$/.test(error.name)
          ? "LOCATION_TIMEOUT"
          : "LOCATION_UNAVAILABLE",
      );
    }
  }
  async search(query: string): Promise<Place[]> {
    const d = await this.get("autocomplete", { input: query });
    if (!Array.isArray(d.predictions)) throw new LocationProviderError("LOCATION_INVALID_RESPONSE");
    const seen = new Set<string>();
    return d.predictions
      .map(row)
      .flatMap((p) => {
        const id = text(p.place_id),
          label = text(p.description);
        if (!id || !label || seen.has(id)) return [];
        seen.add(id);
        return [{ id, label }];
      })
      .slice(0, 8);
  }
  async geocode(address: string): Promise<Place[]> {
    const d = await this.get("geocode", { address });
    if (text(d.status).toLowerCase() === "zero_results") return [];
    if (!Array.isArray(d.geocodingResults))
      throw new LocationProviderError("LOCATION_INVALID_RESPONSE");
    return d.geocodingResults.slice(0, 8).map((p) => place(p));
  }
  async resolve(id: string) {
    const d = await this.get("details", { place_id: id });
    if (!d.result) throw new LocationProviderError("LOCATION_NOT_FOUND");
    return place(d.result);
  }
  async reverse(latitude: number, longitude: number) {
    const d = await this.get("reverse-geocode", { latlng: `${latitude},${longitude}` });
    if (!Array.isArray(d.results) || !d.results[0])
      throw new LocationProviderError("LOCATION_NOT_FOUND");
    // Address lookup must not move a user's precise selected pin to a nearby road or POI.
    return place(d.results[0], { latitude, longitude });
  }
}
// Test fixtures only. Never selected by the hosted endpoint.
export class MockLocationProvider implements LocationSearchProvider {
  constructor(private fixtures: Place[]) {}
  async search(query: string) {
    return this.fixtures
      .filter((p) => p.label.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8);
  }
  geocode(address: string) {
    return this.search(address);
  }
  async resolve(id: string) {
    const p = this.fixtures.find((p) => p.id === id);
    if (!p) throw new LocationProviderError("LOCATION_NOT_FOUND");
    return p;
  }
  async reverse(latitude: number, longitude: number) {
    return { id: "mock", label: "DEVELOPMENT FIXTURE", latitude, longitude };
  }
}
