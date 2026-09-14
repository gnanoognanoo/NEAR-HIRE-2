import ReviewActivity, { type ReviewItem } from "./ReviewActivity";
import LocationPin from "../live/LocationPin";
// DEV ONLY: presentation fixtures, separate storage namespace, no auth or backend writes.
import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AccountPanel, { WorkspaceChooser } from "../live/AccountPanel";
import {
  parseWorkspace,
  workspaceHome,
  workspaceTabs,
  routeLabel,
  type Workspace,
} from "../live/workspace";
import { Button, Field, styles as s } from "../live/ui";
import { CreditBalanceChip } from "../live/JobCreditBalance";
import WorkerSurface from "../live/WorkerSurface";
import PreviewMap from "./PreviewMap";
import ScreenPreview, { Scene } from "./ScreenPreview";
import en from "../live/locales/en.json";
import ta from "../live/locales/ta.json";
export default function WorkspacePreview() {
  const [applications, setApplications] = useState<ReviewItem[]>([]);
  const [posts, setPosts] = useState<ReviewItem[]>([
    { id: "post-1", title: "bakeryHelper", status: "active", date: new Date().toISOString() },
    {
      id: "post-expired",
      title: "electrician",
      status: "expired",
      date: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ]);
  const [applying, setApplying] = useState({ id: "preview-bakery", titleKey: "bakeryHelper" });
  const [manual, setManual] = useState(false);
  const [devMenu, setDevMenu] = useState(false);
  const [workerPoint, setWorkerPoint] = useState({ latitude: 13.085, longitude: 80.21 });
  const [workspace, setWorkspace] = useState<Workspace | null>(null),
    [screen, setScreen] = useState("chooser"),
    [language, setLanguage] = useState<"en" | "ta">("en"),
    [credits, setCredits] = useState(12),
    [radius, setRadius] = useState(3000),
    [workerRadius, setWorkerRadius] = useState(3000),
    [query, setQuery] = useState(""),
    [gallery, setGallery] = useState(false),
    [name, setName] = useState("Kavitha"),
    [locality, setLocality] = useState("Anna Nagar, Chennai");
  const t = (k: string) => (language === "ta" ? ta : en)[k as keyof typeof en] || k;
  useEffect(() => {
    let alive = true;
    Promise.all([
      AsyncStorage.getItem("nearhire.dev.workspace"),
      AsyncStorage.getItem("nearhire.dev.language"),
    ]).then(([v, l]) => {
      if (alive && (l === "en" || l === "ta")) setLanguage(l);
      const w = parseWorkspace(v);
      if (alive && w) {
        setWorkspace(w);
        setScreen(workspaceHome(w));
      }
    });
    return () => {
      alive = false;
    };
  }, []);
  const changeLanguage = (l: "en" | "ta") => {
    setLanguage(l);
    void AsyncStorage.setItem("nearhire.dev.language", l);
  };
  const switchMode = (w: Workspace) => {
    setWorkspace(w);
    setScreen(workspaceHome(w));
    void AsyncStorage.setItem("nearhire.dev.workspace", w);
  };
  const go = (route: string) => setScreen(route === "home" ? "chooser" : route);
  const workers = [
    {
      worker_id: "dev-electrician",
      name: language === "ta" ? "ரமேஷ்" : "Ramesh",
      locality: t("annaNagar"),
      skills: [t("electrician")],
      categories: [],
      employment_types: ["part_time"],
      rating: 4.7,
      distance_m: 1500,
      approx_lat: 13.09,
      approx_lng: 80.22,
    },
    {
      worker_id: "dev-helper",
      name: language === "ta" ? "மீனா" : "Meena",
      locality: t("annaNagar"),
      skills: [t("bakeryHelper")],
      categories: [],
      employment_types: ["daily_wage"],
      rating: 4.5,
      distance_m: 2500,
      approx_lat: 13.08,
      approx_lng: 80.2,
    },
  ].filter(
    (w) =>
      w.distance_m <= workerRadius &&
      (!query || (w.name + " " + w.skills.join(" ")).toLowerCase().includes(query.toLowerCase())),
  );
  if (gallery)
    return (
      <View style={{ flex: 1 }}>
        <Button title="DEV · Workspace preview" onPress={() => setGallery(false)} />
        <ScreenPreview />
      </View>
    );
  const full = screen === "jobs" || screen === "workers";
  const simple = ["applications", "posts", "applicants"].includes(screen) ? (
    <ReviewActivity
      key={screen}
      screen={screen}
      t={t}
      applications={applications}
      posts={posts}
      setApplications={setApplications}
      setPosts={setPosts}
      credits={credits}
      spend={() => setCredits((v) => Math.max(0, v - 1))}
      go={go}
    />
  ) : screen === "application" ? (
    <>
      <Text style={s.title}>{t("confirmApply")}</Text>
      <Text style={s.heading}>{t(applying.titleKey)}</Text>
      <Text style={s.body}>{t("confirmApplyNote")}</Text>
      <Button
        title={t(applications.some((a) => a.id === applying.id) ? "applied" : "submit")}
        disabled={applications.some((a) => a.id === applying.id)}
        onPress={() => {
          setApplications((items) =>
            items.some((i) => i.id === applying.id)
              ? items
              : [
                  {
                    id: applying.id,
                    title: applying.titleKey,
                    status: "pending",
                    date: new Date().toISOString(),
                  },
                  ...items,
                ],
          );
          go("applications");
        }}
      />
      <Button title={t("cancel")} secondary onPress={() => go("jobs")} />
    </>
  ) : screen === "saved" ? (
    <>
      <Text style={s.title}>{t("saved")}</Text>
      <Text style={s.body}>{t("noActivity")}</Text>
    </>
  ) : screen === "chooser" ? (
    <>
      <WorkspaceChooser t={t} onChoose={switchMode} />
    </>
  ) : screen === "profile" ? (
    <AccountPanel
      profile={{ name, locality }}
      workspace={workspace || "find"}
      t={t}
      phoneVerified
      onSwitch={switchMode}
      onNavigate={go}
    />
  ) : screen === "editProfile" ? (
    <>
      <Text style={s.title}>{t("editProfile")}</Text>
      <Field label={t("name")} value={name} onChange={setName} />
      <Field label={t("locality")} value={locality} onChange={setLocality} />
      <Button title={t("save")} onPress={() => go("profile")} />
      <Button title={t("preferences")} secondary onPress={() => go("preferences")} />
    </>
  ) : screen === "post" ? (
    <>
      <Text style={s.title}>{t("postTypeQuestion")}</Text>
      <Button title={t("residential")} onPress={() => go("postResidential")} />
      <Button title={t("business")} secondary onPress={() => go("postBusiness")} />
    </>
  ) : null;
  const sceneRoute =
    (
      { applications: "history", posts: "history", editProfile: "profile" } as Record<
        string,
        string
      >
    )[screen] || screen;
  return (
    <SafeAreaProvider>
      <SafeAreaView style={[s.page, { alignItems: "center" }]}>
        <View style={{ width: "100%", maxWidth: 480, flex: 1 }}>
          <View style={{ padding: 12, gap: 8 }}>
            <View style={[s.row, { justifyContent: "space-between" }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="NearHire"
                onPress={() => {
                  if (__DEV__) setDevMenu(true);
                }}
                onLongPress={() => {
                  if (__DEV__) setDevMenu(true);
                }}
                delayLongPress={800}
              >
                <Text style={s.brand}>NearHire.</Text>
              </Pressable>
              {workspace === "post" && (
                <CreditBalanceChip balance={credits} t={t} onPress={() => go("credits")} />
              )}
            </View>
          </View>
          <View style={{ flex: 1, display: screen === "jobs" ? "flex" : "none" }}>
            <PreviewMap
              t={t}
              radius={radius}
              setRadius={setRadius}
              onApply={(job) => {
                if (job) setApplying(job);
                go("application");
              }}
            />
          </View>
          <View style={{ flex: 1, display: screen === "workers" ? "flex" : "none" }}>
            <WorkerSurface
              workers={workers}
              position={{ ...workerPoint, label: locality }}
              t={t}
              radius={workerRadius}
              onRadius={setWorkerRadius}
              onLocation={() => setManual(true)}
              onLocated={(p) => {
                setWorkerPoint(p);
                setLocality(t("currentLocation"));
              }}
              onPost={() => go("post")}
              query={query}
              onQuery={setQuery}
            />
          </View>
          {!full && (
            <ScrollView contentContainerStyle={s.content}>
              {![
                "chooser",
                "profile",
                "notifications",
                "applications",
                "posts",
                "applicants",
                "saved",
              ].includes(screen) && (
                <Button
                  title={t("back")}
                  secondary
                  onPress={() =>
                    go(
                      ["credits", "settings", "editProfile", "preferences"].includes(screen)
                        ? "profile"
                        : workspaceHome(workspace || "find"),
                    )
                  }
                />
              )}
              {simple || (
                <>
                  <Text style={s.heading}>
                    {["applications", "posts"].includes(screen) ? t(routeLabel(screen)) : ""}
                  </Text>
                  <Scene
                    key={screen + language}
                    screen={sceneRoute as any}
                    language={language}
                    t={t}
                    go={go}
                    setLanguage={changeLanguage}
                    radius={radius}
                    setRadius={setRadius}
                    credits={credits}
                    consumePreviewCredit={(summary) => {
                      setPosts((items) => [
                        {
                          id: `published-${Date.now()}`,
                          title:
                            summary?.title ||
                            (screen === "postResidential" ? "electrician" : "bakeryHelper"),
                          status: "active",
                          date: new Date().toISOString(),
                        },
                        ...items,
                      ]);
                      setCredits((v) => Math.max(0, v - 1));
                      setScreen("posts");
                    }}
                  />
                </>
              )}
            </ScrollView>
          )}
          {workspace && screen !== "chooser" && (
            <View style={s.nav}>
              {workspaceTabs(workspace).map((route) => (
                <View key={route} style={s.navItem}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: screen === route }}
                    onPress={() => go(route)}
                    style={{ minHeight: 48, width: "100%", padding: 4, justifyContent: "center" }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        textAlign: "center",
                        color: screen === route ? "#6941A5" : "#6F687A",
                      }}
                    >
                      {t(routeLabel(route))}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          <Modal visible={manual} onRequestClose={() => setManual(false)}>
            <View style={{ flex: 1 }}>
              <Button title={t("close")} secondary onPress={() => setManual(false)} />
              <LocationPin fill t={t} position={workerPoint} onMove={setWorkerPoint} />
              <View style={s.content}>
                <Field label={t("locality")} value={locality} onChange={setLocality} />
                <Button title={t("confirmLocation")} onPress={() => setManual(false)} />
              </View>
            </View>
          </Modal>
          <Modal visible={devMenu} transparent onRequestClose={() => setDevMenu(false)}>
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                padding: 22,
                backgroundColor: "rgba(0,0,0,.2)",
              }}
            >
              <View style={s.card}>
                <Text style={s.heading}>DEV</Text>
                <Button
                  title="DEV · Screens"
                  onPress={() => {
                    setDevMenu(false);
                    setGallery(true);
                  }}
                />
                <Button
                  title="DEV · Onboarding"
                  secondary
                  onPress={() => {
                    setDevMenu(false);
                    go("language");
                  }}
                />
                <Button title={t("close")} secondary onPress={() => setDevMenu(false)} />
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
