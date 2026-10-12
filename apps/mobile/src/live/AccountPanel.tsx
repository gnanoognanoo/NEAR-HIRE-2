import React from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Button, Choice, NeoSurface, NeoNavRow, NeoStatusBadge, colors, styles as s } from "./ui";
import type { Workspace } from "./workspace";
export function WorkspaceChooser({
  t,
  onChoose,
}: {
  t: (k: string) => string;
  onChoose: (w: Workspace) => void;
}) {
  return (
    <View style={{ gap: 24 }}>
      <Text style={s.title}>{t("workspaceQuestion")}</Text>
      <Text style={s.body}>{t("workspaceFlexible")}</Text>
      {(["find", "post"] as Workspace[]).map((w) => (
        <NeoSurface key={w}>
          <Feather name={w === "find" ? "search" : "briefcase"} size={28} color={colors.accent} />
          <Text style={s.heading}>{t(w)}</Text>
          <Button
            title={t(w)}
            secondary={w === "post"}
            icon="arrow-right"
            onPress={() => onChoose(w)}
          />
        </NeoSurface>
      ))}
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
    <View style={{ gap: 24 }}>
      <Text style={s.title}>{t("myProfile")}</Text>
      <NeoSurface>
        <View style={{ flexDirection: "row", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <NeoSurface
            compact
            style={{
              width: 80,
              height: 80,
              padding: 0,
              borderRadius: 28,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="user" size={34} color={colors.accent} />
          </NeoSurface>
          <View style={{ flex: 1, minWidth: 140, gap: 8 }}>
            <Text style={s.heading}>{profile.name}</Text>
            <Text style={s.body}>{profile.locality}</Text>
            {phoneVerified && <NeoStatusBadge label={t("phoneVerified")} status="verified" />}
          </View>
        </View>
        <Button
          title={t("editProfile")}
          secondary
          icon="edit-3"
          onPress={() => onNavigate("editProfile")}
        />
      </NeoSurface>
      <NeoSurface>
        <Text style={s.heading}>{t("useNearHireAs")}</Text>
        <View style={s.row}>
          {(["find", "post"] as Workspace[]).map((w) => (
            <Choice key={w} title={t(w)} selected={workspace === w} onPress={() => onSwitch(w)} />
          ))}
        </View>
        <Text style={s.body}>{t("workspaceFlexible")}</Text>
      </NeoSurface>
      <NeoNavRow
        title={t("profileCredits")}
        icon="briefcase"
        onPress={() => onNavigate("credits")}
      />
      <NeoNavRow
        title={t("loginSecurity")}
        icon="shield"
        onPress={() => onNavigate("loginSecurity")}
      />
      <NeoNavRow
        title={t("preferences")}
        icon="sliders"
        onPress={() => onNavigate("preferences")}
      />
      <Text style={s.heading}>{t("myActivity")}</Text>
      <NeoNavRow
        title={t("myApplications")}
        icon="file-text"
        onPress={() => onNavigate("applications")}
      />
      <NeoNavRow title={t("myPosts")} icon="clipboard" onPress={() => onNavigate("posts")} />
      <NeoNavRow title={t("settings")} icon="settings" onPress={() => onNavigate("settings")} />
    </View>
  );
}
