import React, { useState } from "react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import WorkerSurface, { type PublicWorker } from "./WorkerSurface";
import { rpc } from "./client";
import type { Position } from "./location-logic";
export default function NearbyWorkers({
  position,
  t,
  onLocation,
  onLocated,
  onPost,
}: {
  position: Position | null;
  t: (k: string) => string;
  onLocation: () => void;
  onLocated: (p: Position) => void;
  onPost: () => void;
}) {
  const [radius, setRadius] = useState(3000),
    [query, setQuery] = useState("");
  const q = useInfiniteQuery({
    placeholderData: keepPreviousData,
    queryKey: ["nearby-workers", position?.latitude, position?.longitude, radius, query],
    queryFn: ({ pageParam }) =>
      rpc<PublicWorker[]>("nearby_available_workers", {
        p_lat: position!.latitude,
        p_lng: position!.longitude,
        p_radius: radius,
        p_filter: { query },
        p_offset: pageParam,
      }),
    enabled: !!position,
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === 20 ? all.length * 20 : undefined),
    refetchInterval: 30000,
  });
  return (
    <WorkerSurface
      workers={q.data?.pages.flat() || []}
      position={position}
      radius={radius}
      onRadius={setRadius}
      t={t}
      onLocation={onLocation}
      onLocated={onLocated}
      onPost={onPost}
      loading={!!position && q.isFetching}
      error={q.isError}
      onRetry={() => void q.refetch()}
      onMore={q.hasNextPage && !q.isFetchingNextPage ? () => void q.fetchNextPage() : undefined}
      query={query}
      onQuery={setQuery}
    />
  );
}
