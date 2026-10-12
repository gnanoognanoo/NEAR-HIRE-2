import React from "react";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, neoInset, NeoStatusBadge, styles as s } from "./ui";
export type CreditPackage = { id: string; credits: number; amount_paise: number; label: string };
export const packageSavings = (packages: CreditPackage[], p: CreditPackage) =>
  Math.max(
    0,
    (packages.find((v) => v.credits === 1)?.amount_paise || 0) * p.credits - p.amount_paise,
  );
export default function PaymentPackages({
  packages,
  selected,
  onSelect,
  t,
  disabled = false,
}: {
  packages: CreditPackage[];
  selected: string;
  onSelect: (id: string) => void;
  t: (k: string) => string;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 16 }} accessibilityRole="radiogroup">
      {packages.map((p) => {
        const active = selected === p.id;
        return (
          <Pressable
            key={p.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: active, disabled }}
            aria-checked={active}
            aria-disabled={disabled}
            accessibilityLabel={t("buyPackageLabel")
              .replace("{credits}", String(p.credits))
              .replace("{amount}", String(p.amount_paise / 100))}
            disabled={disabled}
            onPress={() => onSelect(p.id)}
            style={({ pressed }) => [
              s.card,
              {
                gap: 16,
                borderWidth: active ? 1.5 : 0.75,
                borderColor: active ? colors.accent : colors.line,
                backgroundColor: active ? colors.pale : colors.surface,
              },
              pressed && neoInset,
              disabled && { opacity: 0.65 },
            ]}
          >
            <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={[s.title, { fontSize: 32, lineHeight: 42 }]}>
                  ₹{p.amount_paise / 100}
                </Text>
                <Text style={s.label}>
                  {p.credits} {t("credits")}
                </Text>
              </View>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderColor: active ? colors.accent : colors.boundary,
                  backgroundColor: active ? colors.accent : colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {active && <Feather name="check" size={17} color={colors.white} />}
              </View>
            </View>
            <View style={s.row}>
              <NeoStatusBadge label={t(p.label)} />
              {packageSavings(packages, p) > 0 && (
                <Text style={[s.body, { color: colors.positiveText }]}>
                  {t("packageSavings").replace(
                    "{amount}",
                    String(packageSavings(packages, p) / 100),
                  )}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
