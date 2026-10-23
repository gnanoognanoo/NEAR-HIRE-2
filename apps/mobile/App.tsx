import React, { lazy, Suspense } from "react";
import { ActivityIndicator, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NeoThemeProvider, NeoHeader, colors } from "./src/live/ui";
// DEV gallery never imports the live client or creates an authenticated session.
// Release exports disable this branch regardless of environment flags.
const Root =
  __DEV__ && process.env.EXPO_PUBLIC_UI_PREVIEW === "true"
    ? lazy(() => import("./src/dev/WorkspacePreview"))
    : __DEV__ && process.env.EXPO_PUBLIC_DEMO_MODE === "true"
      ? lazy(() => import("./PreviewApp"))
      : lazy(() => import("./ProductionApp"));
export default function App() {
  return (
    <NeoThemeProvider>
      <StatusBar style="dark" />
      <Suspense
        fallback={
          <View
            style={{ flex: 1, backgroundColor: colors.canvas, justifyContent: "center", gap: 24 }}
          >
            <NeoHeader title="NearHire" />
            <ActivityIndicator color={colors.accent} />
          </View>
        }
      >
        <Root />
      </Suspense>
    </NeoThemeProvider>
  );
}
