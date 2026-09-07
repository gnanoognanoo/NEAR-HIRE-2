import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
export const colors = {
  white: "#fff",
  ink: "#272231",
  muted: "#6F687A",
  accent: "#6941A5",
  pale: "#F5F1FA",
  line: "#E8E2EE",
};
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.white },
  content: { padding: 22, gap: 20, width: "100%", maxWidth: 850, alignSelf: "center" },
  row: { flexDirection: "row", gap: 10, alignItems: "center", flexWrap: "wrap" },
  title: {
    fontSize: 29,
    lineHeight: 38,
    fontWeight: "600",
    color: colors.ink,
    letterSpacing: -0.8,
  },
  heading: { fontSize: 20, fontWeight: "600", color: colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: colors.muted },
  label: { fontSize: 14, color: colors.ink, fontWeight: "500" },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 20,
    gap: 14,
    backgroundColor: colors.white,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 9,
    padding: 14,
    minHeight: 50,
    fontSize: 16,
    color: colors.ink,
  },
  error: { backgroundColor: "#FFF2F5", borderRadius: 10, padding: 15 },
  nav: { flexDirection: "row", borderTopWidth: 1, borderColor: colors.line, paddingVertical: 7 },
  navItem: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center" },
  brand: { fontWeight: "700", fontSize: 25, color: colors.ink, letterSpacing: -1 },
  tag: {
    color: colors.accent,
    backgroundColor: colors.pale,
    padding: 9,
    borderRadius: 8,
    fontSize: 13,
  },
  button: {
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
  },
  buttonText: { fontSize: 15, fontWeight: "600", color: colors.white },
  notice: { padding: 14, backgroundColor: colors.pale, borderRadius: 9 },
});
export function Button({
  title,
  onPress,
  disabled = false,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && { backgroundColor: colors.pale },
        { opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: colors.accent }]}>{title}</Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  numeric = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "decimal-pad" : "default"}
        multiline={multiline}
        maxLength={multiline ? 3000 : 200}
        style={[styles.input, multiline && { minHeight: 110, textAlignVertical: "top" }]}
      />
    </View>
  );
}
export function Choice({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        padding: 13,
        minHeight: 46,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.line,
        backgroundColor: selected ? colors.pale : colors.white,
      }}
    >
      <Text style={{ color: selected ? colors.accent : colors.muted, fontSize: 14 }}>{title}</Text>
    </Pressable>
  );
}
