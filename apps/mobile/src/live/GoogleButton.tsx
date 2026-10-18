import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { googleAuth } from "./google-auth";
import { criticalActivity } from "./update-logic";
import { authErrorKey } from "./auth-logic";
import { NeoFeedback, colors, styles as s } from "./ui";
export default function GoogleButton({
  t,
  link = false,
}: {
  t: (key: string) => string;
  link?: boolean;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const title = t(link ? "linkGoogle" : "continueGoogle");
  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        style={({ pressed }) => [
          s.card,
          { padding: 16, minHeight: 56, alignItems: "center", borderRadius: 16 },
          pressed && { backgroundColor: colors.pale },
        ]}
        onPress={async () => {
          if (pending.current) return;
          const releaseUpdateGuard = criticalActivity.begin();
          pending.current = true;
          setBusy(true);
          setError("");
          try {
            await googleAuth(link);
          } catch (e) {
            const key = authErrorKey(e);
            setError(
              key === "authProviderUnavailable"
                ? "googleUnavailable"
                : key === "genericError"
                  ? "googleFailed"
                  : key,
            );
          } finally {
            releaseUpdateGuard();
            pending.current = false;
            setBusy(false);
          }
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text
            accessible={false}
            style={{ fontSize: 22, fontWeight: "700", color: colors.accent }}
          >
            G
          </Text>
          <Text style={[s.label, { flexShrink: 1 }]}>{title}</Text>
        </View>
      </Pressable>
      {busy && <ActivityIndicator accessibilityLabel={t("wait")} color={colors.accent} />}
      {!!error && <NeoFeedback message={t(error)} tone="error" />}
    </View>
  );
}
