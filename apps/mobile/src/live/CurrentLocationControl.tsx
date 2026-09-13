import React, { useRef, useState } from "react";
import { ActivityIndicator, Linking, Modal, Platform, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { deviceLocation, needsLocationExplanation } from "./device-location";
import { locationErrorKey, type Position } from "./location-logic";
import { Button, colors, styles as s } from "./ui";
export default function CurrentLocationControl({
  t,
  onLocated,
  onManual,
}: {
  t: (k: string) => string;
  onLocated: (p: Position) => void;
  onManual: () => void;
}) {
  const gate = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [explain, setExplain] = useState(false);
  async function locate(confirmed = false) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError("");
    try {
      if (!confirmed && (await needsLocationExplanation())) {
        setExplain(true);
        return;
      }
      const p = await deviceLocation();
      onLocated({ ...p, label: t("currentLocation") });
    } catch (e) {
      setError(
        (e as Error).message === "LOCATION_UNAVAILABLE"
          ? "currentLocationUnavailable"
          : locationErrorKey(e),
      );
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={{ alignItems: "flex-end", gap: 8, flexShrink:1, minWidth:44 }}>
      {!!error && (
        <View style={[s.card, { padding: 10, maxWidth: 300, gap: 6 }]}>
          <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={s.body}>
            {t(error)}
          </Text>
          <View style={s.row}>
            <Button title={t("retry")} secondary onPress={() => void locate()} />
            {error === "locationPermanent" && Platform.OS !== "web" && (
              <Button
                title={t("openSettings")}
                secondary
                onPress={() => void Linking.openSettings()}
              />
            )}
            <Button title={t("selectLocation")} secondary onPress={()=>{setError("");onManual();}} />
          </View>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(busy ? "findingCurrentLocation" : "useCurrentLocation")}
        accessibilityState={{ disabled: busy || explain, busy }}
        disabled={busy || explain}
        onPress={() => void locate()}
        style={{
          width: 44,
          height: 44,
          borderRadius: 13,
          backgroundColor: colors.white,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        {busy ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Feather name="navigation" size={20} color={colors.accent} />
        )}
      </Pressable>
      <Modal visible={explain} transparent onRequestClose={() => setExplain(false)}>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 22,
            backgroundColor: "rgba(0,0,0,.2)",
          }}
        >
          <View style={s.card}>
            <Text style={s.heading}>{t("permissionTitle")}</Text>
            <Text style={s.body}>{t("locationExplain")}</Text>
            <Button
              title={t("continue")}
              onPress={() => {
                setExplain(false);
                void locate(true);
              }}
            />
            <Button title={t("cancel")} secondary onPress={() => setExplain(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
