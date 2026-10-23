import { coordinates, type Position } from "./location-logic.ts";
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
