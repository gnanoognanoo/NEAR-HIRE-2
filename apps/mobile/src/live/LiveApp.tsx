import PaymentPackages from "./PaymentPackages";
import JobSummary from "./JobSummary";
import AccountPanel, { WorkspaceChooser } from "./AccountPanel";
import NearbyWorkers from "./NearbyWorkers";
import {
  parseWorkspace,
  workspaceHome,
  workspaceTabs,
  routeLabel,
  backDestination,
  type Workspace,
} from "./workspace";
import { creditBalanceKey } from "./credit-query";
import DistanceControl from "./DistanceControl";
import { validateRadiusMetres } from "./radius-logic";
import {
  JobCreditBalance,
  PublishConfirmation,
  CreditBalanceChip,
  PublishCost,
} from "./JobCreditBalance";
import LocationPicker from "./LocationPicker";
import { activeNearby, type Position } from "./location-logic";
import PhoneAuth from "./PhoneAuth";
import { profileComplete, restoredSession, authErrorKey, withAuthTimeout } from "./auth-logic";
import React, { useEffect, useState, useRef, createContext, useContext } from "react";
import {
  Platform,
  ActivityIndicator,
  BackHandler,
  Linking,
  Modal,
  ScrollView,
  Text,
  View,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session } from "@supabase/supabase-js";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { db, configured, edge, rpc } from "./client";
import { openCheckout } from "./checkout";
import {
  applicationService,
  authService,
  creditService,
  jobService,
  locationService,
  notificationService,
  profileService,
  reportService,
  reviewService,
} from "./services";
import { Button, Choice, Field, styles as s, colors } from "./ui";
import DiscoverySurface from "./DiscoverySurface";
import en from "./locales/en.json";
import ta from "./locales/ta.json";
import { jobSchema } from "../../../../packages/core/validation";
type Lang = "en" | "ta";
const PaymentTestLogin = __DEV__ && process.env.EXPO_PUBLIC_PAYMENT_TEST_AUTH === "true"
  ? React.lazy(() => import("../dev/PaymentTestLogin"))
  : null;
type Translate = (key: string) => string;

type Run = (fn: () => Promise<unknown>, success?: string) => Promise<void>;
const csv = (v: string) =>
  v
    .split(",")
    .map((x) => x.trim())
    .slice(0, 30);
