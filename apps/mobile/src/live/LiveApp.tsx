import PhoneAuth from "./PhoneAuth";
import { profileComplete, restoredSession, authErrorKey, withAuthTimeout } from "./auth-logic";
import React, { useEffect, useState, useRef, createContext, useContext } from "react";
import { ActivityIndicator, Linking, Modal, ScrollView, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session } from "@supabase/supabase-js";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Place,
  profileService,
  reportService,
  reviewService,
} from "./services";
import { Button, Choice, Field, styles as s, colors } from "./ui";
import JobMap from "./JobMap";
import en from "./locales/en.json";
import ta from "./locales/ta.json";
import { jobSchema } from "../../../../packages/core/validation";
type Lang = "en" | "ta";
type Translate = (key: string) => string;
type Position = { latitude: number; longitude: number; label?: string };
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
  const busyRef = useRef(false);
  const qc = useQueryClient();
  const [language, setLanguage] = useState<Lang | null>(null);
  const [bootError, setBootError] = useState(false);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [boot, setBoot] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState("home");
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
        setScreen("home");
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
    <PhoneAuth t={t} onVerified={() => setMessage("otpSuccess")} />
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
      onSave={(p) => run(() => profileService.save(p))}
    />
  ) : (
    <>
      {screen === "home" && (
        <>
          <Text style={s.title}>{t("welcome")}</Text>
          <Text style={s.body}>
            {profile.data.name} · {profile.data.locality}
          </Text>
          <Text style={s.heading}>{t("what")}</Text>
          <Button title={t("find")} onPress={() => setScreen("jobs")} />
          <Button title={t("post")} secondary onPress={() => setScreen("post")} />
          <Text style={s.body}>{t("privacy")}</Text>
          <Button title={t("preferences")} secondary onPress={() => setScreen("preferences")} />
          <Button title={t("saved")} secondary onPress={() => setScreen("saved")} />
        </>
      )}
      {screen === "jobs" && (
        <Jobs
          t={t}
          position={position}
          chooseLocation={() => setLocationOpen(true)}
          run={run}
          busy={busy}
          categories={categories.data || []}
          language={language}
        />
      )}
      {screen === "post" && (
        <Post
          t={t}
          position={position}
          chooseLocation={() => setLocationOpen(true)}
          categories={categories.data || []}
          language={language}
          busy={busy}
          run={run}
          onDone={() => setScreen("activity")}
        />
      )}
      {["activity", "saved"].includes(screen) && (
        <Activity key={screen} t={t} run={run} busy={busy} saved={screen === "saved"} />
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
        <>
          <ProfileForm
            initial={profile.data}
            language={language}
            t={t}
            busy={busy}
            onSave={(p) => run(() => profileService.save(p))}
          />
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
          <Credits t={t} />
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
      <SafeAreaView style={s.page}>
        <View
          style={{
            paddingHorizontal: 22,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderColor: colors.line,
          }}
        >
          <Text style={s.brand}>
            {t("brand")}
            <Text style={{ color: colors.accent }}>.</Text>
          </Text>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
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
        {!!session && profileComplete(profile.data) && (
          <View style={s.nav}>
            {["home", "jobs", "activity", "notifications", "profile"].map((k) => (
              <View key={k} style={s.navItem}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: screen === k }}
                  onPress={() => {
                    setScreen(k);
                    setError("");
                    setMessage("");
                  }}
                  style={{ minHeight: 48, padding: 4, justifyContent: "center" }}
                >
                  <Text
                    style={{
                      fontSize: 12,
                      textAlign: "center",
                      color: screen === k ? colors.accent : colors.muted,
                    }}
                  >
                    {t(k)}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <Modal visible={locationOpen} onRequestClose={() => setLocationOpen(false)}>
          <SafeAreaView style={s.page}>
            <ScrollView contentContainerStyle={s.content}>
              <Feedback />
              <Button title={t("close")} secondary onPress={() => setLocationOpen(false)} />
              <LocationPicker
                t={t}
                run={run}
                onSelect={(p) => {
                  setPosition(p);
                  setLocationOpen(false);
                }}
              />
            </ScrollView>
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
function LocationPicker({
  t,
  run,
  onSelect,
}: {
  t: Translate;
  run: Run;
  onSelect: (p: Position) => void;
}) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  return (
    <>
      <Text style={s.title}>{t("permissionTitle")}</Text>
      <Text style={s.body}>{t("locationExplain")}</Text>
      <Button
        title={t("gps")}
        onPress={() => run(async () => onSelect(await locationService.gps()), "locationSelected")}
      />
      <Field label={t("manual")} value={query} onChange={setQuery} />
      <Button
        title={t("search")}
        secondary
        disabled={query.length < 3}
        onPress={() => run(async () => setPlaces(await locationService.search(query)), "")}
      />
      {places.map((p) => (
        <Button
          key={p.id}
          title={p.label}
          secondary
          onPress={() =>
            run(async () => {
              const point = await locationService.resolve(p.id);
              if (point.latitude === undefined || point.longitude === undefined)
                throw new Error("INVALID_LOCATION");
              onSelect({
                latitude: point.latitude,
                longitude: point.longitude,
                label: point.label,
              });
            }, "locationSelected")
          }
        />
      ))}
    </>
  );
}
function Jobs({
  t,
  position,
  chooseLocation,
  run,
  busy,
  categories,
  language,
}: {
  t: Translate;
  position: Position | null;
  chooseLocation: () => void;
  run: Run;
  busy: boolean;
  categories: any[];
  language: Lang;
}) {
  const [mapView, setMapView] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [radius, setRadius] = useState(3000);
  const [kind, setKind] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("recommended");
  const [minPay, setMinPay] = useState("");
  const [selected, setSelected] = useState<any>(null);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 350);
    return () => clearTimeout(id);
  }, [query]);
  const results = useInfiniteQuery({
    queryKey: ["jobs", position, radius, kind, category, sort, debounced, minPay],
    queryFn: ({ pageParam }) =>
      jobService.nearby(
        position!.latitude,
        position!.longitude,
        radius,
        { kind, category, sort, query: debounced, min_pay: Number(minPay) || 0 },
        pageParam,
      ),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === 20 ? all.length * 20 : undefined),
    enabled: !!position,
  });
  return (
    <>
      <Text style={s.title}>{t("nearby")}</Text>
      <Button
        title={t(position ? "refreshLocation" : "select")}
        secondary
        onPress={chooseLocation}
      />
      {!position ? (
        <Text style={s.body}>{t("noLocation")}</Text>
      ) : (
        <>
          <Text style={s.body}>{position.label || t("selectedLocation")}</Text>
          <Field label={t("search")} value={query} onChange={setQuery} />
          <View style={s.row}>
            {["", "residential", "business"].map((k) => (
              <Choice
                key={k}
                title={t(k || "all")}
                selected={kind === k}
                onPress={() => {
                  setKind(k);
                  setCategory("");
                }}
              />
            ))}
          </View>
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
            {[1000, 3000, 5000].map((r) => (
              <Choice
                key={r}
                title={`${r / 1000} km`}
                selected={radius === r}
                onPress={() => setRadius(r)}
              />
            ))}
          </View>
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
          <Field label={t("minPay")} value={minPay} onChange={setMinPay} numeric />
          <Button
            title={t(mapView ? "listView" : "mapView")}
            secondary
            onPress={() => setMapView(!mapView)}
          />
          {mapView && (
            <JobMap
              position={position}
              jobs={results.data?.pages.flat() || []}
              onSelect={setSelected}
              unavailable={t("serviceUnavailable")}
            />
          )}
          <AsyncState query={results} t={t} />
          {results.data?.pages.flat().map((item) => (
            <View key={item.job.id} style={s.card}>
              <Text style={s.heading}>{item.job.title}</Text>
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
      )}
      <Modal visible={!!selected} onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={s.page}>
          <ScrollView contentContainerStyle={s.content}>
            <Feedback />
            <Button title={t("close")} secondary onPress={() => setSelected(null)} />
            {selected && (
              <>
                <Text style={s.title}>{selected.title}</Text>
                <Text style={s.body}>{selected.description}</Text>
                <Text style={s.body}>
                  {selected.schedule} · {selected.locality}
                </Text>
                <Text style={s.body}>{t("privacy")}</Text>
                <Button
                  title={t("apply")}
                  disabled={busy}
                  onPress={() => run(() => applicationService.apply(selected.id), "applied")}
                />
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
    </>
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
  const [requestId] = useState(() => Crypto.randomUUID());
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const update = (k: string, v: any) => setP((old: any) => ({ ...old, [k]: v }));
  const submit = (publish: boolean) => {
    const parsed = jobSchema.safeParse({ ...p, ...position });
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
      ].map(([key, label]) => (
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
      {position && <Text style={s.body}>{t("locationSelected")}</Text>}
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
      <Button title={t("publish")} disabled={busy || !position} onPress={() => submit(true)} />
    </>
  );
}
function Activity({
  t,
  run,
  busy,
  saved,
}: {
  t: Translate;
  run: Run;
  busy: boolean;
  saved: boolean;
}) {
  const [mode, setMode] = useState(saved ? "saved" : "applications");
  const [review, setReview] = useState<string | null>(null);
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
      <Text style={s.title}>{t(saved ? "saved" : "activity")}</Text>
      {!saved && (
        <View style={s.row}>
          {[
            ["applications", "myApplications"],
            ["posts", "myPosts"],
            ["applicants", "applicants"],
          ].map(([k, l]) => (
            <Choice key={k} title={t(l)} selected={mode === k} onPress={() => setMode(k)} />
          ))}
        </View>
      )}
      <Button title={t("refresh")} secondary onPress={() => q.refetch()} />
      <AsyncState query={q} t={t} />
      {q.data?.pages.flat().map((a) => (
        <View key={a.id} style={s.card}>
          <Text style={s.heading}>{a.title}</Text>
          <Text style={s.body}>
            {t(a.status)}
            {a.worker_name ? ` · ${a.worker_name}` : ""}
          </Text>
          {mode === "applicants" && (
            <Text style={s.body}>
              {(a.skills || []).join(", ")} · {t("experience")}: {a.experience_years}
            </Text>
          )}
          {mode === "posts" ? (
            <>
              {a.status === "draft" && (
                <Button
                  title={t("publish")}
                  disabled={busy}
                  onPress={() => run(() => jobService.publish(a.id))}
                />
              )}{" "}
              {(a.status === "expired" ||
                (a.status === "active" && Date.parse(a.expires_at) <= Date.now())) && (
                <Button
                  title={t("repost")}
                  disabled={busy}
                  onPress={() => run(() => jobService.repost(a.id, Crypto.randomUUID()))}
                />
              )}{" "}
              {["active", "expired"].includes(a.status) && (
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
      <View style={s.row}>
        {[1000, 3000, 5000].map((r) => (
          <Choice
            key={r}
            title={`${r / 1000} km`}
            selected={p.radius_m === r}
            onPress={() => update("radius_m", r)}
          />
        ))}
      </View>
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
  const q = useQuery({ queryKey: ["credits"], queryFn: creditService.balance });
  const packs = useQuery({ queryKey: ["creditPackages"], queryFn: creditService.packages });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [request, setRequest] = useState<{ pack: string; id: string } | null>(null);
  const buy = async (pack: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNote("");
    const requestId = request?.pack === pack ? request.id : Crypto.randomUUID();
    setRequest({ pack, id: requestId });
    try {
      const order = await edge("payment-order", { package_id: pack, request_id: requestId });
      await openCheckout(order);
      setNote("paymentVerifying");
      setRequest(null);
      await q.refetch();
    } catch {
      setNote("paymentPending");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={s.card}>
      <Text style={s.heading}>
        {t("credits")}: {q.data ?? "—"}
      </Text>
      <Button title={t("refresh")} secondary onPress={() => q.refetch()} />
      {note && (
        <Text accessibilityLiveRegion="polite" style={s.body}>
          {t(note)}
        </Text>
      )}
      {packs.data?.map((p) => (
        <Button
          key={p.id}
          title={`${t("buyCredits")} · ${p.credits} · ₹${p.amount_paise / 100}`}
          disabled={busy}
          onPress={() => buy(p.id)}
        />
      ))}
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
