import JobMapMarker from "./JobMapMarker";
import { MAX_MAP_MARKERS } from "./map-presentation";
import { configuredMapProvider } from "./location-logic";
import React, { useState, useRef, useEffect } from "react";
import { Text, View } from "react-native";
import { Camera, Map, Marker, type CameraRef } from "@maplibre/maplibre-react-native";
import { Button, styles, colors } from "./ui";
export type MapProps = {
  markerKind?: "job" | "worker";
  fill?: boolean;
  selectedId?: string | null;
  recenterKey?: number;
  position: { latitude: number; longitude: number };
  jobs: any[];
  onSelect: (job: any) => void;
  unavailable: string;
  t: (key: string) => string;
};
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
  const camera = useRef<CameraRef>(null);
  useEffect(() => {
    camera.current?.easeTo({
      center: [position.longitude, position.latitude],
      zoom: 13,
      duration: 700,
    });
  }, [position.latitude, position.longitude, recenterKey]);
  const style = configuredMapProvider().styleURL;
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  if (!style)
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 22 }}>
        <Text style={styles.body}>{unavailable}</Text>
      </View>
    );
  return (
    <View style={fill ? { flex: 1 } : { height: 340, borderRadius: 12, overflow: "hidden" }}>
      {failed && (
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
                }
              : {}
          }
        >
          {" "}
          {failed && <Text style={styles.body}>{t("mapFailed")}</Text>}
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
      <Map
        key={version}
        style={{ flex: 1 }}
        mapStyle={style}
        onDidFailLoadingMap={() => setFailed(true)}
      >
        <Camera
          ref={camera}
          initialViewState={{ center: [position.longitude, position.latitude], zoom: 13 }}
        />
        <Marker lngLat={[position.longitude, position.latitude]}>
          <View
            accessible
            accessibilityLabel={t("selectedLocation")}
            style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent }}
          />
        </Marker>
        {jobs.slice(0, MAX_MAP_MARKERS).map((item) => (
          <Marker
            key={item.job.id}
            accessibilityLabel={item.job.title}
            lngLat={[item.approx_lng, item.approx_lat]}
            onPress={() => onSelect(item.job)}
          >
            <JobMapMarker
              worker={markerKind === "worker"}
              isUrgent={item.job.isUrgent === true}
              isSelected={selectedId === item.job.id}
              label={
                markerKind === "worker"
                  ? item.job.title
                  : `${t(item.job.isUrgent === true ? "urgentHiring" : "normalJob")}: ${item.job.title}`
              }
              onPress={() => onSelect(item.job)}
            />
          </Marker>
        ))}
      </Map>
      <Text style={{ fontSize: 10, color: "#333", backgroundColor: "white", textAlign: "center" }}>
        {configuredMapProvider().attribution}
      </Text>
    </View>
  );
}
