import React, { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { colors, styles as s } from "./ui";
import { radiusKmToMetres } from "./radius-logic";
export default function DistanceControl({
  metres,
  onChange,
  t,
}: {
  metres: number;
  onChange: (metres: number) => void;
  t: (key: string) => string;
}) {
  const [input, setInput] = useState(String(metres / 1000));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setInput(String(metres / 1000));
    setInvalid(false);
  }, [metres]);
  const update = (text: string) => {
    setInput(text);
    try {
      const next = radiusKmToMetres(text);
      setInvalid(false);
      onChange(next);
    } catch {
      setInvalid(true);
    }
  };
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{t("radius")}</Text>
      <View style={[s.row, { flexWrap: "nowrap" }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("distanceDecrease")}
          disabled={metres <= 1000}
          onPress={() => update(String(metres / 1000 - 1))}
          style={[s.button, { backgroundColor: colors.pale, opacity: metres <= 1000 ? 0.45 : 1 }]}
        >
          <Text style={{ color: colors.accent, fontSize: 22 }}>−</Text>
        </Pressable>
        <TextInput
          accessibilityLabel={t("customDistance")}
          value={input}
          onChangeText={update}
          keyboardType="number-pad"
          selectTextOnFocus
          style={[s.input, { flex: 1, minWidth: 0, textAlign: "center" }]}
          onSubmitEditing={() => update(input)}
        />
        <Text style={s.label}>{t("distanceKm")}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("distanceIncrease")}
          disabled={metres >= 50000}
          onPress={() => update(String(metres / 1000 + 1))}
          style={[s.button, { backgroundColor: colors.pale, opacity: metres >= 50000 ? 0.45 : 1 }]}
        >
          <Text style={{ color: colors.accent, fontSize: 22 }}>+</Text>
        </Pressable>
      </View>
      <Text accessibilityLiveRegion="polite" style={[s.body, { fontSize: 12 }]}>
        {invalid
          ? t("distanceInvalid")
          : `${t("distanceSelected")}: ${metres / 1000} ${t("distanceKm")} · ${t("distanceRange")}`}
      </Text>
    </View>
  );
}
