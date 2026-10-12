import { NeoModal as Modal, NeoIconButton } from "./ui";
import React, { useRef, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import { deviceLocation, needsLocationExplanation } from "./device-location";
import { locationErrorKey, type Position } from "./location-logic";
import { locationStatus } from "./location-acquisition";
import { Button, styles as s } from "./ui";
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
    [explain, setExplain] = useState(false),
    [status, setStatus] = useState("");
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
      const label = locationStatus(p, t);
      setStatus(label);
      onLocated({ ...p, label });
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
    <View style={{ alignItems: "flex-end", gap: 8, flexShrink: 1, minWidth: 44 }}>
      {!!status && !error && (
        <Text accessibilityLiveRegion="polite" style={[s.body, { maxWidth: 210 }]}>
          {status}
        </Text>
      )}
      {!!error && (
        <View style={[s.card, { padding: 10, maxWidth: 300, gap: 6 }]}>
          <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={s.body}>
            {t(error)}
          </Text>
          <View style={s.row}>
            <Button title={t("retry")} secondary onPress={() => void locate()} />
            {(error === "locationPermanent" || error === "gpsDisabled") &&
              Platform.OS !== "web" && (
                <Button
                  title={t("openSettings")}
                  secondary
                  onPress={() => {
                    if (error === "gpsDisabled" && Platform.OS === "android")
                      void Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS").catch(
                        () => Linking.openSettings(),
                      );
                    else void Linking.openSettings();
                  }}
                />
              )}
            <Button
              title={t("selectLocation")}
              secondary
              onPress={() => {
                setError("");
                onManual();
              }}
            />
          </View>
        </View>
      )}
      <NeoIconButton
        name="navigation"
        label={t(busy ? "findingCurrentLocation" : "useCurrentLocation")}
        disabled={busy || explain}
        loading={busy}
        onPress={() => void locate()}
      />
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
