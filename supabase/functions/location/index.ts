import { actor, handle, json, reply } from "../_shared/runtime.ts";
import { OlaMapsProvider } from "./provider.ts";
import { locationFailure, locationRequest } from "./request.ts";
const cache = new Map<string, { expires: number; data: unknown }>();
handle(async (req) => {
  // Authenticate and enforce the existing server-side budget even for cached results.
  const { client, user } = await actor(req);
  const { error } = await client.rpc("edge_rate_limit", { p_kind: "location" });
  if (error) return reply({ error: "LOCATION_RATE_LIMIT" }, 429);
  const payload = await json(req),
    key = Deno.env.get("OLA_MAPS_API_KEY")?.trim();
  if (!key || (Deno.env.get("LOCATION_PROVIDER") && Deno.env.get("LOCATION_PROVIDER") !== "ola"))
    return reply({ error: "LOCATION_NOT_CONFIGURED" }, 503);
  let request;
  try {
    request = locationRequest(payload, new OlaMapsProvider(key));
  } catch {
    return reply({ error: "INVALID_LOCATION_QUERY" }, 400);
  }
  // Bounded, user-scoped in-memory cache; no address, query or coordinates in logs.
  const cacheKey = JSON.stringify([user.id, request.key]),
    hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return reply(hit.data);
  try {
    const data = await request.operation();
    if (cache.size >= 200) cache.clear();
    cache.set(cacheKey, { expires: Date.now() + 300000, data });
    return reply(data);
  } catch (error) {
    const failure = locationFailure(error);
    console.error(
      JSON.stringify({
        event: "location_provider_failed",
        action: request.action,
        code: failure.code,
        http_status: failure.providerStatus,
      }),
    );
    return reply({ error: failure.code }, failure.status);
  }
});
