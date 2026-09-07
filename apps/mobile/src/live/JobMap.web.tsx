import React, { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapProps } from "./JobMap";
import { styles } from "./ui";
export default function JobMap({ position, jobs, onSelect, unavailable }: MapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const style = process.env.EXPO_PUBLIC_MAP_STYLE_URL;
  useEffect(() => {
    if (!ref.current || !style) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style,
      center: [position.longitude, position.latitude],
      zoom: 13,
    });
    map.on("error", () => setFailed(true));
    new maplibregl.Marker({ color: "#6941A5" })
      .setLngLat([position.longitude, position.latitude])
      .addTo(map);
    for (const item of jobs) {
      const el = document.createElement("button");
      el.textContent = `₹${item.job.pay}`;
      el.setAttribute("aria-label", item.job.title);
      el.style.cssText =
        "background:white;color:#6941a5;border:1px solid #6941a5;border-radius:10px;padding:10px;cursor:pointer";
      el.onclick = () => onSelect(item.job);
      new maplibregl.Marker({ element: el })
        .setLngLat([item.approx_lng, item.approx_lat])
        .addTo(map);
    }
    return () => map.remove();
  }, [position, jobs, onSelect, style]);
  return (
    <>
      {(!style || failed) && <Text style={styles.body}>{unavailable}</Text>}
      {style && <div ref={ref} style={{ height: 340, borderRadius: 12, overflow: "hidden" }} />}
    </>
  );
}
