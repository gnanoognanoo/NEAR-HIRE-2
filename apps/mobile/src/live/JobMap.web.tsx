import { markerColor, MAX_MAP_MARKERS } from "./map-presentation";
import "./map-worker.web";
import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapProps } from "./JobMap";
import { configuredMapProvider } from "./location-logic";
import { Button, styles, colors } from "./ui";
export default function JobMap({
  position,
  jobs,
  onSelect,
  unavailable,
  t,
  fill = false,
  markerKind = "job",
  selectedId,
  recenterKey = 0,
}: MapProps) {
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
    if (!fill)
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      if (ref.current) ref.current.dataset.mapReady = "true";
    });
    let firstVisible = false;
    const resize = new ResizeObserver(() => {
      if (!ref.current?.clientWidth || !ref.current?.clientHeight) return;
      map.resize();
      if (!firstVisible) {
        firstVisible = true;
        map.jumpTo({ center: [initial.current.longitude, initial.current.latitude], zoom: 13 });
      }
    });
    resize.observe(ref.current!);
    map.on("error", () => setFailed(true));
    return () => {
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      resize.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [style, version]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ center: [position.longitude, position.latitude], zoom: 13 });
  }, [position.latitude, position.longitude, style, version, recenterKey]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markers.current.forEach((m) => m.remove());
    const user = document.createElement("div");
    user.style.cssText =
      "width:18px;height:18px;border-radius:50%;background:#6941A5;border:3px solid white;box-shadow:0 0 0 7px rgba(105,65,165,.18)";
    const next = [
      new maplibregl.Marker({ element: user })
        .setLngLat([position.longitude, position.latitude])
        .addTo(map),
    ];
    next[0].getElement().setAttribute("aria-label", t("selectedLocation"));
    for (const item of JSON.parse(jobsKey).slice(0, MAX_MAP_MARKERS)) {
      const el = document.createElement("button");
      const urgent = item.job.isUrgent === true,
        selected = item.job.id === selectedId;
      if (markerKind === "worker") el.dataset.worker = "true";
      else el.dataset.urgency = urgent ? "urgent" : "normal";
      el.innerHTML = `<svg width="${selected ? 38 : 32}" height="${selected ? 48 : 40}" viewBox="0 0 32 42" aria-hidden="true"><path d="M16 1C7.7 1 1 7.7 1 16c0 11 15 24 15 24s15-13 15-24C31 7.7 24.3 1 16 1Z" fill="${markerKind === "worker" ? colors.accent : markerColor(item.job)}" stroke="white" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="white"/></svg>`;
      if (markerKind === "worker")
        el.innerHTML = `<svg width="${selected ? 44 : 36}" height="${selected ? 44 : 36}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#6941A5" stroke="white" stroke-width="2"/><circle cx="20" cy="14" r="5" fill="white"/><path d="M10 31c0-12 20-12 20 0" fill="none" stroke="white" stroke-width="3"/></svg>`;
      el.setAttribute(
        "aria-label",
        markerKind === "worker"
          ? item.job.title
          : `${t(item.job.isUrgent === true ? "urgentHiring" : "normalJob")}: ${item.job.title}`,
      );
      el.setAttribute("aria-pressed", String(selected));
      el.style.cssText =
        "background:transparent;border:0;padding:0;min-width:48px;min-height:48px;cursor:pointer;display:flex;align-items:center;justify-content:center";
      el.onclick = () => select.current(item.job);
      next.push(
        new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([item.approx_lng, item.approx_lat])
          .addTo(map),
      );
    }
    markers.current = next;
  }, [jobsKey, position.latitude, position.longitude, style, version, selectedId, markerKind]);
  return (
    <>
      {(!style || failed) && (
        <View
          style={
            fill
              ? {
                  position: "absolute",
                  bottom: 90,
                  left: 10,
                  right: 10,
                  zIndex: 2,
                  backgroundColor: "white",
                  padding: 12,
                  borderRadius: 12,
                }
              : {}
          }
        >
          {" "}
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
        </View>
      )}
      {style && (
        <div
          ref={ref}
          aria-label={t("mapView")}
          style={{
            height: fill ? "100%" : "42vh",
            minHeight: fill ? 0 : 290,
            maxHeight: fill ? undefined : 420,
            width: "100%",
            borderRadius: fill ? 0 : 12,
            overflow: "hidden",
          }}
        />
      )}
    </>
  );
}
