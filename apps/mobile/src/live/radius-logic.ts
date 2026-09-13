export const DEFAULT_RADIUS_METRES = 3000;
export function radiusKmToMetres(value: unknown): number {
  if (
    (typeof value !== "number" && typeof value !== "string") ||
    (typeof value === "string" && !/^[0-9]+$/.test(value))
  )
    throw new Error("INVALID_RADIUS");
  const km = Number(value);
  if (!Number.isInteger(km) || km < 1 || km > 50) throw new Error("INVALID_RADIUS");
  return km * 1000;
}
export function validateRadiusMetres(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value % 1000 !== 0)
    throw new Error("INVALID_RADIUS");
  return radiusKmToMetres(value / 1000);
}
