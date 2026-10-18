import React from "react";
import { Text, View } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { Button, NeoFeedback, styles as s } from "./ui";
import { useNearHireUpdates } from "./UpdateManager";

export default function AboutNearHire({ t }: { t: (key: string) => string }) {
  const updates = useNearHireUpdates();
  return (
    <View style={s.card}>
      <Text style={s.title}>{t("aboutNearHire")}</Text>
      <Text style={s.body}>
        {t("appVersion")}: {Constants.expoConfig?.version ?? "1.0.0"}
      </Text>
      <Text>
        {t("appBuild")}: {Constants.nativeBuildVersion ?? "—"}
      </Text>
      <Text selectable style={s.body}>
        {t("appRuntime")}: {Updates.runtimeVersion || "—"}
      </Text>
      <Text>
        {t("appChannel")}: {Updates.channel || (__DEV__ ? "development" : "—")}
      </Text>
      <Text selectable>
        {t("appUpdate")}: {Updates.updateId ?? t("embeddedUpdate")}
      </Text>
      <Text style={s.body}>
        {t("otaSource")}: {t(Updates.isEmbeddedLaunch ? "embeddedUpdate" : "otaDownloaded")}
      </Text>
      <Text style={s.body}>
        {t("otaEnabled")}: {t(Updates.isEnabled ? "yes" : "no")}
      </Text>
      <Text style={s.body}>
        {t("otaLastCheck")}: {t(updates.nativeError ? "otaFailed" : updates.result)}
      </Text>
      {!!updates.checkedAt && (
        <Text style={s.body}>{new Date(updates.checkedAt).toLocaleString()}</Text>
      )}
      {Updates.isEmergencyLaunch && <NeoFeedback tone="error" message={t("otaEmergency")} />}
      <Text>{t("updatesNextRestart")}</Text>
      <Button
        title={t("otaCheck")}
        loading={updates.busy}
        disabled={updates.busy}
        onPress={() => void updates.check()}
      />
      {updates.pending && (
        <Button
          title={t("otaRestart")}
          secondary
          disabled={updates.busy}
          onPress={() => void updates.restart()}
        />
      )}
    </View>
  );
}
