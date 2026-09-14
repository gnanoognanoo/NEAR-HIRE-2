import React from "react";
import { Text, View } from "react-native";
import { styles as s } from "./ui";
import { expiryDays, type CreditSummary } from "./credit-model";
export default function CreditBreakdown({
  summary,
  t,
}: {
  summary: CreditSummary;
  t: (key: string) => string;
}) {
  const days = expiryDays(summary);
  return (
    <View style={s.card}>
      <Text style={s.heading}>
        {t("creditMonthly")}: {summary.monthly}
      </Text>
      {days !== null && (
        <Text style={s.body}>{t("creditExpiresIn").replace("{days}", String(days))}</Text>
      )}
      <Text style={s.heading}>
        {t("otherCredits")}: {summary.other}
      </Text>
      <Text style={s.body}>
        {t("creditSignup")}: {summary.welcome}
      </Text>
      <Text style={s.body}>
        {t("purchasedCredits")}: {summary.purchased}
      </Text>
      <Text style={s.body}>{t("creditExpiryRule")}</Text>
      <Text style={s.body}>{t("workFree")}</Text>
    </View>
  );
}
