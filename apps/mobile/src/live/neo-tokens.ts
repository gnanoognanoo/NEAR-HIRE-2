// Shared visual tokens. No backend configuration, native dependencies or credentials.
export const palette = {
  canvas: "#E9EEF5",
  surface: "#F0F3F8",
  white: "#FFFFFF",
  ink: "#253247",
  muted: "#56667D",
  accent: "#6941A5",
  pale: "#EAE4F3",
  line: "#CED8E5",
  boundary: "#74859C",
  highlight: "#FFFFFF",
  shadow: "#C6D0DE",
  positive: "#21865A",
  positiveText: "#17623F",
  positiveSurface: "#E3F1E9",
  urgent: "#D94A56",
  dangerText: "#A92D40",
  dangerSurface: "#F9E7EB",
  warningText: "#735317",
  warningSurface: "#F8EED8",
};
export const rhythm = { xs: 8, sm: 16, md: 24, lg: 32, xl: 40, card: 24, control: 16, touch: 48 };
export function softDepth(platform: string, version: number, inset = false, compact = false) {
  if (platform !== "android" || version >= (inset ? 29 : 28))
    return {
      boxShadow: inset
        ? "inset 2px 2px 5px rgba(156,173,195,0.25), inset -2px -2px 5px rgba(255,255,255,0.9)"
        : compact
          ? "3px 3px 8px rgba(162,179,201,0.24), -3px -3px 8px rgba(255,255,255,0.9)"
          : "5px 5px 14px rgba(162,179,201,0.26), -4px -4px 12px rgba(255,255,255,0.95)",
    };
  // Android 7/8 cannot draw CSS-style shadows; inset additionally needs Android 10.
  return { elevation: inset ? 0 : 2, borderTopColor: inset ? palette.line : palette.highlight };
}
export function statusTone(status: string): "neutral" | "success" | "danger" | "warning" {
  if (["active", "accepted", "completed", "paid", "verified"].includes(status)) return "success";
  if (["urgent", "failed", "rejected", "suspended"].includes(status)) return "danger";
  if (["pending", "expired", "in_progress", "filled"].includes(status)) return "warning";
  return "neutral";
}
