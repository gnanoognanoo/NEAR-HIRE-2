import React, { lazy, Suspense } from "react";
import { ActivityIndicator } from "react-native";
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
    <Suspense fallback={<ActivityIndicator />}>
      <Root />
    </Suspense>
  );
}
