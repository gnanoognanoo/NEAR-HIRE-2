import { configuredMapProvider } from "./location-logic";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { Camera, Map, Marker } from "@maplibre/maplibre-react-native";
import { Button, styles, colors } from "./ui";
export type MapProps = {
  position: { latitude: number; longitude: number };
  jobs: any[];
  onSelect: (job: any) => void;
  unavailable: string;
  t: (key: string) => string;
};
export default function JobMap({ position, jobs, onSelect, unavailable, t }: MapProps) {
  const style = configuredMapProvider().styleURL;
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  if (!style) return <Text style={styles.body}>{unavailable}</Text>;
  return (
    <View style={{ height: 340, borderRadius: 12, overflow: "hidden" }}>
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
      <Map
        key={version}
        style={{ flex: 1 }}
        mapStyle={style}
        onDidFailLoadingMap={() => setFailed(true)}
      >
        <Camera center={[position.longitude, position.latitude]} zoom={13} />
        <Marker lngLat={[position.longitude, position.latitude]}>
          <View
            accessible
            accessibilityLabel={t("selectedLocation")}
            style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent }}
          />
        </Marker>
        {jobs.map((item) => (
          <Marker
            key={item.job.id}
            accessibilityLabel={item.job.title}
            lngLat={[item.approx_lng, item.approx_lat]}
            onPress={() => onSelect(item.job)}
          >
            <View
              style={{
                padding: 10,
                minWidth: 48,
                minHeight: 48,
                justifyContent: "center",
                backgroundColor: colors.white,
                borderWidth: 1,
                borderColor: colors.accent,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: colors.accent }}>₹{item.job.pay}</Text>
            </View>
          </Marker>
        ))}
      </Map>
    </View>
  );
}
