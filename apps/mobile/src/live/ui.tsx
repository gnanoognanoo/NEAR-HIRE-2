import { SafeAreaView } from "react-native-safe-area-context";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ModalProps,
  type StyleProp,
  type TextInputProps,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { palette, softDepth, statusTone } from "./neo-tokens";
export const colors = palette;
const depth = (inset = false, compact = false): ViewStyle =>
  softDepth(Platform.OS, Number(Platform.Version), inset, compact);
export const neoRaised = depth(),
  neoInset = depth(true),
  neoCompact = depth(false, true);
const Motion = createContext(true);
export function NeoThemeProvider({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduced(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return <Motion.Provider value={reduced}>{children}</Motion.Provider>;
}
function usePressFeedback() {
  const reduced = useContext(Motion),
    scale = useRef(new Animated.Value(1)).current;
  const press = (down: boolean) => {
    scale.stopAnimation();
    if (reduced) scale.setValue(1);
    else
      Animated.timing(scale, {
        toValue: down ? 0.985 : 1,
        duration: 90,
        useNativeDriver: Platform.OS !== "web",
      }).start();
  };
  return { scale, onPressIn: () => press(true), onPressOut: () => press(false) };
}
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 24, gap: 24, width: "100%", maxWidth: 720, alignSelf: "center" },
  row: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  title: { fontSize: 28, lineHeight: 38, fontWeight: "700", color: colors.ink },
  heading: { fontSize: 20, lineHeight: 28, fontWeight: "600", color: colors.ink },
  body: { fontSize: 15, lineHeight: 24, color: colors.muted, flexShrink: 1 },
  label: { fontSize: 14, lineHeight: 22, color: colors.ink, fontWeight: "600", flexShrink: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    borderWidth: 0.75,
    borderColor: colors.line,
    borderTopColor: colors.highlight,
    borderLeftColor: colors.highlight,
    ...neoRaised,
  },
  input: {
    backgroundColor: colors.canvas,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
    borderWidth: 0.75,
    borderColor: colors.boundary,
    ...neoInset,
  },
  error: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerText,
    gap: 8,
  },
  notice: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.positiveSurface,
    borderWidth: 1,
    borderColor: colors.positive,
    gap: 8,
  },
  nav: {
    flexDirection: "row",
    marginHorizontal: 8,
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: colors.surface,
    ...neoCompact,
  },
  navItem: { flex: 1, minHeight: 56, alignItems: "center", justifyContent: "center", minWidth: 0 },
  brand: { fontWeight: "700", fontSize: 24, lineHeight: 32, color: colors.ink },
  tag: {
    alignSelf: "flex-start",
    color: colors.accent,
    backgroundColor: colors.pale,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
  button: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
    ...neoCompact,
  },
  buttonText: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "600",
    color: colors.white,
    textAlign: "center",
    flexShrink: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    maxHeight: "88%",
    borderTopWidth: 1,
    borderColor: colors.highlight,
  },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(37,50,71,0.32)" },
});
export function NeoSurface({
  inset = false,
  compact = false,
  style,
  children,
  ...rest
}: ViewProps & { inset?: boolean; compact?: boolean }) {
  return (
    <View
      {...rest}
      style={[
        styles.card,
        inset && { backgroundColor: colors.canvas, ...neoInset },
        compact && { padding: 16, borderRadius: 20, ...neoCompact },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export const NeoCard = NeoSurface;
export function NeoButton({
  title,
  onPress,
  disabled = false,
  secondary = false,
  loading = false,
  icon,
  tone = "brand",
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  loading?: boolean;
  icon?: React.ComponentProps<typeof Feather>["name"];
  tone?: "brand" | "danger";
}) {
  const motion = usePressFeedback(),
    off = disabled || loading;
  return (
    <Animated.View style={{ transform: [{ scale: motion.scale }], maxWidth: "100%" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: off, busy: loading }}
        aria-disabled={off}
        aria-busy={loading}
        disabled={off}
        onPress={onPress}
        onPressIn={motion.onPressIn}
        onPressOut={motion.onPressOut}
        style={({ pressed }) => [
          styles.button,
          secondary && {
            backgroundColor: colors.surface,
            borderColor: colors.line,
            borderTopColor: colors.white,
          },
          tone === "danger" && {
            backgroundColor: colors.dangerSurface,
            borderColor: colors.dangerText,
          },
          pressed &&
            !off && {
              ...neoInset,
              backgroundColor: secondary
                ? colors.canvas
                : tone === "danger"
                  ? colors.dangerSurface
                  : "#58358D",
            },
          off && { opacity: 0.65, boxShadow: undefined, elevation: 0 },
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            maxWidth: "100%",
          }}
        >
          {loading ? (
            <ActivityIndicator color={secondary ? colors.accent : colors.white} />
          ) : icon ? (
            <Feather
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no"
              name={icon}
              size={18}
              color={secondary ? colors.accent : colors.white}
            />
          ) : null}
          <Text
            style={[
              styles.buttonText,
              secondary && { color: colors.accent },
              tone === "danger" && { color: colors.dangerText },
            ]}
          >
            {title}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
export const Button = NeoButton;
export function NeoIconButton({
  name,
  label,
  onPress,
  disabled = false,
  loading = false,
  selected = false,
}: {
  name: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  selected?: boolean;
}) {
  const motion = usePressFeedback();
  return (
    <Animated.View style={{ transform: [{ scale: motion.scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: disabled || loading, busy: loading, selected }}
        aria-disabled={disabled || loading}
        aria-busy={loading}
        disabled={disabled || loading}
        onPress={onPress}
        onPressIn={motion.onPressIn}
        onPressOut={motion.onPressOut}
        style={({ pressed }) => [
          {
            width: 48,
            height: 48,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surface,
            borderWidth: 0.75,
            borderColor: selected ? colors.accent : colors.line,
            ...neoCompact,
          },
          (pressed || selected) && { backgroundColor: colors.pale, ...neoInset },
          disabled && { opacity: 0.65 },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Feather
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no"
            name={name}
            size={20}
            color={colors.accent}
          />
        )}
      </Pressable>
    </Animated.View>
  );
}
type InputProps = Omit<TextInputProps, "onChange"> & {
  label?: string;
  onChange?: (v: string) => void;
  numeric?: boolean;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};
export function NeoInput({
  label,
  value,
  onChange,
  onChangeText,
  numeric = false,
  multiline = false,
  maxLength,
  error,
  style,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ gap: 8, minWidth: 0, maxWidth: "100%" }, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        {...rest}
        accessibilityLabel={rest.accessibilityLabel || label}
        value={value}
        onChangeText={onChange || onChangeText}
        keyboardType={rest.keyboardType || (numeric ? "decimal-pad" : "default")}
        multiline={multiline}
        maxLength={maxLength ?? (multiline ? 3000 : 200)}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          multiline && { minHeight: 120, textAlignVertical: "top" },
          style,
          focused && { borderWidth: 2, borderColor: colors.accent },
          !!error && { borderColor: colors.dangerText },
        ]}
      />
      {!!error && (
        <Text accessibilityRole="alert" style={[styles.body, { color: colors.dangerText }]}>
          {error}
        </Text>
      )}
    </View>
  );
}
export const Field = NeoInput;
export function NeoChip({
  title,
  selected,
  onPress,
  disabled = false,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected, disabled }}
      aria-pressed={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          maxWidth: "100%",
          minHeight: 48,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 24,
          borderWidth: 0.75,
          borderColor: selected ? colors.accent : colors.line,
          backgroundColor: selected ? colors.pale : colors.surface,
          ...neoCompact,
        },
        (selected || pressed) && neoInset,
        disabled && { opacity: 0.65 },
      ]}
    >
      <View style={{ flexDirection: "row", gap: 6, alignItems: "center", maxWidth: "100%" }}>
        {selected && (
          <Feather
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no"
            name="check"
            size={14}
            color={colors.accent}
          />
        )}
        <Text
          style={{
            color: selected ? colors.accent : colors.muted,
            fontSize: 14,
            lineHeight: 22,
            fontWeight: selected ? "600" : "500",
            flexShrink: 1,
          }}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}
export const Choice = NeoChip;
export function NeoSegmentedControl({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.canvas, padding: 8, borderRadius: 24, ...neoInset },
      ]}
    >
      {items.map((i) => (
        <NeoChip
          key={i.value}
          title={i.label}
          selected={value === i.value}
          onPress={() => onChange(i.value)}
        />
      ))}
    </View>
  );
}
export function NeoHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={{ paddingHorizontal: 24, paddingVertical: 16, backgroundColor: colors.canvas }}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <NeoSurface
          compact
          style={{
            width: 48,
            height: 48,
            padding: 0,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 16,
          }}
        >
          <Feather
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no"
            name="briefcase"
            size={22}
            color={colors.accent}
          />
        </NeoSurface>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.brand}>
            {title}
            <Text style={{ color: colors.accent }}> .</Text>
          </Text>
          {subtitle && (
            <Text style={[styles.body, { fontSize: 12, lineHeight: 18 }]}>{subtitle}</Text>
          )}
        </View>
        {trailing}
      </View>
    </View>
  );
}
const navIcon: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  jobs: "map",
  workers: "users",
  posts: "briefcase",
  applications: "file-text",
  applicants: "user-check",
  notifications: "bell",
  profile: "user",
  home: "home",
  history: "clock",
};
export function NeoBottomNavigation({
  items,
  selected,
  onSelect,
}: {
  items: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.nav}>
      {items.map((item) => {
        const active = selected === item.id;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            aria-selected={active}
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => [
              {
                flex: 1,
                minWidth: 0,
                minHeight: 56,
                gap: 4,
                padding: 4,
                alignItems: "center",
                justifyContent: "flex-start",
                borderRadius: 18,
              },
              pressed && { backgroundColor: colors.pale },
            ]}
          >
            <View
              style={[
                {
                  width: 40,
                  height: 32,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                },
                active && { backgroundColor: colors.pale, ...neoInset },
              ]}
            >
              <Feather
                accessible={false}
                accessibilityElementsHidden
                importantForAccessibility="no"
                name={navIcon[item.id] || "grid"}
                size={19}
                color={active ? colors.accent : colors.muted}
              />
            </View>
            <Text
              style={{
                fontSize: 11,
                lineHeight: 17,
                textAlign: "center",
                fontWeight: active ? "700" : "500",
                color: active ? colors.accent : colors.muted,
                maxWidth: "100%",
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
export function NeoModal(props: ModalProps) {
  const reduced = useContext(Motion);
  return (
    <Modal {...props} animationType={reduced ? "none" : props.animationType || "fade"}>
      <View
        accessibilityViewIsModal
        style={{ flex: 1, backgroundColor: props.transparent ? "transparent" : colors.canvas }}
      >
        {props.children}
      </View>
    </Modal>
  );
}
export function NeoBottomSheetSurface({ children, style, ...rest }: ViewProps) {
  return (
    <View {...rest} style={[styles.sheet, style]}>
      <View
        accessible={false}
        style={{
          height: 4,
          width: 36,
          borderRadius: 4,
          alignSelf: "center",
          backgroundColor: colors.line,
          marginTop: 4,
          marginBottom: 8,
        }}
      />
      <SafeAreaView edges={["bottom"]} style={{ maxHeight: "100%" }}>
        {children}
      </SafeAreaView>
    </View>
  );
}
export function NeoStatusBadge({
  label,
  status = "draft",
  tone = statusTone(status),
}: {
  label: string;
  status?: string;
  tone?: "neutral" | "success" | "danger" | "warning";
}) {
  const foreground = {
      neutral: colors.accent,
      success: colors.positiveText,
      danger: colors.dangerText,
      warning: colors.warningText,
    }[tone],
    background = {
      neutral: colors.pale,
      success: colors.positiveSurface,
      danger: colors.dangerSurface,
      warning: colors.warningSurface,
    }[tone];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        gap: 6,
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: background,
        maxWidth: "100%",
      }}
    >
      <Feather
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
        name={
          tone === "success"
            ? "check-circle"
            : tone === "danger"
              ? "alert-circle"
              : tone === "warning"
                ? "clock"
                : "briefcase"
        }
        size={14}
        color={foreground}
      />
      <Text
        style={{
          fontSize: 13,
          lineHeight: 20,
          fontWeight: "600",
          color: foreground,
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
export function NeoFeedback({
  message,
  tone = "success",
}: {
  message: string;
  tone?: "success" | "error" | "warning";
}) {
  const foreground =
    tone === "error"
      ? colors.dangerText
      : tone === "warning"
        ? colors.warningText
        : colors.positiveText;
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      accessibilityLiveRegion={tone === "error" ? "assertive" : "polite"}
      style={[
        tone === "error" ? styles.error : styles.notice,
        tone === "warning" && {
          backgroundColor: colors.warningSurface,
          borderColor: colors.warningText,
        },
        { flexDirection: "row", gap: 12, alignItems: "flex-start" },
      ]}
    >
      <Feather
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
        name={tone === "error" ? "alert-circle" : tone === "warning" ? "clock" : "check-circle"}
        size={20}
        color={foreground}
      />
      <Text style={[styles.body, { color: foreground, flex: 1 }]}>{message}</Text>
    </View>
  );
}
export function NeoNavRow({
  title,
  onPress,
  icon = "chevron-right",
}: {
  title: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Feather>["name"];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { padding: 16, minHeight: 60, flexDirection: "row", alignItems: "center", gap: 16 },
        pressed && neoInset,
      ]}
    >
      <Feather
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
        name={icon}
        size={20}
        color={colors.accent}
      />
      <Text style={[styles.label, { flex: 1 }]}>{title}</Text>
      <Feather
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
        name="chevron-right"
        size={18}
        color={colors.muted}
      />
    </Pressable>
  );
}

export function NeoToggle({
  title,
  hint,
  selected,
  onPress,
}: {
  title: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          borderColor: selected ? colors.dangerText : colors.line,
        },
        pressed && neoInset,
      ]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.label}>{title}</Text>
        {hint && <Text style={styles.body}>{hint}</Text>}
      </View>
      <View
        style={{
          width: 48,
          height: 28,
          padding: 3,
          borderRadius: 16,
          backgroundColor: selected ? colors.dangerText : colors.boundary,
          alignItems: selected ? "flex-end" : "flex-start",
        }}
      >
        <View style={{ width: 22, height: 22, borderRadius: 12, backgroundColor: colors.white }} />
      </View>
    </Pressable>
  );
}

export function NeoOptionPicker({
  label,
  closeLabel,
  items,
  value,
  onChange,
}: {
  label: string;
  closeLabel: string;
  items: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <NeoButton
        title={items.find((i) => i.value === value)?.label || label}
        secondary
        icon="chevron-down"
        onPress={() => setOpen(true)}
      />
      <NeoModal transparent visible={open} onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <NeoBottomSheetSurface>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
              <View style={[styles.row, { justifyContent: "space-between" }]}>
                <Text style={[styles.heading, { flex: 1 }]}>{label}</Text>
                <NeoIconButton label={closeLabel} name="x" onPress={() => setOpen(false)} />
              </View>
              {items.map((item) => (
                <NeoChip
                  key={item.value}
                  title={item.label}
                  selected={value === item.value}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                />
              ))}
            </ScrollView>
          </NeoBottomSheetSurface>
        </View>
      </NeoModal>
    </>
  );
}
