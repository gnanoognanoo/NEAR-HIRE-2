import { actor, handle, json, reply } from "../_shared/runtime.ts";
import { configuredLocationProvider } from "./config.ts";
import { locationFailure, locationRequest } from "./request.ts";
const cache = new Map<string, { expires: number; data: unknown }>();
handle(async (req) => {
  // Authenticate and enforce the existing server-side budget even for cached results.
  const { client, user } = await actor(req);
  const { error } = await client.rpc("edge_rate_limit", { p_kind: "location" });
  if (error) return reply({ error: "LOCATION_RATE_LIMIT" }, 429);
  const payload = await json(req);
  const { provider, capabilities } = configuredLocationProvider(
    Deno.env.get("LOCATION_PROVIDER"),
    Deno.env.get("OLA_MAPS_API_KEY"),
  );
  // Capability discovery has the same real-user authentication and request budget.
  if (payload?.action === "capabilities") return reply(capabilities);
  let request;
  try {
    request = locationRequest(payload, provider);
  } catch {
    return reply({ error: "INVALID_LOCATION_QUERY" }, 400);
  }
  // Bounded, user-scoped in-memory cache; no address, query or coordinates in logs.
  const cacheKey = JSON.stringify([user.id, request.key]),
    hit = capabilities.search ? cache.get(cacheKey) : undefined;
  if (hit && hit.expires > Date.now()) return reply(hit.data);
  try {
    const data = await request.operation();
    if (cache.size >= 200) cache.clear();
    cache.set(cacheKey, { expires: Date.now() + 300000, data });
    return reply(data);
  } catch (error) {
    const failure = locationFailure(error);
    if (failure.code !== "LOCATION_PROVIDER_DISABLED" && failure.code !== "LOCATION_NOT_CONFIGURED")
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
