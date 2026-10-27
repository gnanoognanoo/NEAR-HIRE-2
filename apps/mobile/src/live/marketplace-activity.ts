import { coordinates, type Position } from "./location-logic.ts";

// The server still verifies accepted workers, ownership and state atomically.
export function canFillJob(status: string) {
  return status === "active" || status === "expired";
}

// Only call with the successful private_contact RPC result, never discovery data.
export function authorizedContactPosition(contact: unknown): Position | null {
  if (!contact || typeof contact !== "object") return null;
  const point = contact as Record<string, unknown>;
  try {
    return { ...coordinates(point.latitude, point.longitude), source: "manual" };
  } catch {
    return null;
  }
}

type RepostDependencies = {
  read: (key: string) => Promise<string | null>;
  write: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
  requestId: () => string;
  repost: (id: string, requestId: string) => Promise<unknown>;
};
export function retryableRepost(deps: RepostDependencies) {
  const pending = new Map<string, Promise<unknown>>();
  return (userId: string, jobId: string): Promise<unknown> => {
    const key = `nearhire.repost.${userId}.${jobId}`;
    const running = pending.get(key);
    if (running) return running;
    const operation = (async () => {
      const request = (await deps.read(key)) || deps.requestId();
      // Persist before the request so an ambiguous response/restart reuses it.
      await deps.write(key, request);
      const result = await deps.repost(jobId, request);
      await deps.remove(key).catch(() => {});
      return result;
    })().finally(() => pending.delete(key));
    pending.set(key, operation);
    return operation;
  };
}
