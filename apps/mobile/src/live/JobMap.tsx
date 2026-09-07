import React from "react";
import { Text, View } from "react-native";
import { Camera, Map, Marker } from "@maplibre/maplibre-react-native";
import { styles, colors } from "./ui";
export type MapProps = {
  position: { latitude: number; longitude: number };
  jobs: any[];
  onSelect: (job: any) => void;
  unavailable: string;
};
export default function JobMap({ position, jobs, onSelect, unavailable }: MapProps) {
  const style = process.env.EXPO_PUBLIC_MAP_STYLE_URL;
  if (!style) return <Text style={styles.body}>{unavailable}</Text>;
  return (
    <View style={{ height: 340, borderRadius: 12, overflow: "hidden" }}>
      <Map style={{ flex: 1 }} mapStyle={style}>
        <Camera center={[position.longitude, position.latitude]} zoom={13} />
        <Marker lngLat={[position.longitude, position.latitude]}>
          <View
            style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.accent }}
          />
        </Marker>
        {jobs.map((item) => (
          <Marker
            key={item.job.id}
            lngLat={[item.approx_lng, item.approx_lat]}
            onPress={() => onSelect(item.job)}
          >
            <View
              style={{
                padding: 10,
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
