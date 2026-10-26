import { boundedLocation, coordinates, type Position } from "./location-logic.ts";
type Suggestion = Partial<Position> & { id: string; label: string };
export async function resolveLocationSuggestion(
  suggestion: Suggestion,
  resolve: (id: string) => Promise<Suggestion>,
): Promise<Position> {
  const place =
    typeof suggestion.latitude === "number" && typeof suggestion.longitude === "number"
      ? suggestion
      : await resolve(suggestion.id);
  return { ...place, ...coordinates(place.latitude, place.longitude), source: "manual" };
}
export function mergeReverseLocation(point: Position, address: Partial<Position>): Position {
  return {
    ...point,
    ...address,
    ...coordinates(point.latitude, point.longitude),
    source: point.source || "manual",
    accuracy: point.accuracy,
    timestamp: point.timestamp,
    approximate: point.approximate,
  };
}
export async function optionalReverseLocation(
  point: Position,
  enabled: boolean,
  reverse: (latitude: number, longitude: number) => Promise<Partial<Position>>,
  timeout = 5000,
) {
  const selected = { ...point, ...coordinates(point.latitude, point.longitude) };
  if (!enabled) return { point: selected, error: null };
  try {
    return {
      point: mergeReverseLocation(
        selected,
        await boundedLocation(reverse(selected.latitude, selected.longitude), timeout),
      ),
      error: null,
    };
  } catch (error) {
    return { point: selected, error };
  }
}
export function manualCoordinatesApplied(
  point: Position | null,
  latitude: string,
  longitude: string,
) {
  try {
    const next = coordinates(latitude, longitude);
    return !!point && next.latitude === point.latitude && next.longitude === point.longitude;
  } catch {
    return false;
  }
}
export function confirmedLocation(
  point: Position | null,
  locality: string,
  address: string,
  edits?: { latitude: string; longitude: string },
): Position {
  if (!point) throw new Error("INVALID_LOCATION");
  if (edits && !manualCoordinatesApplied(point, edits.latitude, edits.longitude))
    throw new Error("INVALID_LOCATION");
  if (locality.trim().length < 2) throw new Error("LOCATION_LOCALITY_REQUIRED");
  return {
    ...point,
    ...coordinates(point.latitude, point.longitude),
    locality: locality.trim(),
    formatted_address: address.trim(),
    label: locality.trim(),
  };
}
