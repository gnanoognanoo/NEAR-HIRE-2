import React from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button, Choice, colors, styles as s } from "./ui";
import type { Workspace } from "./workspace";
export function WorkspaceChooser({
  t,
  onChoose,
}: {
  t: (k: string) => string;
  onChoose: (w: Workspace) => void;
}) {
  return (
    <View style={{ gap: 20 }}>
      <Text style={s.title}>{t("workspaceQuestion")}</Text>
      <Text style={s.body}>{t("workspaceFlexible")}</Text>
      <Button title={t("find")} onPress={() => onChoose("find")} />
      <Button title={t("post")} secondary onPress={() => onChoose("post")} />
    </View>
  );
}
export default function AccountPanel({
  profile,
  workspace,
  t,
  onNavigate,
  onSwitch,
  phoneVerified = false,
}: {
  profile: { name: string; locality: string };
  workspace: Workspace;
  t: (k: string) => string;
  onNavigate: (r: string) => void;
  onSwitch: (w: Workspace) => void;
  phoneVerified?: boolean;
}) {
  return (
    <View style={{ gap: 20 }}>
      <Text style={s.title}>{t("myProfile")}</Text>
      <View style={s.card}>
        <View
          style={{
            backgroundColor: colors.pale,
            borderRadius: 36,
            width: 72,
            height: 72,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="user" size={32} color={colors.accent} />
        </View>
        <Text style={s.heading}>{profile.name}</Text>
        <Text style={s.body}>{profile.locality}</Text>
        {phoneVerified && <Text style={s.body}>{t("phoneVerified")}</Text>}
        <Button title={t("editProfile")} secondary onPress={() => onNavigate("editProfile")} />
      </View>
      <View style={s.card}>
        <Text style={s.heading}>{t("useNearHireAs")}</Text>
        <View style={s.row}>
          {(["find", "post"] as Workspace[]).map((w) => (
            <Choice key={w} title={t(w)} selected={workspace === w} onPress={() => onSwitch(w)} />
          ))}
        </View>
        <Text style={s.body}>{t("workspaceFlexible")}</Text>
      </View>
      <Button title={t("profileCredits")} secondary onPress={() => onNavigate("credits")} />
      <Button title={t("loginSecurity")} secondary onPress={() => onNavigate("loginSecurity")} />
      <Button title={t("preferences")} secondary onPress={() => onNavigate("preferences")} />
      <View style={s.card}>
        <Text style={s.heading}>{t("myActivity")}</Text>
        <Button title={t("myApplications")} secondary onPress={() => onNavigate("applications")} />
        <Button title={t("myPosts")} secondary onPress={() => onNavigate("posts")} />
      </View>
      <Button title={t("settings")} secondary onPress={() => onNavigate("settings")} />
    </View>
  );
}
