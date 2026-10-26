export type LocationCapabilities = {
  search: boolean;
  reverseGeocoding: boolean;
};
export const NO_ADDRESS_PROVIDER: LocationCapabilities = { search: false, reverseGeocoding: false };
export function locationCapabilities(value: unknown): LocationCapabilities {
  const data = value as Partial<LocationCapabilities> | null;
  return { search: data?.search === true, reverseGeocoding: data?.reverseGeocoding === true };
}
export function addressProviderUnavailable(error: unknown) {
  return [
    "LOCATION_PROVIDER_DISABLED",
    "LOCATION_NOT_CONFIGURED",
    "SERVICE_NOT_CONFIGURED",
    "LOCATION_PROVIDER_AUTH",
    "LOCATION_INVALID_RESPONSE",
    "LOCATION_UNAVAILABLE",
    "LOCATION_TIMEOUT",
  ].includes((error as { message?: string })?.message || "");
}
