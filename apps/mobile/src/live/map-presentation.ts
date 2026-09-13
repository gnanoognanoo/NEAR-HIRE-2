// Marker semantics are urgency only. No category/type-based colors.
export const JOB_MARKER_COLORS = { normal: "#21834A", urgent: "#D94040" } as const;
export const MAX_MAP_MARKERS = 100;
export function markerColor(job: { isUrgent?: boolean }) {
  return job.isUrgent === true ? JOB_MARKER_COLORS.urgent : JOB_MARKER_COLORS.normal;
}
export function mapCountText(count: number, radiusMetres: number, t: (key: string) => string) {
  return t(count === 1 ? "jobWithin" : "jobsWithin")
    .replace("{count}", String(count))
    .replace("{radius}", String(radiusMetres / 1000));
}
