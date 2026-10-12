import React from "react";
import { Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button, NeoSurface, neoCompact, NeoStatusBadge, colors, styles as s } from "./ui";

// A display estimate only. publish_job remains authoritative and deducts atomically.
export function JobCreditBalance({
  balance,
  t,
  posting = false,
  onOpen,
}: {
  balance: number | null;
  t: (key: string) => string;
  posting?: boolean;
  onOpen?: () => void;
}) {
  return (
    <NeoSurface>
      <View style={s.row}>
        <Feather name="briefcase" size={18} color={colors.accent} />
        <Text style={s.label}>{t("credits")}</Text>
      </View>
      {balance === null ? (
        <Text style={s.heading}>{t("creditBalanceUnavailable")}</Text>
      ) : (
        <>
          <Text style={[s.title, { fontSize: 44, lineHeight: 56, color: colors.accent }]}>
            {balance}
          </Text>
          <Text style={s.label}>{t("availableCredits")}</Text>
        </>
      )}
      <Text style={s.body}>{t("creditUnit")}</Text>
      {posting && (
        <>
          <NeoStatusBadge label={t("postingCost")} />
          <Text style={s.body}>
            {t("balanceAfter")}: {balance === null ? "—" : Math.max(0, balance - 1)}
          </Text>
        </>
      )}
      {balance === 0 && <Text style={s.body}>{t("noCredits")}</Text>}
      {onOpen && (
        <Button
          title={t(balance === 0 ? "getCredits" : "viewCredits")}
          secondary
          onPress={onOpen}
        />
      )}
    </NeoSurface>
  );
}
export function PublishConfirmation({
  balance,
  t,
  busy = false,
  onConfirm,
  onCancel,
}: {
  balance: number | null;
  t: (key: string) => string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={s.card}>
      <Text style={s.heading}>{t("publishQuestion")}</Text>
      <Text style={s.body}>
        {t("availableCredits")}: {balance ?? "—"}
      </Text>
      <Text style={s.body}>{t("publicationExpiry")}</Text>
      <Text style={s.label}>{t("postingCost")}</Text>
      <Text style={s.body}>
        {t("balanceAfter")}: {balance === null ? "—" : Math.max(0, balance - 1)}
      </Text>
      <Text style={s.body}>{t("creditEstimate")}</Text>
      <Button
        title={t("publishJob")}
        loading={busy}
        icon="check"
        disabled={busy || balance === null || balance < 1}
        onPress={onConfirm}
      />
      <Button title={t("back")} secondary disabled={busy} onPress={onCancel} />
    </View>
  );
}

export function CreditBalanceChip({
  balance,
  t,
  onPress,
}: {
  balance: number | null;
  t: (key: string) => string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${balance ?? "—"} ${t("creditChipLabel")}`}
      onPress={onPress}
      style={{
        minHeight: 48,
        minWidth: 58,
        paddingHorizontal: 12,
        borderRadius: 16,
        ...neoCompact,
        backgroundColor: colors.pale,
        flexDirection: "row",
        gap: 6,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Feather name="briefcase" size={16} color={colors.accent} />
      <Text style={[s.label, { color: colors.accent }]}>{balance ?? "—"}</Text>
    </Pressable>
  );
}
export function PublishCost({
  balance,
  t,
  onOpen,
}: {
  balance: number | null;
  t: (key: string) => string;
  onOpen: () => void;
}) {
  return (
    <>
      <Text style={s.label}>{t("postingCost")}</Text>
      {balance === 0 && (
        <>
          <Text style={s.body}>{t("noCredits")}</Text>
          <Button title={t("goJobCredits")} secondary onPress={onOpen} />
        </>
      )}
    </>
  );
}
