// One request ID per draft survives retries/restarts. The RPC owns credit accounting.
export function postingFlow(service: {
  create: (p: Record<string, unknown>, id: string) => Promise<string>;
  publish: (id: string) => Promise<{ status: string }>;
}) {
  let inFlight: Promise<string> | null = null;
  return {
    submit(
      p: Record<string, unknown>,
      requestId: string,
      publish: boolean,
      before: () => Promise<void>,
    ) {
      if (inFlight) return inFlight;
      const task = (async () => {
        await before();
        const id = await service.create(p, requestId);
        if (publish) {
          const job = await service.publish(id);
          if (job.status !== "active") throw new Error("JOB_UNAVAILABLE");
        }
        return id;
      })();
      inFlight = task;
      void task
        .finally(() => {
          if (inFlight === task) inFlight = null;
        })
        .catch(() => {});
      return task;
    },
  };
}
export function postingErrorKey(e: unknown): string {
  const x = e as { message?: string; code?: string };
  const m = x?.message || String(e);
  for (const [code, key] of Object.entries({
    CREDITS_REQUIRED: "creditsError",
    PROFILE_REQUIRED: "postingProfileRequired",
    AUTH_REQUIRED: "authError",
    SUSPENDED: "postingPermission",
    INVALID_LOCATION: "postingLocationError",
    INVALID_CATEGORY: "postingCategoryError",
    RATE_LIMITED: "limit",
    INVALID_DATE: "postingDateError",
    INVALID_TIME: "postingTimeError",
    INVALID_JOB: "validation",
    NOT_FOUND: "postingPermission",
    INVALID_TRANSITION: "jobUnavailable",
  }))
    if (m.includes(code)) return key;
  if (x?.code === "42501" || /permission|row.level.security/i.test(m)) return "postingPermission";
  if (/network|fetch|timeout|abort|offline/i.test(m)) return "postingNetworkError";
  return "postingFailed";
}
export function postingDraftKey(userId: string) {
  return "nearhire.posting." + userId;
}
export function restorePostingDraft(raw: string | null, userId: string): any | null {
  try {
    if (raw && raw.length > 64000) return null;
    const r = JSON.parse(raw || "null");
    if (
      r?.position &&
      (!Number.isFinite(r.position.latitude) ||
        !Number.isFinite(r.position.longitude) ||
        Math.abs(r.position.latitude) > 90 ||
        Math.abs(r.position.longitude) > 180)
    )
      return null;
    if (
      r?.fields &&
      ["languages_text", "skills_text"].some(
        (k) => r.fields[k] != null && typeof r.fields[k] !== "string",
      )
    )
      return null;
    return r?.version === 1 &&
      r.owner === userId &&
      typeof r.requestId === "string" &&
      /^[a-f0-9-]{36}$/i.test(r.requestId) &&
      r.fields &&
      typeof r.fields === "object" &&
      !Array.isArray(r.fields)
      ? r
      : null;
  } catch {
    return null;
  }
}

export function completedPostingDraft(job: { status: string } | null) {
  return !!job && job.status !== "draft";
}