const codeMap: Record<string, string> = {
  INVALID_PHONE: "phoneError",
  INVALID_OTP: "otpError",
  CREDITS_REQUIRED: "creditsError",
  JOB_UNAVAILABLE: "jobUnavailable",
  ALREADY_APPLIED: "duplicate",
  LOCATION_PERMISSION_DENIED: "locationDenied",
  SERVICE_NOT_CONFIGURED: "serviceUnavailable",
  RATE_LIMITED: "limit",
  AUTH_REQUIRED: "authError",
  RESOLVE_ACTIVE_WORK_FIRST: "accountActive",
};
const FeedbackContext = createContext({ error: "", message: "", busy: false, t: (k: string) => k });
function Feedback() {
  const { error, message, busy, t } = useContext(FeedbackContext);
  return (
    <>
      {busy && <ActivityIndicator color={colors.accent} />}{" "}
      {!!error && (
        <Text accessibilityRole="alert" style={s.body}>
          {t(error)}
        </Text>
      )}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={s.body}>
          {t(message)}
        </Text>
      )}
    </>
  );
}
export default function LiveApp() {
  const loadNextJobs = useRef<() => void>(() => {});
  const busyRef = useRef(false);
  const qc = useQueryClient();
  const [language, setLanguage] = useState<Lang | null>(null);
  const [bootError, setBootError] = useState(false);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [boot, setBoot] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState("jobs");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const restoredWorkspaceUser = useRef<string | null>(null);
  const [searchRadius, setSearchRadius] = useState(3000);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const t: Translate = (k) =>
    (language === "ta" ? ta : en)[k as keyof typeof en] || en[k as keyof typeof en] || k;
  useEffect(() => {
    let alive = true;
    let authRevision = 0;
    setBoot(true);
    setBootError(false);
    Promise.all([
      AsyncStorage.getItem("nearhire.language"),
      db ? withAuthTimeout(db.auth.getSession()) : undefined,
    ])
      .then(([l, a]) => {
        if (alive) {
          setLanguage(l === "en" || l === "ta" ? l : null);
          const restored = a ? restoredSession(a) : null;
          if (authRevision === 0) setSession(restored);
        }
      })
      .catch(() => {
        if (alive) setBootError(true);
      })
      .finally(() => {
        if (alive) setBoot(false);
      });
    const sub = db?.auth.onAuthStateChange((_event, newSession) => {
      if (!alive) return;
      if (_event !== "INITIAL_SESSION") authRevision++;
      setSession(newSession);
      if (newSession) setBootError(false);
      if (!newSession) {
        qc.clear();
        setScreen("jobs");
        setPosition(null);
        setLocationOpen(false);
        setError("");
        setMessage("");
      }
    });
    return () => {
      alive = false;
      sub?.data.subscription.unsubscribe();
    };
  }, [qc, bootAttempt]);
  useEffect(() => {
    if (!session) return;
    const sub = notificationService.subscribeRefresh();
    return () => sub.remove();
  }, [session]);
  const profile = useQuery({
    queryKey: ["profile", session?.user.id],
    queryFn: profileService.get,
    enabled: !!session,
  });
  useEffect(() => {
    if (!session) {
      restoredWorkspaceUser.current = null;
      setWorkspace(null);
      return;
    }
    if (profile.data && restoredWorkspaceUser.current !== session.user.id) {
      restoredWorkspaceUser.current = session.user.id;
      const w = parseWorkspace(profile.data.last_workspace);
      setWorkspace(w);
      if (w) setScreen(workspaceHome(w));
    }
  }, [session?.user.id, profile.data]);
  const switchWorkspace = async (w: Workspace) => {
    try {
      await rpc("set_workspace", { p_workspace: w });
      setWorkspace(w);
      setScreen(workspaceHome(w));
      await qc.invalidateQueries({ queryKey: ["profile"] });
    } catch {
      setError("workspaceSaveError");
    }
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!workspace) return false;
      const next = backDestination(screen, workspace);
      if (!next) return false;
      setScreen(next);
      return true;
    });
    return () => sub.remove();
  }, [screen, workspace]);
  const workerPreferences = useQuery({
    queryKey: ["preferences"],
    queryFn: profileService.getPreferences,
    enabled: !!session,
  });
  useEffect(() => {
    try {
      setSearchRadius(validateRadiusMetres(workerPreferences.data?.radius_m ?? 3000));
    } catch {
      setSearchRadius(3000);
    }
  }, [workerPreferences.data?.radius_m, session?.user.id]);
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await db!.from("job_categories").select("*").order("name_en");
      if (error) throw error;
      return data;
    },
    enabled: !!session,
  });
  const choose = (l: Lang) => {
    setLanguage(l);
    AsyncStorage.setItem("nearhire.language", l).catch(() => setError("genericError"));
  };
  const [creditOverlay, setCreditOverlay] = useState(false);
  const run: Run = async (fn, success = "success") => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await qc.invalidateQueries();
      if (success) setMessage(success);
    } catch (e) {
      const text = (e as { message?: string }).message || "";
      const code = Object.keys(codeMap).find((k) => text.includes(k));
      setError(
        code
          ? codeMap[code]
          : text.toLowerCase().includes("otp") || text.toLowerCase().includes("token has expired")
            ? "otpError"
            : authErrorKey(e),
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  if (boot)
    return (
      <SafeAreaView style={s.page}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  const content = bootError ? (
    <>
      <Text style={s.body}>{t("sessionRestoreError")}</Text>
      <Button title={t("retry")} onPress={() => setBootAttempt((v) => v + 1)} />
    </>
  ) : !language ? (
    <>
      <Text style={s.title}>{t("chooseLanguage")}</Text>
      <Button title="English" onPress={() => choose("en")} />
      <Button title="தமிழ்" secondary onPress={() => choose("ta")} />
    </>
  ) : !configured ? (
    <>
      <Text style={s.title}>{t("setup")}</Text>
      <Text style={s.body}>{t("setupBody")}</Text>
    </>
  ) : !session ? (
    <>
      <PhoneAuth t={t} onVerified={() => setMessage("otpSuccess")} />
      {PaymentTestLogin && <React.Suspense fallback={<ActivityIndicator />}><PaymentTestLogin /></React.Suspense>}
    </>
  ) : profile.isPending ? (
    <ActivityIndicator color={colors.accent} />
  ) : profile.isError ? (
    <>
      <Text style={s.body}>{t("genericError")}</Text>
      <Button title={t("retry")} onPress={() => profile.refetch()} />
      <Button title={t("logout")} secondary onPress={() => run(authService.logout, "")} />
    </>
  ) : !profileComplete(profile.data) ? (
    <ProfileForm
      initial={profile.data}
      language={language}
      t={t}
      busy={busy}
      onSave={(p) =>
        run(async () => {
          await profileService.save(p);
          setScreen("profile");
        })
      }
    />
  ) : !workspace ? (
    <WorkspaceChooser t={t} onChoose={(w) => void switchWorkspace(w)} />
  ) : (
    <>
      {["editProfile", "credits", "settings", "preferences", "post"].includes(screen) && (
        <Button
          title={t("back")}
          secondary
          onPress={() => setScreen(backDestination(screen, workspace) || workspaceHome(workspace))}
        />
      )}
      {screen === "credits" && (
        <>
          <Button title={t("profile")} secondary onPress={() => setScreen("profile")} />
          <Text style={s.title}>{t("profileCredits")}</Text>
          <Credits t={t} />
        </>
      )}
      <View style={{ flex: 1, display: screen === "jobs" ? "flex" : "none" }}>
        <Jobs
          radius={searchRadius}
          setRadius={setSearchRadius}
          loadMoreRef={loadNextJobs}
          t={t}
          position={position}
          chooseLocation={() => setLocationOpen(true)}
          onLocated={setPosition}
          run={run}
          busy={busy}
          categories={categories.data || []}
          language={language}
        />
      </View>
      <View style={{ flex: 1, display: screen === "workers" ? "flex" : "none" }}>
        <NearbyWorkers
          position={position}
          t={t}
          onLocation={() => setLocationOpen(true)}
          onLocated={setPosition}
          onPost={() => setScreen("post")}
        />
      </View>
      {screen === "post" && (
        <Post
          openCredits={() => setCreditOverlay(true)}
          t={t}
          position={position}
          chooseLocation={() => setLocationOpen(true)}
          categories={categories.data || []}
          language={language}
          busy={busy}
          run={run}
          onDone={() => setScreen("posts")}
        />
      )}
      {screen === "posts" && (
        <View style={s.row}>
          <Button title={t("postAJob")} onPress={() => setScreen("post")} />
          <Button title={t("nearbyWorkers")} secondary onPress={() => setScreen("workers")} />
        </View>
      )}
      {["applications", "posts", "applicants", "saved"].includes(screen) && (
        <Activity
          openCredits={() => setCreditOverlay(true)}
          key={screen}
          t={t}
          run={run}
          busy={busy}
          saved={screen === "saved"}
          initialMode={screen}
        />
      )}
      {screen === "notifications" && <Updates t={t} run={run} />}
      {screen === "preferences" && (
        <Preferences
          t={t}
          categories={categories.data || []}
          language={language}
          busy={busy}
          run={run}
        />
      )}
      {screen === "profile" && (
        <AccountPanel
          profile={profile.data}
          workspace={workspace}
          t={t}
          phoneVerified={!!session.user.phone_confirmed_at}
          onSwitch={(w) => void switchWorkspace(w)}
          onNavigate={setScreen}
        />
      )}
      {screen === "editProfile" && (
        <>
          <ProfileForm
            initial={profile.data}
            language={language}
            t={t}
            busy={busy}
            onSave={(p) =>
              run(async () => {
                await profileService.save(p);
                setScreen("profile");
              })
            }
          />
        </>
      )}
      {screen === "settings" && (
        <>
          <Text style={s.title}>{t("settings")}</Text>
          <View style={s.row}>
            <Choice
              title="English"
              selected={language === "en"}
              onPress={() => {
                choose("en");
                run(() => profileService.save({ ...profile.data, preferred_language: "en" }));
              }}
            />
            <Choice
              title="தமிழ்"
              selected={language === "ta"}
              onPress={() => {
                choose("ta");
                run(() => profileService.save({ ...profile.data, preferred_language: "ta" }));
              }}
            />
          </View>
          <Button title={t("preferences")} secondary onPress={() => setScreen("preferences")} />
          <Button title={t("credits")} secondary onPress={() => setScreen("credits")} />
          <Button
            title={t("enablePush")}
            secondary
            onPress={() => run(notificationService.enable)}
          />
          {!!process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL && (
            <Button
              title={t("privacyPolicy")}
              secondary
              onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL!)}
            />
          )}
          <Button title={t("logout")} secondary onPress={() => run(authService.logout, "")} />
          <DeleteAccount t={t} busy={busy} run={run} />
        </>
      )}
    </>
  );
  return (
    <FeedbackContext.Provider value={{ error, message, busy, t }}>
      {creditOverlay && (
        <Modal visible={creditOverlay} onRequestClose={() => setCreditOverlay(false)}>
          <SafeAreaView style={s.page}>
            <ScrollView contentContainerStyle={s.content}>
              <Button
                title={t("returnJobReview")}
                secondary
                onPress={() => setCreditOverlay(false)}
              />
              <Credits t={t} />
            </ScrollView>
          </SafeAreaView>
        </Modal>
      )}
      <SafeAreaView style={s.page}>
        <View
          style={{
            paddingHorizontal: 22,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderColor: colors.line,
          }}
        >
          <View style={[s.row, { justifyContent: "space-between", flexWrap: "nowrap" }]}>
            <Text style={s.brand}>
              {t("brand")}
              <Text style={{ color: colors.accent }}>.</Text>
            </Text>
            {session && workspace === "post" && (
              <LiveCreditChip t={t} onOpen={() => setScreen("credits")} />
            )}
          </View>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={200}
          onScroll={({ nativeEvent: e }) => {
            if (
              screen === "jobs" &&
              e.layoutMeasurement.height + e.contentOffset.y >= e.contentSize.height - 350
            )
              loadNextJobs.current();
          }}
          style={{ flex: 1 }}
          contentContainerStyle={[
            s.content,
            ["jobs", "workers"].includes(screen) &&
            workspace &&
            session &&
            profileComplete(profile.data)
              ? { flex: 1, padding: 0, gap: 0 }
              : {},
          ]}
        >
          {!!error && (
            <View accessibilityRole="alert" style={s.error}>
              <Text style={s.body}>{t(error)}</Text>
            </View>
          )}
          {!!message && (
            <View accessibilityLiveRegion="polite" style={s.notice}>
              <Text style={s.body}>{t(message)}</Text>
            </View>
          )}
          {busy && <ActivityIndicator color={colors.accent} />} {content}
        </ScrollView>
        {!!session && !!workspace && profileComplete(profile.data) && (
          <View style={s.nav}>
            {workspaceTabs(workspace!).map((k) => (
              <View key={k} style={s.navItem}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: screen === k || (k === "profile" && screen === "credits"),
                  }}
                  onPress={() => {
                    setScreen(k);
                    setError("");
                    setMessage("");
                  }}
                  style={{ minHeight: 48, padding: 4, justifyContent: "center", width: "100%" }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      textAlign: "center",
                      color:
                        screen === k || (k === "profile" && screen === "credits")
                          ? colors.accent
                          : colors.muted,
                    }}
                  >
                    {t(routeLabel(k))}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <Modal visible={locationOpen} onRequestClose={() => setLocationOpen(false)}>
          <SafeAreaView style={s.page}>
            <View style={{ flex: 1 }}>
              <Feedback />
              <Button title={t("close")} secondary onPress={() => setLocationOpen(false)} />
              <LocationPicker
                t={t}
                initial={position}
                onSelect={(p) => {
                  setPosition(p);
                  setLocationOpen(false);
                }}
              />
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </FeedbackContext.Provider>
  );
}
function ProfileForm({
  initial,
  language,
  t,
  busy,
  onSave,
}: {
  initial: any;
  language: Lang;
  t: Translate;
  busy: boolean;
  onSave: (p: any) => void;
}) {
  const [p, setP] = useState({ ...initial, preferred_language: language });
  const update = (key: string, v: any) => setP((old: any) => ({ ...old, [key]: v }));
  return (
    <View style={s.card}>
      <Text style={s.heading}>{t("profile")}</Text>
      {["name", "locality", "city", "district", "state"].map((k) => (
        <Field key={k} label={t(k)} value={p[k] || ""} onChange={(v) => update(k, v)} />
      ))}
      <Field
        label={t("languages")}
        value={(p.languages || ["en"]).join(", ")}
        onChange={(v) => update("languages", csv(v))}
      />
      {["visible", "notifications_enabled"].map((k, i) => (
        <View key={k} style={{ gap: 10 }}>
          <Text style={s.label}>{t(i ? "notificationEnabled" : "profileVisible")}</Text>
          <View style={s.row}>
            {[true, false].map((v) => (
              <Choice
                key={String(v)}
                title={t(v ? "yes" : "no")}
                selected={p[k] === v}
                onPress={() => update(k, v)}
              />
            ))}
          </View>
        </View>
      ))}
      <Button
        title={t("save")}
        disabled={
          busy || !p.name || p.name.trim().length < 2 || !p.locality || p.locality.trim().length < 2
        }
        onPress={() => onSave(p)}
      />
    </View>
  );
}
function Jobs({
  radius,
  setRadius,
  loadMoreRef,
  t,
  position,
  chooseLocation,
  onLocated,
  run,
  busy,
  categories,
  language,
}: {
  radius: number;
  setRadius: (value: number) => void;
  loadMoreRef: React.RefObject<() => void>;
  t: Translate;
  position: Position | null;
  chooseLocation: () => void;
  onLocated: (p: Position) => void;
  run: Run;
  busy: boolean;
  categories: any[];
  language: Lang;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [kind, setKind] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("recommended");
  const [minPay, setMinPay] = useState("");
  const [maxPay, setMaxPay] = useState("");
  const [employment, setEmployment] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");
  const [payUnit, setPayUnit] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const [selected, setSelected] = useState<any>(null);
  const [confirmApply, setConfirmApply] = useState(false);
  const [appliedIds, setAppliedIds] = useState<string[]>([]);
  const applyGate = useRef(false);
  useEffect(() => setConfirmApply(false), [selected?.id]);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(id);
  }, [query]);
  const results = useInfiniteQuery({
    placeholderData: keepPreviousData,
    queryKey: [
      "jobs",
      position,
      radius,
      kind,
      category,
      sort,
      debounced,
      minPay,
      maxPay,
      employment,
      filterLanguage,
      payUnit,
    ],
    queryFn: ({ pageParam }) =>
      jobService.nearby(
        position!.latitude,
        position!.longitude,
        radius,
        {
          kind,
          category,
          sort,
          query: debounced,
          min_pay: Number(minPay) || 0,
          max_pay: maxPay ? Number(maxPay) : 1000000,
          employment_type: employment,
          language: filterLanguage,
          pay_unit: payUnit,
        },
        pageParam,
      ),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === 20 ? all.length * 20 : undefined),
    enabled: !!position,
    refetchInterval: 30000,
  });
  useEffect(() => {
    loadMoreRef.current = () => {
      if (results.hasNextPage && !results.isFetching) void results.fetchNextPage();
    };
    return () => {
      loadMoreRef.current = () => {};
    };
  }, [loadMoreRef, results]);
  const visibleJobs = activeNearby(results.data?.pages.flat() || [], now);
  useEffect(() => {
    if (selected && Date.parse(selected.expires_at) <= now) setSelected(null);
  }, [selected, now]);
  return (
    <View style={{ flex: 1 }}>
      {!position ? (
        <View style={s.content}>
          <Text style={s.body}>{t("noLocation")}</Text>
          <Button title={t("select")} onPress={chooseLocation} />
        </View>
      ) : (
        <DiscoverySurface
          position={position}
          jobs={visibleJobs}
          radius={radius}
          onRadius={setRadius}
          t={t}
          query={query}
          onQuery={setQuery}
          kind={kind}
          onKind={(k) => {
            setKind(k);
            setCategory("");
          }}
          locality={position.label || t("selectedLocation")}
          onLocation={chooseLocation}
          onLocated={onLocated}
          onViewJob={setSelected}
          loading={results.isFetching}
          error={results.isError}
          onRetry={() => void results.refetch()}
          hasMore={results.hasNextPage}
          filters={
            <>
              <ScrollView horizontal>
                <View style={s.row}>
                  <Choice title={t("all")} selected={!category} onPress={() => setCategory("")} />
                  {categories
                    .filter((c) => !kind || c.kind === kind)
                    .map((c) => (
                      <Choice
                        key={c.id}
                        title={language === "ta" ? c.name_ta : c.name_en}
                        selected={category === c.id}
                        onPress={() => setCategory(c.id)}
                      />
                    ))}
                </View>
              </ScrollView>

              <View style={s.row}>
                {["recommended", "nearest", "pay", "newest"].map((k) => (
                  <Choice
                    key={k}
                    title={t(k === "pay" ? "paySort" : k)}
                    selected={sort === k}
                    onPress={() => setSort(k)}
                  />
                ))}
              </View>

              {
                <>
                  <Field label={t("minPay")} value={minPay} onChange={setMinPay} numeric />
                  <Field label={t("maxPay")} value={maxPay} onChange={setMaxPay} numeric />
                  <View style={s.row}>
                    {[
                      "",
                      "temporary",
                      "full_time",
                      "part_time",
                      "daily_wage",
                      "weekend",
                      "shift",
                    ].map((k) => (
                      <Choice
                        key={k}
                        title={t(k || "all")}
                        selected={employment === k}
                        onPress={() => setEmployment(k)}
                      />
                    ))}
                  </View>
                  <View style={s.row}>
                    {["", "ta", "en"].map((k) => (
                      <Choice
                        key={k}
                        title={k || t("allLanguages")}
                        selected={filterLanguage === k}
                        onPress={() => setFilterLanguage(k)}
                      />
                    ))}
                  </View>
                  <View style={s.row}>
                    {["", "hour", "day", "job", "month"].map((k) => (
                      <Choice
                        key={k}
                        title={t(k || "allPayUnits")}
                        selected={payUnit === k}
                        onPress={() => setPayUnit(k)}
                      />
                    ))}
                  </View>
                </>
              }
              <Button
                title={t("refresh")}
                secondary
                disabled={results.isFetching}
                onPress={() => void results.refetch()}
              />
              <Button
                title={t("enableNearbyAlerts")}
                secondary
                onPress={() =>
                  run(async () => {
                    await notificationService.enable();
                    await locationService.alerts(position!.latitude, position!.longitude, true);
                  }, "alertsSaved")
                }
              />
              <Button
                title={t("disableNearbyAlerts")}
                secondary
                onPress={() =>
                  run(
                    () => locationService.alerts(position.latitude, position.longitude, false),
                    "alertsSaved",
                  )
                }
              />
            </>
          }
          listContent={
            <>
              {visibleJobs.map((item) => (
                <View key={item.job.id} style={s.card}>
                  <Text style={s.heading}>{item.job.title}</Text>
                  <Text style={s.body}>
                    {t(item.job.kind)} · {t(item.job.employment_type)} ·{" "}
                    {categories.find((c) => c.id === item.job.category)?.[
                      language === "ta" ? "name_ta" : "name_en"
                    ] || item.job.category}
                  </Text>
                  <Text style={s.body}>
                    {Math.max(0, Math.ceil((Date.parse(item.job.expires_at) - now) / 60000))}{" "}
                    {t("minutesLeft")} · {t("posted")}{" "}
                    {new Date(item.job.published_at).toLocaleTimeString(
                      language === "ta" ? "ta-IN" : "en-IN",
                    )}
                  </Text>
                  <Text style={s.body}>
                    {item.job.locality} · {t("approximate")} {item.distance_m / 1000} km
                  </Text>
                  <Text style={s.heading}>
                    ₹{item.job.pay} / {t(item.job.pay_unit)}
                  </Text>
                  <Text style={s.tag}>
                    {item.match_score}% {t("match")}
                  </Text>
                  <Button title={t("details")} secondary onPress={() => setSelected(item.job)} />
                </View>
              ))}
              {results.hasNextPage && (
                <Button
                  title={t("loadMore")}
                  disabled={results.isFetchingNextPage}
                  onPress={() => results.fetchNextPage()}
                />
              )}
            </>
          }
        />
      )}
      <Modal visible={!!selected} onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={s.page}>
          <ScrollView contentContainerStyle={s.content}>
            <Feedback />
            <Button title={t("close")} secondary onPress={() => setSelected(null)} />
            {selected && (
              <>
                <JobSummary
                  job={selected}
                  t={t}
                  distance={visibleJobs.find((j) => j.job.id === selected.id)?.distance_m}
                />
                {confirmApply ? (
                  <View style={s.card}>
                    <Text style={s.heading}>{t("confirmApply")}</Text>
                    <Text style={s.body}>{t("confirmApplyNote")}</Text>
                    <Button
                      title={t("submit")}
                      disabled={busy}
                      onPress={() => {
                        if (applyGate.current) return;
                        applyGate.current = true;
                        void run(async () => {
                          try {
                            await applicationService.apply(selected.id);
                            setAppliedIds((ids) => [...ids, selected.id]);
                            setConfirmApply(false);
                          } finally {
                            applyGate.current = false;
                          }
                        }, "applied");
                      }}
                    />
                    <Button
                      title={t("cancel")}
                      secondary
                      disabled={busy}
                      onPress={() => setConfirmApply(false)}
                    />
                  </View>
                ) : (
                  <Button
                    title={t(appliedIds.includes(selected.id) ? "applied" : "apply")}
                    disabled={
                      busy ||
                      appliedIds.includes(selected.id) ||
                      Date.parse(selected.expires_at) <= now
                    }
                    onPress={() => setConfirmApply(true)}
                  />
                )}
                <Button
                  title={t("bookmark")}
                  secondary
                  onPress={() => run(() => jobService.save(selected.id))}
                />
                <Safety t={t} target={selected.id} userId={selected.poster_id} run={run} />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
function AsyncState({ query, t }: { query: any; t: Translate }) {
  return query.isPending ? (
    <ActivityIndicator color={colors.accent} />
  ) : query.isError ? (
    <>
      <Text style={s.body}>{t("genericError")}</Text>
      <Button title={t("retry")} onPress={() => query.refetch()} />
    </>
  ) : !(query.data?.pages?.flat().length ?? query.data?.length) ? (
    <Text style={s.body}>{t("empty")}</Text>
  ) : null;
}
function Post({
  openCredits,
  t,
  position,
  chooseLocation,
  categories,
  language,
  busy,
  run,
  onDone,
}: {
  t: Translate;
  position: Position | null;
  chooseLocation: () => void;
  categories: any[];
  language: Lang;
  busy: boolean;
  run: Run;
  onDone: () => void;
  openCredits: () => void;
}) {
  const [p, setP] = useState<any>({
    kind: "business",
    pay_unit: "day",
    workers_required: "1",
    pay: "",
    title: "",
    description: "",
    schedule: "",
    locality: "",
    exact_address: "",
    required_languages: ["ta"],
    required_skills: [],
    employment_type: "temporary",
  });
  useEffect(() => {
    if (position)
      setP((old: any) => ({
        ...old,
        locality: position.locality || old.locality,
        city: position.city || old.city,
        district: position.district || old.district,
        state: position.state || old.state,
        country: position.country || old.country || "IN",
        exact_address: position.formatted_address || old.exact_address,
      }));
  }, [position]);
  const [typeChosen, setTypeChosen] = useState(false);
  const [requestId] = useState(() => Crypto.randomUUID());
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const creditQuery = useQuery({ queryKey: creditBalanceKey, queryFn: creditService.balance });
  const update = (k: string, v: any) => setP((old: any) => ({ ...old, [k]: v }));
  const submit = (publish: boolean) => {
    const parsed = jobSchema.safeParse({
      ...p,
      latitude: position?.latitude,
      longitude: position?.longitude,
    });
    if (!parsed.success) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    run(async () => {
      const id = draft || (await jobService.create(parsed.data, requestId));
      setDraft(id);
      if (publish) await jobService.publish(id);
      onDone();
    });
  };
  if (!typeChosen)
    return (
      <View style={{ gap: 20 }}>
        <Text style={s.title}>{t("postTypeQuestion")}</Text>
        {["residential", "business"].map((kind) => (
          <Button
            key={kind}
            title={t(kind)}
            onPress={() => {
              update("kind", kind);
              setTypeChosen(true);
            }}
          />
        ))}
      </View>
    );
  return (
    <>
      <Text style={s.title}>{t("post")}</Text>
      <Text style={s.body}>{t("postingNote")}</Text>
      <View style={s.row}>
        {["business", "residential"].map((k) => (
          <Choice
            key={k}
            title={t(k)}
            selected={p.kind === k}
            onPress={() => {
              update("kind", k);
              update("category", "");
            }}
          />
        ))}
      </View>
      <Text style={s.label}>{t("category")}</Text>
      <View style={s.row}>
        {categories
          .filter((c) => c.kind === p.kind)
          .map((c) => (
            <Choice
              key={c.id}
              title={language === "ta" ? c.name_ta : c.name_en}
              selected={p.category === c.id}
              onPress={() => update("category", c.id)}
            />
          ))}
      </View>
      {[
        ["title", "title"],
        ["business_name", "businessName"],
        ["description", "description"],
        ["pay", "amount"],
        ["schedule", "schedule"],
        ["workers_required", "workers"],
        ["locality", "locality"],
        ["exact_address", "address"],
        ["city", "city"],
        ["district", "district"],
        ["state", "state"],
        ["start_date", "startDate"],
        ["benefits", "benefits"],
        ["instructions", "instructions"],
      ]
        .filter(([key]) => p.kind === "business" || !["business_name", "benefits"].includes(key))
        .map(([key, label]) => (
          <Field
            key={key}
            label={t(label)}
            value={p[key] || ""}
            onChange={(v) => update(key, v)}
            numeric={["pay", "workers_required"].includes(key)}
            multiline={["description", "instructions"].includes(key)}
          />
        ))}
      <View style={s.row}>
        {["hour", "day", "job", "month"].map((k) => (
          <Choice
            key={k}
            title={t(k)}
            selected={p.pay_unit === k}
            onPress={() => update("pay_unit", k)}
          />
        ))}
      </View>
      {p.kind === "business" && (
        <View style={s.row}>
          {["full_time", "part_time", "daily_wage", "temporary", "weekend", "shift"].map((k) => (
            <Choice
              key={k}
              title={t(k)}
              selected={p.employment_type === k}
              onPress={() => update("employment_type", k)}
            />
          ))}
        </View>
      )}
      <Field
        label={t("languages")}
        value={p.required_languages.join(", ")}
        onChange={(v) => update("required_languages", csv(v))}
      />
      <Field
        label={t("skills")}
        value={p.required_skills.join(", ")}
        onChange={(v) => update("required_skills", csv(v))}
      />
      <Button title={t(position ? "refreshLocation" : "gps")} secondary onPress={chooseLocation} />
      {position && (
        <Text style={s.body}>
          {t("locationSelected")}: {position.label} · {t("privateLocationNote")}
        </Text>
      )}
      {invalid && (
        <Text accessibilityRole="alert" style={s.body}>
          {t("validation")}
        </Text>
      )}
      <Button
        title={t("draft")}
        disabled={busy || !position || !!draft}
        secondary
        onPress={() => submit(false)}
      />
      <Button
        title={t("publish")}
        disabled={busy || !position}
        onPress={() => setConfirmPublish(true)}
      />
      <PublishCost
        balance={creditQuery.isError ? null : (creditQuery.data ?? null)}
        t={t}
        onOpen={openCredits}
      />
      {confirmPublish && (
        <View style={{ gap: 12 }}>
          <Text style={s.heading}>{t("jobSummary")}</Text>
          <JobSummary job={p} t={t} />
          <PublishConfirmation
            balance={creditQuery.isError ? null : (creditQuery.data ?? null)}
            t={t}
            busy={busy}
            onCancel={() => setConfirmPublish(false)}
            onConfirm={() => {
              setConfirmPublish(false);
              submit(true);
            }}
          />
        </View>
      )}
    </>
  );
}
function Activity({
  openCredits,
  t,
  run,
  busy,
  saved,
  initialMode = "applications",
}: {
  t: Translate;
  run: Run;
  busy: boolean;
  saved: boolean;
  initialMode?: string;
  openCredits: () => void;
}) {
  const mode = saved ? "saved" : initialMode;
  const [status, setStatus] = useState("");
  useEffect(() => setStatus(""), [mode]);
  const [review, setReview] = useState<string | null>(null);
  const [workerProfile, setWorkerProfile] = useState<string | null>(null);
  const [stars, setStars] = useState("5");
  const [body, setBody] = useState("");
  const [contact, setContact] = useState<any>(null);
  const q = useInfiniteQuery({
    queryKey: ["activity", mode],
    queryFn: ({ pageParam }) => jobService.activity(mode, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === 20 ? all.length * 20 : undefined),
  });
  return (
    <>
      <Text style={s.title}>{t(routeLabel(mode))}</Text>
      <Button title={t("refresh")} secondary onPress={() => q.refetch()} />
      <AsyncState query={q} t={t} />
      {mode !== "saved" && (
        <View style={s.row}>
          {[
            "",
            ...(mode === "posts"
              ? ["active", "filled", "in_progress", "completed", "expired", "cancelled"]
              : ["pending", "accepted", "rejected", "withdrawn", "completed"]),
          ].map((k) => (
            <Choice
              key={k}
              title={t(k || "all")}
              selected={status === k}
              onPress={() => setStatus(k)}
            />
          ))}
        </View>
      )}
      {q.isSuccess && !q.data.pages.flat().some((a) => !status || a.status === status) && (
        <Text style={s.body}>{t("noActivity")}</Text>
      )}
      {q.data?.pages
        .flat()
        .filter((a) => !status || a.status === status)
        .map((a) => (
          <View key={a.id} style={s.card}>
            <Text style={s.heading}>{a.title}</Text>
            {a.created_at && (
              <Text style={s.body}>
                {new Date(a.created_at).toLocaleDateString()} · {a.locality || ""}
              </Text>
            )}
            {mode === "posts" && (
              <Text style={s.body}>
                {t("workers")}: {a.workers_required}
              </Text>
            )}
            {mode === "posts" && a.expires_at && (
              <Text style={s.body}>
                {Math.max(0, Math.ceil((Date.parse(a.expires_at) - Date.now()) / 60000))}{" "}
                {t("minutesLeft")}
              </Text>
            )}
            <Text style={s.body}>
              {t(a.status)}
              {mode === "applicants" && a.worker_name ? ` · ${a.worker_name}` : ""}
            </Text>
            {mode === "applicants" && (
              <Text style={s.body}>
                {(a.skills || []).join(", ")} · {t("experience")}: {a.experience_years}
              </Text>
            )}
            {mode === "applicants" && (
              <>
                <Button
                  title={t("viewWorkerProfile")}
                  secondary
                  onPress={() => setWorkerProfile(workerProfile === a.id ? null : a.id)}
                />
                {workerProfile === a.id && (
                  <View style={s.card}>
                    <Text style={s.heading}>{a.worker_name}</Text>
                    {a.rating != null && <Text style={s.body}>★ {a.rating}</Text>}
                    <Text style={s.body}>{(a.skills || []).join(" · ")}</Text>
                    <Text style={s.body}>
                      {t("experience")}: {a.experience_years ?? t("notShared")}
                    </Text>
                    <Text style={s.body}>{t("workerPrivacy")}</Text>
                  </View>
                )}
              </>
            )}
            {mode === "posts" ? (
              <>
                {a.status === "draft" && (
                  <LivePublishAction
                    job={a}
                    openCredits={openCredits}
                    t={t}
                    busy={busy}
                    onConfirm={() => run(() => jobService.publish(a.id))}
                  />
                )}{" "}
                {(a.status === "expired" ||
                  (a.status === "active" && Date.parse(a.expires_at) <= Date.now())) && (
                  <LivePublishAction
                    job={a}
                    openCredits={openCredits}
                    t={t}
                    busy={busy}
                    repost
                    onConfirm={() => run(() => jobService.repost(a.id, Crypto.randomUUID()))}
                  />
                )}{" "}
                {a.status === "active" && Date.parse(a.expires_at) > Date.now() && (
                  <Button
                    title={t("filled")}
                    secondary
                    disabled={busy}
                    onPress={() => run(() => rpc("fill_job", { p_job_id: a.id }))}
                  />
                )}{" "}
                {a.status === "filled" && (
                  <Button
                    title={t("start")}
                    disabled={busy}
                    onPress={() => run(() => jobService.transition(a.id, "in_progress"))}
                  />
                )}{" "}
                {["draft", "active", "filled"].includes(a.status) && (
                  <Button
                    title={t("cancel")}
                    disabled={busy}
                    secondary
                    onPress={() => run(() => jobService.transition(a.id, "cancelled"))}
                  />
                )}
              </>
            ) : mode === "saved" ? (
              <Button
                title={t("apply")}
                disabled={busy}
                onPress={() => run(() => applicationService.apply(a.id), "applied")}
              />
            ) : (
              <>
                {mode === "applications" && ["pending", "shortlisted"].includes(a.status) && (
                  <Button
                    title={t("withdraw")}
                    secondary
                    disabled={busy}
                    onPress={() => run(() => applicationService.decide(a.id, "withdrawn"))}
                  />
                )}{" "}
                {mode === "applicants" && ["pending", "shortlisted"].includes(a.status) && (
                  <View style={s.row}>
                    {["accepted", "rejected", "shortlisted"].map((k, i) => (
                      <Button
                        key={k}
                        title={t(["accept", "reject", "shortlist"][i])}
                        disabled={busy}
                        secondary={i > 0}
                        onPress={() => run(() => applicationService.decide(a.id, k))}
                      />
                    ))}
                  </View>
                )}
                {["accepted", "completed"].includes(a.status) && (
                  <Button
                    title={t("contact")}
                    secondary
                    onPress={() =>
                      run(async () => setContact(await applicationService.contact(a.id)), "")
                    }
                  />
                )}{" "}
                {a.status === "accepted" && a.job_status === "in_progress" && (
                  <>
                    <Text style={s.body}>{t("completionNote")}</Text>
                    <Button
                      title={t("complete")}
                      disabled={busy}
                      onPress={() => run(() => applicationService.complete(a.id))}
                    />
                  </>
                )}
                {a.status === "completed" && (
                  <Button title={t("review")} secondary onPress={() => setReview(a.id)} />
                )}
              </>
            )}
          </View>
        ))}
      {q.hasNextPage && (
        <Button
          title={t("loadMore")}
          disabled={q.isFetchingNextPage}
          onPress={() => q.fetchNextPage()}
        />
      )}
      <Modal
        visible={!!contact || !!review}
        onRequestClose={() => {
          setContact(null);
          setReview(null);
        }}
      >
        <SafeAreaView style={s.page}>
          <ScrollView contentContainerStyle={s.content}>
            <Feedback />
            <Button
              title={t("close")}
              secondary
              onPress={() => {
                setContact(null);
                setReview(null);
              }}
            />
            {contact && (
              <>
                <Text style={s.heading}>{t("contact")}</Text>
                <Text selectable style={s.body}>
                  {contact.phone}
                </Text>
                <Text selectable style={s.body}>
                  {contact.exact_address}
                </Text>
              </>
            )}
            {review && (
              <>
                <Field label={t("stars")} value={stars} onChange={setStars} numeric />
                <Field label={t("reviewBody")} value={body} onChange={setBody} multiline />
                <Button
                  title={t("submit")}
                  disabled={
                    busy ||
                    !Number.isInteger(Number(stars)) ||
                    Number(stars) < 1 ||
                    Number(stars) > 5
                  }
                  onPress={() =>
                    run(async () => {
                      await reviewService.submit(review, Number(stars), body);
                      setReview(null);
                    })
                  }
                />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
function Safety({
  t,
  target,
  userId,
  run,
}: {
  t: Translate;
  target: string;
  userId: string;
  run: Run;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  return (
    <>
      <Button title={t("report")} secondary onPress={() => setOpen(!open)} />
      {open && (
        <>
          <Field label={t("reason")} value={reason} onChange={setReason} />
          <Field label={t("reportDetail")} value={detail} onChange={setDetail} multiline />
          <Button
            title={t("report")}
            disabled={reason.trim().length < 3}
            onPress={() =>
              run(() => reportService.action("report_job", target, reason, detail), "reportSent")
            }
          />
          <Button
            title={t("reportUser")}
            disabled={reason.trim().length < 3}
            onPress={() =>
              run(() => reportService.action("report_user", userId, reason, detail), "reportSent")
            }
          />
          <Button
            title={t("block")}
            secondary
            onPress={() => run(() => reportService.action("block", userId))}
          />
        </>
      )}
    </>
  );
}
function Preferences({
  t,
  categories,
  language,
  busy,
  run,
}: {
  t: Translate;
  categories: any[];
  language: Lang;
  busy: boolean;
  run: Run;
}) {
  const q = useQuery({ queryKey: ["preferences"], queryFn: profileService.getPreferences });
  const [p, setP] = useState<any>(null);
  useEffect(() => {
    if (q.data) setP(q.data);
  }, [q.data]);
  if (!p) return <AsyncState query={q} t={t} />;
  const update = (k: string, v: any) => setP((old: any) => ({ ...old, [k]: v }));
  return (
    <>
      <Text style={s.title}>{t("preferences")}</Text>
      <View style={s.card}>
        <Text style={s.heading}>{t("discoverableForHire")}</Text>
        <Text style={s.body}>{t("discoveryConsent")}</Text>
        <Text style={s.body}>{t(p.discoverable_for_hire ? "yes" : "no")}</Text>
        <Button
          title={t(p.discoverable_for_hire ? "disableDiscovery" : "enableDiscovery")}
          disabled={busy}
          onPress={() =>
            run(async () => {
              const point = p.discoverable_for_hire ? null : await locationService.gps();
              await rpc("set_worker_discovery", {
                p_enabled: !p.discoverable_for_hire,
                p_lat: point?.latitude ?? null,
                p_lng: point?.longitude ?? null,
              });
            })
          }
        />
      </View>
      <View style={s.row}>
        {categories.map((c) => (
          <Choice
            key={c.id}
            title={language === "ta" ? c.name_ta : c.name_en}
            selected={p.categories.includes(c.id)}
            onPress={() =>
              update(
                "categories",
                p.categories.includes(c.id)
                  ? p.categories.filter((x: string) => x !== c.id)
                  : [...p.categories, c.id],
              )
            }
          />
        ))}
      </View>
      {[
        ["skills", "skills"],
        ["available_days", "workDays"],
      ].map(([k, l]) => (
        <Field key={k} label={t(l)} value={p[k].join(", ")} onChange={(v) => update(k, csv(v))} />
      ))}
      {[
        ["experience_years", "experience"],
        ["expected_pay", "expectedPay"],
        ["available_time", "workTime"],
      ].map(([k, l]) => (
        <Field
          key={k}
          label={t(l)}
          value={String(p[k])}
          onChange={(v) => update(k, v)}
          numeric={k !== "available_time"}
        />
      ))}
      <DistanceControl metres={p.radius_m} onChange={(r) => update("radius_m", r)} t={t} />
      <Text style={s.label}>{t("availability")}</Text>
      <View style={s.row}>
        {[true, false].map((v) => (
          <Choice
            key={String(v)}
            title={t(v ? "yes" : "no")}
            selected={p.available === v}
            onPress={() => update("available", v)}
          />
        ))}
      </View>
      <View style={s.row}>
        {["hour", "day", "job", "month"].map((k) => (
          <Choice
            key={k}
            title={t(k)}
            selected={p.pay_unit === k}
            onPress={() => update("pay_unit", k)}
          />
        ))}
      </View>
      <Button
        title={t("save")}
        disabled={busy}
        onPress={() => run(() => profileService.preferences(p), "preferencesSaved")}
      />
    </>
  );
}
function Updates({ t, run }: { t: Translate; run: Run }) {
  const q = useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: ({ pageParam }) => notificationService.list(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === 20 ? all.length * 20 : undefined),
  });
  return (
    <>
      <Text style={s.title}>{t("notifications")}</Text>
      <AsyncState query={q} t={t} />
      {q.isSuccess && !q.data.pages.flat().length && (
        <Text style={s.body}>{t("noNotificationsHint")}</Text>
      )}
      {q.data?.pages.flat().map((n) => (
        <View key={n.id} style={s.card}>
          <Text style={s.body}>
            {en[n.event as keyof typeof en] ? t(n.event) : t("unknownUpdate")}
          </Text>
          <Text style={s.body}>{new Date(n.created_at).toLocaleString()}</Text>
          {!n.read_at && (
            <Button
              title={t("markRead")}
              secondary
              onPress={() => run(() => notificationService.read(n.id))}
            />
          )}
        </View>
      ))}
      {q.hasNextPage && <Button title={t("loadMore")} onPress={() => q.fetchNextPage()} />}
    </>
  );
}
function Credits({ t }: { t: Translate }) {
  const busyRef = useRef(false);
  const [selected, setSelected] = useState("");
  const [state, setState] = useState("");
  const [providerOrder, setProviderOrder] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: creditBalanceKey,
    queryFn: creditService.balance,
    refetchInterval: 15000,
  });
  const ledger = useInfiniteQuery({
    queryKey: ["creditHistory"],
    queryFn: ({ pageParam }) => creditService.history(pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === 30 ? all.length * 30 : undefined),
    refetchInterval: 15000,
  });
  const packs = useQuery({ queryKey: ["creditPackages"], queryFn: creditService.packages });
  const config = useQuery({
    queryKey: ["paymentConfig"],
    queryFn: async () => {
      const { data, error } = await db!
        .from("payment_config")
        .select("payments_enabled_test")
        .single();
      if (error) throw error;
      return data;
    },
  });
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: creditBalanceKey });
    await qc.invalidateQueries({ queryKey: ["creditHistory"] });
  };
  useEffect(() => {
    if (!providerOrder || state !== "paymentVerifying") return;
    let alive = true;
    const timer = setInterval(() => {
      void db!
        .from("payment_orders")
        .select("status")
        .eq("provider_order_id", providerOrder)
        .single()
        .then(({ data }) => {
          if (alive && data?.status === "paid") {
            setState("paymentSuccess");
            void qc.invalidateQueries({ queryKey: creditBalanceKey });
            void qc.invalidateQueries({ queryKey: ["creditHistory"] });
          }
        });
    }, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [providerOrder, state, qc]);
  const buy = async () => {
    if (busyRef.current || !selected) return;
    if (Platform.OS === "web") {
      setState("nativePaymentRequired");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setState("creatingOrder");
    try {
      const {
        data: { user },
      } = await db!.auth.getUser();
      if (!user) throw new Error("AUTH_REQUIRED");
      const key = `nearhire.payment.${user.id}.${selected}`;
      let requestId = await AsyncStorage.getItem(key);
      if (!requestId) {
        requestId = Crypto.randomUUID();
        await AsyncStorage.setItem(key, requestId);
      }
      const order = await edge("payment-order", { package_id: selected, request_id: requestId });
      if (order.status === "paid") {
        await AsyncStorage.removeItem(key);
        await refresh();
        setState("paymentSuccess");
        return;
      }
      setProviderOrder(order.order_id);
      setState("openingCheckout");
      const result = await openCheckout(order);
      setState("paymentVerifying");
      const verified = await edge("payment-verify", { ...result });
      if (verified.status === "paid") {
        await AsyncStorage.removeItem(key);
        setState("paymentSuccess");
      } else setState("paymentVerifying");
      await refresh();
    } catch (e) {
      const error = e as { code?: number; message?: string };
      setState(error.code === 2 ? "paymentCancelled" : "paymentFailed");
      await refresh();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 16 }}>
      <Text style={s.title}>{t("profileCredits")}</Text>
      <JobCreditBalance balance={q.isError ? null : (q.data ?? null)} t={t} />
      <Button title={t("refresh")} secondary onPress={() => void refresh()} />
      <Text style={s.heading}>{t("buyJobCredits")}</Text>
      <Text style={s.body}>{t("paymentTestOnly")}</Text>
      <AsyncState query={packs} t={t} />
      {packs.data && (
        <PaymentPackages
          packages={packs.data}
          selected={selected}
          onSelect={setSelected}
          t={t}
          disabled={busy}
        />
      )}
      {(config.isError || config.data?.payments_enabled_test !== true) && (
        <Text style={s.body}>{t("paymentUnavailable")}</Text>
      )}
      <Button
        title={t("continuePayment")}
        disabled={busy || !selected || config.data?.payments_enabled_test !== true}
        onPress={() => void buy()}
      />
      {!!state && (
        <Text accessibilityLiveRegion="polite" style={s.notice}>
          {t(state)}
        </Text>
      )}
      {config.isError && (
        <Button title={t("retry")} secondary onPress={() => void config.refetch()} />
      )}
      <Text style={s.heading}>{t("creditHistory")}</Text>
      <AsyncState query={ledger} t={t} />
      {ledger.data?.pages.flat().map((entry) => (
        <View key={entry.id} style={s.card}>
          <Text style={s.heading}>
            {entry.delta > 0 ? "+" : ""}
            {entry.delta}
          </Text>
          <Text style={s.body}>
            {t(
              entry.reason === "signup"
                ? "creditSignup"
                : entry.reason === "purchase"
                  ? "creditPurchase"
                  : entry.reason === "repost"
                    ? "creditRepost"
                    : entry.reason === "publish"
                      ? "creditPublish"
                      : "creditOther",
            )}
          </Text>
          {entry.metadata?.title && <Text style={s.body}>{entry.metadata.title}</Text>}
          {entry.metadata?.amount_paise && (
            <Text style={s.body}>₹{entry.metadata.amount_paise / 100}</Text>
          )}
          <Text style={s.body}>{new Date(entry.created_at).toLocaleDateString()}</Text>
        </View>
      ))}
      {ledger.hasNextPage && (
        <Button
          title={t("loadMore")}
          disabled={ledger.isFetchingNextPage}
          onPress={() => void ledger.fetchNextPage()}
        />
      )}
    </View>
  );
}
function DeleteAccount({ t, busy, run }: { t: Translate; busy: boolean; run: Run }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  return (
    <>
      <Button title={t("deleteAccount")} secondary onPress={() => setOpen(!open)} />
      {open && (
        <View style={s.card}>
          <Text style={s.body}>{t("deleteWarning")}</Text>
          <Field label={t("deleteConfirm")} value={value} onChange={setValue} />
          <Button
            title={t("deleteAccount")}
            disabled={busy || value !== "DELETE"}
            onPress={() => run(authService.remove, "")}
          />
        </View>
      )}
    </>
  );
}

function LiveCreditChip({ t, onOpen }: { t: Translate; onOpen: () => void }) {
  const q = useQuery({ queryKey: creditBalanceKey, queryFn: creditService.balance });
  return <CreditBalanceChip balance={q.isError ? null : (q.data ?? null)} t={t} onPress={onOpen} />;
}

function LivePublishAction({
  job,
  openCredits,
  t,
  busy,
  repost = false,
  onConfirm,
}: {
  t: Translate;
  busy: boolean;
  repost?: boolean;
  job?: any;
  openCredits: () => void;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: creditBalanceKey, queryFn: creditService.balance });
  return (
    <>
      <Button
        title={t(repost ? "repost" : "publish")}
        disabled={busy}
        onPress={() => setOpen(true)}
      />
      {open && (
        <>
          {job && (
            <>
              <Text style={s.heading}>{t("jobSummary")}</Text>
              <JobSummary job={job} t={t} />
            </>
          )}
          {repost && <Text style={s.body}>{t("reviewRepost")}</Text>}
          <PublishConfirmation
            balance={q.isError ? null : (q.data ?? null)}
            t={t}
            busy={busy}
            onCancel={() => setOpen(false)}
            onConfirm={() => {
              setOpen(false);
              onConfirm();
            }}
          />
          {q.isError && <Button title={t("retry")} secondary onPress={() => void q.refetch()} />}
          {q.data === 0 && <Button title={t("goJobCredits")} secondary onPress={openCredits} />}
        </>
      )}
    </>
  );
}
