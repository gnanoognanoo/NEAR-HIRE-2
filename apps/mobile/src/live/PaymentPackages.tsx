import React from "react";
import { Pressable, Text, View } from "react-native";
import { colors, styles as s } from "./ui";
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
    <View style={{ gap: 12 }}>
      {packages.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="radio"
          accessibilityState={{ checked: selected === p.id, disabled }}
          accessibilityLabel={t("buyPackageLabel")
            .replace("{credits}", String(p.credits))
            .replace("{amount}", String(p.amount_paise / 100))}
          disabled={disabled}
          onPress={() => onSelect(p.id)}
          style={[s.card, { borderColor: selected === p.id ? colors.accent : colors.line }]}
        >
          <Text style={s.heading}>
            {p.credits} {t("credits")}
          </Text>
          <Text style={s.title}>₹{p.amount_paise / 100}</Text>
          <Text style={s.label}>{t(p.label)}</Text>
          {packageSavings(packages, p) > 0 && (
            <Text style={s.body}>
              {t("packageSavings").replace("{amount}", String(packageSavings(packages, p) / 100))}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}
