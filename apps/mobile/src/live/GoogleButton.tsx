import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { googleAuth } from "./google-auth";
import { authErrorKey } from "./auth-logic";
import { colors, styles as s } from "./ui";
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
        style={[s.input, { alignItems: "center", backgroundColor: colors.white }]}
        onPress={async () => {
          if (pending.current) return;
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
            pending.current = false;
            setBusy(false);
          }
        }}
      >
        <Text style={s.heading}>{title}</Text>
      </Pressable>
      {busy && <ActivityIndicator accessibilityLabel={t("wait")} color={colors.accent} />}
      {!!error && (
        <Text accessibilityRole="alert" style={s.body}>
          {t(error)}
        </Text>
      )}
    </View>
  );
}
