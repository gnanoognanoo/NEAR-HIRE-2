export type Workspace = "find" | "post";
export function parseWorkspace(value: unknown): Workspace | null {
  return value === "find" || value === "post" ? value : null;
}
export const workspaceHome = (mode: Workspace) => (mode === "find" ? "jobs" : "workers");
export const workspaceTabs = (mode: Workspace): string[] =>
  mode === "find"
    ? ["jobs", "applications", "saved", "notifications", "profile"]
    : ["workers", "posts", "applicants", "notifications", "profile"];
export const routeLabel = (route: string) =>
  (
    ({
      workers: "nearbyWorkers",
      posts: "myPosts",
      applications: "myApplications",
      editProfile: "editProfile",
    }) as Record<string, string>
  )[route] || route;
export function backDestination(route: string, mode: Workspace): string | null {
  if (["editProfile", "credits", "settings", "preferences"].includes(route)) return "profile";
  if (route === "post") return "workers";
  return route === workspaceHome(mode) ? null : workspaceHome(mode);
}
