import React, { useState } from "react";
import { Text, View } from "react-native";
import { Map, Camera, ViewAnnotation } from "@maplibre/maplibre-react-native";
import { configuredMapProvider, type Position } from "./location-logic";
import { Button, styles as s, colors } from "./ui";
export type PinProps = {
  fill?: boolean;
  position: Position;
  zoom?: number;
  onMove: (p: Position) => void;
  t: (key: string) => string;
};
export default function LocationPin({ position, onMove, t, zoom = 15, fill = false }: PinProps) {
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const style = configuredMapProvider().styleURL;
  if (!style) return <Text style={s.body}>{t("mapNotConfigured")}</Text>;
  return (
    <>
      {failed && (
        <>
          <Text accessibilityRole="alert" style={s.body}>
            {t("mapFailed")}
          </Text>
          <Button
            title={t("retry")}
            onPress={() => {
              setFailed(false);
              setVersion((v) => v + 1);
            }}
          />
        </>
      )}
      <View style={fill ? { flex: 1 } : { height: 320 }}>
        <Map
          key={version}
          style={{ flex: 1 }}
          mapStyle={style}
          onDidFailLoadingMap={() => setFailed(true)}
          onPress={(e) =>
            onMove({ longitude: e.nativeEvent.lngLat[0], latitude: e.nativeEvent.lngLat[1] })
          }
        >
          <Camera center={[position.longitude, position.latitude]} zoom={zoom} />
          <ViewAnnotation
            id="work-pin"
            lngLat={[position.longitude, position.latitude]}
            draggable
            onDragEnd={(e) =>
              onMove({ longitude: e.nativeEvent.lngLat[0], latitude: e.nativeEvent.lngLat[1] })
            }
          >
            <View
              accessible
              accessibilityLabel={t("privatePin")}
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: colors.accent,
                borderColor: "white",
                borderWidth: 4,
              }}
            />
          </ViewAnnotation>
        </Map>
      </View>
      {!fill && <Text style={s.body}>{t("movePin")}</Text>}
    </>
  );
}
