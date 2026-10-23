// Server-side diagnostic only. Never import this script into the mobile application.
import { LocationProviderError, OlaMapsProvider } from "../supabase/functions/location/provider.ts";
const key = Deno.env.get("OLA_MAPS_API_KEY")?.trim();
if (!key) {
  console.error("OLA_MAPS_API_KEY is missing. Load the external server credential file.");
  Deno.exit(1);
}
const provider = new OlaMapsProvider(key);
for (const query of ["Anna Nagar Chennai", "Ambattur Chennai", "Avadi Tamil Nadu"]) {
  try {
    const suggestions = await provider.search(query);
    const resolved = suggestions[0] ? await provider.resolve(suggestions[0].id) : null;
    const geocoded = await provider.geocode(query);
    const point = resolved || geocoded[0];
    if (!point || typeof point.latitude !== "number" || typeof point.longitude !== "number")
      throw new Error("No usable result");
    const reversed = await provider.reverse(point.latitude, point.longitude);
    const pass =
      suggestions.length > 0 &&
      geocoded.length > 0 &&
      point.country === "IN" &&
      Boolean(point.locality && point.city && point.state) &&
      reversed.latitude === point.latitude &&
      reversed.longitude === point.longitude;
    // Only public test-query summaries; never print provider URLs, IDs, raw errors or credentials.
    console.log(
      JSON.stringify({
        query,
        autocompleteResults: suggestions.length,
        details: !!resolved,
        geocodeResults: geocoded.length,
        structuredAddress: !!(point.locality && point.city && point.state),
        india: point.country === "IN",
        reversePreservesPin:
          reversed.latitude === point.latitude && reversed.longitude === point.longitude,
        pass,
      }),
    );
    if (!pass) Deno.exit(1);
  } catch (error) {
    console.error(
      JSON.stringify({
        query,
        pass: false,
        code: error instanceof LocationProviderError ? error.code : "LOCATION_VALIDATION_FAILED",
        providerStatus: error instanceof LocationProviderError ? error.httpStatus : undefined,
      }),
    );
    // Do not hammer a rejected credential or continue with fictional responses.
    Deno.exit(1);
  }
}
