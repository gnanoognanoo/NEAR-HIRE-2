import React from "react";
import { Text, View } from "react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { styles as s } from "./ui";

export default function AboutNearHire({ t }: { t: (key: string) => string }) {
  return <View style={s.card}>
    <Text style={s.title}>{t("aboutNearHire")}</Text>
    <Text>{t("appVersion")}: {Constants.expoConfig?.version ?? "1.0.0"}</Text>
    <Text>{t("appBuild")}: {Constants.nativeBuildVersion ?? "—"}</Text>
    <Text selectable>{t("appRuntime")}: {Updates.runtimeVersion ?? "—"}</Text>
    <Text>{t("appChannel")}: {Updates.channel ?? (__DEV__ ? "development" : "—")}</Text>
    <Text selectable>{t("appUpdate")}: {Updates.updateId ?? t("embeddedUpdate")}</Text>
    <Text>{t("updatesNextRestart")}</Text>
  </View>;
}
