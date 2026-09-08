import React, { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PinProps } from "./LocationPin";
import { configuredMapProvider } from "./location-logic";
import { Button, styles as s } from "./ui";
export default function LocationPin({ position, onMove, t }: PinProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const move = useRef(onMove);
  move.current = onMove;
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const style = configuredMapProvider().styleURL;
  useEffect(() => {
    if (!style || !ref.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: ref.current,
        style,
        center: [position.longitude, position.latitude],
        zoom: 15,
      });
    } catch {
      setFailed(true);
      return;
    }
    mapRef.current = map;
    const marker = new maplibregl.Marker({ color: "#6941A5", draggable: true })
      .setLngLat([position.longitude, position.latitude])
      .addTo(map);
    markerRef.current = marker;
    marker.on("dragend", () => {
      const p = marker.getLngLat();
      move.current({ latitude: p.lat, longitude: p.lng });
    });
    map.on("click", (e) => move.current({ latitude: e.lngLat.lat, longitude: e.lngLat.lng }));
    map.on("error", () => setFailed(true));
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Position is synchronized without destroying the map during drag.
  }, [style, version]);
  useEffect(() => {
    markerRef.current?.setLngLat([position.longitude, position.latitude]);
    mapRef.current?.easeTo({ center: [position.longitude, position.latitude] });
  }, [position.latitude, position.longitude]);
  return (
    <>
      {(!style || failed) && (
        <Text style={s.body}>{t(style ? "mapFailed" : "mapNotConfigured")}</Text>
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
      {style && <div aria-label={t("privatePin")} ref={ref} style={{ height: 320 }} />}
      <Text style={s.body}>{t("movePin")}</Text>
    </>
  );
}
