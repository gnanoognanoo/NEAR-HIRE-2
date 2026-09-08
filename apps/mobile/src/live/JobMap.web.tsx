import React, { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapProps } from "./JobMap";
import { configuredMapProvider } from "./location-logic";
import { Button, styles } from "./ui";
export default function JobMap({ position, jobs, onSelect, unavailable, t }: MapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const select = useRef(onSelect);
  select.current = onSelect;
  const initial = useRef(position);
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState(false);
  const style = configuredMapProvider().styleURL;
  const jobsKey = JSON.stringify(jobs);
  useEffect(() => {
    if (!style || !ref.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: ref.current,
        style,
        center: [initial.current.longitude, initial.current.latitude],
        zoom: 13,
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.on("error", () => setFailed(true));
    return () => {
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [style, version]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ center: [position.longitude, position.latitude] });
  }, [position.latitude, position.longitude, style, version]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markers.current.forEach((m) => m.remove());
    const next = [
      new maplibregl.Marker({ color: "#6941A5" })
        .setLngLat([position.longitude, position.latitude])
        .addTo(map),
    ];
    for (const item of JSON.parse(jobsKey)) {
      const el = document.createElement("button");
      el.textContent = `₹${item.job.pay}`;
      el.setAttribute("aria-label", item.job.title);
      el.style.cssText =
        "background:white;color:#6941a5;border:1px solid #6941a5;border-radius:10px;padding:10px;min-width:48px;min-height:48px;cursor:pointer";
      el.onclick = () => select.current(item.job);
      next.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([item.approx_lng, item.approx_lat])
          .addTo(map),
      );
    }
    markers.current = next;
  }, [jobsKey, position.latitude, position.longitude, style, version]);
  return (
    <>
      {(!style || failed) && (
        <Text style={styles.body}>{failed ? t("mapFailed") : unavailable}</Text>
      )}
      {failed && (
        <Button
          title={t("retry")}
          onPress={() => {
            setFailed(false);
            setVersion((v) => v + 1);
          }}
        />
      )}
      {style && <div ref={ref} style={{ height: 340, borderRadius: 12, overflow: "hidden" }} />}
    </>
  );
}
