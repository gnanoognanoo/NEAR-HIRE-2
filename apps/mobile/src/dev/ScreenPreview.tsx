import PaymentPackages from "../live/PaymentPackages";
import { paymentPackages } from "./payment-fixtures";
import JobSummary from "../live/JobSummary";
import DistanceControl from "../live/DistanceControl";
import PreviewMap, { PreviewJobCard, previewJobs } from "./PreviewMap";
import {
  JobCreditBalance,
  PublishConfirmation,
  CreditBalanceChip,
  PublishCost,
} from "../live/JobCreditBalance";
// DEV ONLY: presentation fixtures. No services, storage or auth dependencies. Map assets only.
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Button, Choice, Field, colors, styles as s } from "../live/ui";
import en from "../live/locales/en.json";
import ta from "../live/locales/ta.json";

const screens = [
  ["splash", "Branding", "அறிமுகம்"],
  ["language", "Language", "மொழி"],
  ["login", "Phone login", "தொலைபேசி உள்நுழைவு"],
  ["otp", "Verification code", "சரிபார்ப்புக் குறியீடு"],
  ["setup", "Basic profile", "அடிப்படை சுயவிவரம்"],
  ["home", "Home", "முகப்பு"],
  ["residential", "Residential work", "வீட்டு வேலை"],
  ["business", "Business work", "வணிக வேலை"],
  ["preferences", "Worker preferences", "வேலை விருப்பங்கள்"],
  ["postResidential", "Post residential work", "வீட்டு வேலை பதிவிடு"],
  ["postBusiness", "Post business work", "வணிக வேலை பதிவிடு"],
  ["jobs", "Nearby jobs", "அருகிலுள்ள வேலைகள்"],
  ["map", "Map / location", "வரைபடம் / இடம்"],
  ["details", "Job detail", "வேலை விவரம்"],
  ["application", "Apply for work", "வேலைக்கு விண்ணப்பி"],
  ["applicants", "Employer applicants", "விண்ணப்பதாரர்கள்"],
  ["accepted", "Accepted", "ஏற்கப்பட்டது"],
  ["history", "Job history", "வேலை வரலாறு"],
  ["expired", "Expired / repost", "காலாவதி / மீண்டும் பதிவிடு"],
  ["notifications", "Notifications", "அறிவிப்புகள்"],
  ["reviews", "Ratings / reviews", "மதிப்பீடுகள்"],
  ["safety", "Reports / blocking", "புகார்கள் / தடுத்தல்"],
  ["profile", "Profile", "சுயவிவரம்"],
  ["settings", "Settings", "அமைப்புகள்"],
  ["credits", "Job Credits", "வேலை கிரெடிட்கள்"],
] as const;
type Screen = (typeof screens)[number][0];

export default function ScreenPreview() {
  const [screen, setScreen] = useState<Screen>("home");
  const [language, setLanguage] = useState<"en" | "ta">("en");
  const [menu, setMenu] = useState(false);
  const [info, setInfo] = useState(false);
  const [credits, setCredits] = useState(5);
  const [radius, setRadius] = useState(3000);
  const { width } = useWindowDimensions();
  const wide = width >= 850;
  const t = (key: string) => (language === "ta" ? ta : en)[key as keyof typeof en] || key;
  const go = (next: Screen) => {
    setScreen(next);
    setMenu(false);
  };
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: "#F7F6F9" }}>
        <View
          style={{
            padding: 16,
            borderBottomWidth: 1,
            borderColor: colors.line,
            backgroundColor: "white",
            gap: 10,
          }}
        >
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={s.brand}>
              NearHire<Text style={{ color: colors.accent }}>.</Text>{" "}
              <Text style={{ fontSize: 13, color: colors.accent }}>DEV · UI REVIEW</Text>
            </Text>
            <View style={[s.row, { maxWidth: "100%", flexShrink: 1 }]}>
              <Choice
                title="English"
                selected={language === "en"}
                onPress={() => setLanguage("en")}
              />
              <Choice
                title="தமிழ்"
                selected={language === "ta"}
                onPress={() => setLanguage("ta")}
              />
              {!wide && (
                <Button title={t("previewMenu")} secondary onPress={() => setMenu(!menu)} />
              )}
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => setInfo(!info)}>
            <Text style={[s.body, { fontSize: 12, color: colors.accent }]}>
              {t("developerInfo")}
            </Text>
          </Pressable>
          {info && (
            <>
              <Text style={s.body}>{t("previewInfo")}</Text>
              <View style={[s.row, { maxWidth: "100%", flexShrink: 1 }]}>
                {[5, 0].map((n) => (
                  <Choice
                    key={n}
                    title={t(n ? "creditsPreviewFive" : "creditsPreviewZero")}
                    selected={credits === n}
                    onPress={() => setCredits(n)}
                  />
                ))}
              </View>
            </>
          )}
        </View>
        <View style={{ flex: 1, flexDirection: wide ? "row" : "column" }}>
          {(wide || menu) && (
            <ScrollView
              style={{
                width: wide ? 260 : "100%",
                maxHeight: wide ? undefined : 280,
                flexGrow: 0,
                backgroundColor: "white",
              }}
              contentContainerStyle={{ padding: 16, gap: 7 }}
            >
              {screens.map(([id, english, tamil], i) => (
                <Choice
                  key={id}
                  title={`${String(i + 1).padStart(2, "0")}  ${language === "en" ? english : tamil}`}
                  selected={screen === id}
                  onPress={() => go(id)}
                />
              ))}
            </ScrollView>
          )}
          <View style={{ flex: 1, padding: wide ? 24 : 0, alignItems: "center" }}>
            <View
              style={{
                flex: 1,
                width: "100%",
                maxWidth: 460,
                backgroundColor: "white",
                borderWidth: 1,
                borderColor: colors.line,
                borderRadius: wide ? 18 : 0,
                overflow: "hidden",
              }}
            >
              <View
                style={[
                  s.row,
                  {
                    padding: 20,
                    borderBottomWidth: 1,
                    borderColor: colors.line,
                    justifyContent: "space-between",
                    flexWrap: "nowrap",
                  },
                ]}
              >
                <Text style={s.brand}>
                  NearHire<Text style={{ color: colors.accent }}>.</Text>
                </Text>
                {screen === "home" && (
                  <CreditBalanceChip balance={credits} t={t} onPress={() => go("credits")} />
                )}
              </View>
              <ScrollView
                key={screen}
                style={{ flex: 1 }}
                contentContainerStyle={[
                  s.content,
                  { maxWidth: 460 },
                  ["jobs", "map"].includes(screen) && { flex: 1, padding: 0, gap: 0 },
                ]}
                keyboardShouldPersistTaps="handled"
              >
                <Scene
                  key={`${screen}-${language}`}
                  radius={radius}
                  setRadius={setRadius}
                  consumePreviewCredit={() => setCredits((value) => Math.max(0, value - 1))}
                  credits={credits}
                  screen={screen}
                  language={language}
                  t={t}
                  go={go}
                  setLanguage={setLanguage}
                />
              </ScrollView>
              {!["splash", "language", "login", "otp", "setup"].includes(screen) && (
                <View style={s.nav}>
                  {(["home", "jobs", "history", "notifications", "profile"] as Screen[]).map(
                    (id) => (
                      <View key={id} style={s.navItem}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: screen === id || (id === "profile" && screen === "credits"),
                          }}
                          onPress={() => go(id)}
                          style={{
                            minHeight: 48,
                            padding: 4,
                            justifyContent: "center",
                            width: "100%",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              textAlign: "center",
                              color: screen === id ? colors.accent : colors.muted,
                            }}
                          >
                            {t(id === "history" ? "activity" : id)}
                          </Text>
                        </Pressable>
                      </View>
                    ),
                  )}
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

export function Scene({
  consumePreviewCredit,
  radius,
  setRadius,
  credits,
  screen,
  language,
  t,
  go,
  setLanguage,
}: {
  radius: number;
  setRadius: (radius: number) => void;
  consumePreviewCredit: (summary?: { title: string }) => void;
  credits: number;
  screen: Screen;
  language: "en" | "ta";
  t: (key: string) => string;
  go: (screen: Screen) => void;
  setLanguage: (language: "en" | "ta") => void;
}) {
  const [locationPreview, setLocationPreview] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [choice, setChoice] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [paymentPackage, setPaymentPackage] = useState("");
  const text = (english: string, tamil: string) => (language === "en" ? english : tamil);
  const field = (key: string, initial = "", multiline = false) => (
    <Field
      key={key}
      label={t(key)}
      value={fields[key] ?? initial}
      onChange={(v) => setFields((old) => ({ ...old, [key]: v }))}
      multiline={multiline}
    />
  );
  const choices = (keys: string[]) => (
    <View style={[s.row, { maxWidth: "100%", flexShrink: 1 }]}>
      {keys.map((k) => (
        <Choice key={k} title={t(k)} selected={choice === k} onPress={() => setChoice(k)} />
      ))}
    </View>
  );
  const title = (key: string) => <Text style={s.title}>{t(key)}</Text>;
  const action = (key: string, next?: Screen, secondary = false) => (
    <Button
      title={t(key)}
      secondary={secondary}
      onPress={() => (next ? go(next) : setNotice(t("actionSaved")))}
    />
  );
  const job = (business = false) => (
    <View style={s.card}>
      <Text style={s.tag}>{t(business ? "business" : "residential")}</Text>
      <Text style={s.heading}>
        {business
          ? text("Store assistant", "கடை உதவியாளர்")
          : text("Help with home cleaning", "வீட்டைச் சுத்தம் செய்ய உதவி")}
      </Text>
      <Text style={s.body}>
        {text("Adyar, Chennai", "அடையாறு, சென்னை")} · {business ? "1.8" : "0.8"} km
      </Text>
      <Text style={s.heading}>
        ₹{business ? "800" : "650"} / {t("day")}
      </Text>
      <Text style={s.body}>
        {text("9 AM – 5 PM · Tamil, English", "காலை 9 – மாலை 5 · தமிழ், ஆங்கிலம்")}
      </Text>
      {action("details", "details", true)}
    </View>
  );
  let body: React.ReactNode;
  switch (screen) {
    case "splash":
      body = (
        <View style={{ paddingVertical: 110, gap: 24, alignItems: "center" }}>
          <Text style={[s.brand, { fontSize: 42 }]}>
            NearHire<Text style={{ color: colors.accent }}>.</Text>
          </Text>
          <Text style={s.heading}>{t("welcome")}</Text>
          {action("continue", "language")}
        </View>
      );
      break;
    case "language":
      body = (
        <>
          {title("chooseLanguage")}
          <Button
            title="English"
            onPress={() => {
              setLanguage("en");
              go("login");
            }}
          />
          <Button
            title="தமிழ்"
            secondary
            onPress={() => {
              setLanguage("ta");
              go("login");
            }}
          />
        </>
      );
      break;
    case "login":
    case "otp":
      body = (
        <>
          {title("login")}
          {field("phone", "+91")}
          <Text style={s.body}>{t("phoneHint")}</Text>
          {screen === "otp" && (
            <>
              {field("otp")}
              {action("verify", "setup")}
              {action("changePhone", "login", true)}
              {choices(["otpIncorrect", "otpExpired", "authRateLimit", "authNetwork"])}
              {choice && (
                <Text accessibilityRole="alert" style={s.error}>
                  {t(choice)}
                </Text>
              )}
            </>
          )}
          {action(screen === "otp" ? "resend" : "sendOtp", "otp")}
        </>
      );
      break;
    case "setup":
    case "profile":
      body = (
        <>
          {title("profile")}
          {screen === "profile" && (
            <Button title={t("credits")} secondary onPress={() => go("credits")} />
          )}
          <View style={s.card}>
            {field("name", screen === "profile" ? text("Kavitha", "கவிதா") : "")}
            {field("locality", text("Adyar", "அடையாறு"))}
            {field("city", text("Chennai", "சென்னை"))}
            {field("district", text("Chennai", "சென்னை"))}
            {field("state", text("Tamil Nadu", "தமிழ்நாடு"))}
            {field("languages", "en, ta")}
            <Text style={s.label}>{t("profileVisible")}</Text>
            {choices(["yes", "no"])}
            <Text style={s.label}>{t("notificationEnabled")}</Text>
            {action("save", screen === "setup" ? "home" : undefined)}
          </View>
          {screen === "profile" && (
            <>
              {action("preferences", "preferences", true)}
              <Button
                title={text("Settings", "அமைப்புகள்")}
                secondary
                onPress={() => go("settings")}
              />
            </>
          )}
        </>
      );
      break;
    case "home":
      body = (
        <>
          {title("welcome")}
          <View style={[s.row, { justifyContent: "space-between" }]}>
            <Text style={[s.body, { flex: 1 }]}>{t("annaNagar")}</Text>
            <Button title={t("notifications")} secondary onPress={() => go("notifications")} />
          </View>

          <Text style={s.heading}>{t("what")}</Text>
          {action("find", "jobs")}
          {action("post", "postResidential", true)}
          <Text style={s.body}>{t("privacy")}</Text>
          {action("preferences", "preferences", true)}
          {action("saved", "history", true)}
          <Text style={s.heading}>{t("nearby")}</Text>
          <View style={[s.row, { maxWidth: "100%", flexShrink: 1 }]}>
            {action("residential", "residential", true)}
            {action("business", "business", true)}
          </View>
          {previewJobs.map((item) => (
            <PreviewJobCard key={item.id} item={item} t={t} onView={() => go("map")} />
          ))}
        </>
      );
      break;
    case "residential":
    case "business":
      body = (
        <>
          {title(screen)}
          {choices(
            screen === "residential"
              ? [
                  text("Cleaning", "சுத்தம் செய்தல்"),
                  text("Cooking", "சமையல்"),
                  text("Gardening", "தோட்ட வேலை"),
                ]
              : [
                  text("Retail", "சில்லறை வணிகம்"),
                  text("Restaurant", "உணவகம்"),
                  text("Delivery", "விநியோகம்"),
                ],
          )}
          {action("find", "jobs")}
          {action("post", screen === "residential" ? "postResidential" : "postBusiness", true)}
        </>
      );
      break;
    case "preferences":
      body = (
        <>
          {title("preferences")}
          {choices(["residential", "business"])}
          {field("skills")}
          {field("workDays", "Mon, Tue, Wed, Thu, Fri")}
          {field("experience", "2")}
          {field("expectedPay", "650")}
          {field("workTime", "09:00–17:00")}
          <DistanceControl metres={radius} onChange={setRadius} t={t} />
          <Text style={s.label}>{t("availability")}</Text>
          {choices(["yes", "no"])}
          {choices(["hour", "day", "job", "month"])}
          {action("save")}
        </>
      );
      break;
    case "postResidential":
    case "postBusiness":
      body = (
        <>
          {title("post")}

          <Text style={s.body}>{t("postingNote")}</Text>
          <View style={[s.row, { maxWidth: "100%", flexShrink: 1 }]}>
            {action("residential", "postResidential", screen !== "postResidential")}
            {action("business", "postBusiness", screen !== "postBusiness")}
          </View>
          {field(
            "category",
            screen === "postBusiness"
              ? text("Retail", "சில்லறை வணிகம்")
              : text("Cleaning", "சுத்தம் செய்தல்"),
          )}
          {[
            "title",
            "businessName",
            "description",
            "amount",
            "schedule",
            "workers",
            "locality",
            "address",
            "city",
            "district",
            "state",
            "startDate",
            "benefits",
            "instructions",
          ]
            .filter((k) => screen === "postBusiness" || !["businessName", "benefits"].includes(k))
            .map((k) => field(k, "", ["description", "instructions"].includes(k)))}
          {choices(["hour", "day", "job", "month"])}
          {screen === "postBusiness" &&
            choices(["full_time", "part_time", "daily_wage", "temporary", "weekend", "shift"])}
          {field("languages", "en, ta")}
          {field("skills")}
          <Button title={t("gps")} secondary onPress={() => setLocationPreview(true)} />
          {action("draft")}
          <PublishCost balance={credits} t={t} onOpen={() => go("credits")} />
          <Button title={t("publish")} onPress={() => setConfirm(true)} />
          {confirm && (
            <View style={{ gap: 12 }}>
              <Text style={s.heading}>{t("jobSummary")}</Text>
              <JobSummary
                t={t}
                job={{
                  title: fields.title || t("bakeryHelper"),
                  pay: fields.amount || 700,
                  pay_unit: choice || "day",
                  kind: screen === "postResidential" ? "residential" : "business",
                  category: fields.category || t("category"),
                  locality: fields.locality || t("annaNagar"),
                  description: fields.description || t("previewJobDescription"),
                  schedule: fields.schedule || t("previewSchedule"),
                  workers_required: fields.workers || 1,
                  required_languages: ["en", "ta"],
                }}
              />
              <PublishConfirmation
                balance={credits}
                t={t}
                onCancel={() => setConfirm(false)}
                onConfirm={() => {
                  setConfirm(false);
                  consumePreviewCredit({ title: fields.title || t("bakeryHelper") });
                  setNotice(t("actionSaved"));
                }}
              />
            </View>
          )}
        </>
      );
      break;
    case "jobs":
    case "map":
      body = (
        <PreviewMap radius={radius} setRadius={setRadius} t={t} onApply={() => go("application")} />
      );
      break;
    case "credits":
      body = (
        <>
          <Button title={t("profile")} secondary onPress={() => go("profile")} />
          <Text style={s.title}>{t("profileCredits")}</Text>
          <JobCreditBalance balance={credits} t={t} />
          <Text style={s.heading}>{t("buyJobCredits")}</Text>
          <Text style={s.body}>{t("paymentTestOnly")}</Text>
          <PaymentPackages
            packages={paymentPackages}
            selected={paymentPackage}
            onSelect={setPaymentPackage}
            t={t}
          />
          <Button
            title={t("continuePayment")}
            disabled={!paymentPackage}
            onPress={() => setNotice(t("nativePaymentRequired"))}
          />
          <Text style={s.body}>{t("paymentUnavailable")}</Text>
          <Text style={s.body}>{t("workFree")}</Text>
          <Text style={s.heading}>{t("creditHistory")}</Text>
          <View style={s.card}>
            <Text style={s.body}>{t("creditSignup")} · +5</Text>
            {Array.from({ length: 5 - credits }, (_, i) => (
              <Text key={i} style={s.body}>
                {t("creditPublish")} · {t("bakeryHelper")} · −1
              </Text>
            ))}
            <Text style={s.body}>
              {t("creditHistoryDate")}:{" "}
              {new Date("2026-09-10T10:00:00Z").toLocaleDateString(
                language === "ta" ? "ta-IN" : "en-IN",
              )}
            </Text>
          </View>
        </>
      );
      break;
    case "details":
      body = (
        <>
          {title("details")}
          {job()}
          <Text style={s.body}>
            {text(
              "Help clean a two-bedroom home. Sweeping, mopping and kitchen surfaces. Supplies provided.",
              "இரண்டு படுக்கையறைகள் கொண்ட வீட்டைச் சுத்தம் செய்ய உதவி. பெருக்குதல், துடைத்தல் மற்றும் சமையலறை சுத்தம். பொருட்கள் வழங்கப்படும்.",
            )}
          </Text>
          <Text style={s.body}>{t("privacy")}</Text>
          {action("apply", "application")}
          {action("bookmark")}
          {action("report", "safety", true)}
        </>
      );
      break;
    case "application":
      body = (
        <>
          {title("apply")}
          {job()}
          <Text style={s.body}>{t("privacy")}</Text>
          {action("submit")}
          {notice && <Text style={s.heading}>{t("applied")}</Text>}
          {action("myApplications", "history", true)}
        </>
      );
      break;
    case "applicants":
      body = (
        <>
          {title("applicants")}
          {[text("Kavitha", "கவிதா"), text("Arun", "அருண்")].map((name) => (
            <View key={name} style={s.card}>
              <Text style={s.heading}>{name} · ★ 4.8</Text>
              <Text style={s.body}>
                {text("Cleaning · 2 years experience", "சுத்தம் செய்தல் · 2 ஆண்டுகள் அனுபவம்")}
              </Text>
              {action("shortlist")}
              {action("accept", "accepted")}
              {action("reject", undefined, true)}
            </View>
          ))}
        </>
      );
      break;
    case "accepted":
      body = (
        <>
          {title("accepted")}
          <Text style={s.notice}>{t("application_accepted")}</Text>
          {job()}
          {action("contact")}
          {action("start")}
          {action("complete", "reviews")}
          <Text style={s.body}>{t("completionNote")}</Text>
        </>
      );
      break;
    case "history":
      body = (
        <>
          {title("activity")}
          {choices(["myApplications", "myPosts", "saved"])}
          <Text style={s.tag}>{t("pending")}</Text>
          {job()}
          {action("withdraw")}
          <Text style={s.tag}>{t("completed")}</Text>
          {job(true)}
          {action("review", "reviews", true)}
          {action("applicants", "applicants", true)}
          {action("expired", "expired", true)}
        </>
      );
      break;
    case "expired":
      body = (
        <>
          {title("expired")}
          <Text style={s.body}>{t("jobUnavailable")}</Text>
          {job()}
          {action("repost")}
        </>
      );
      break;
    case "notifications":
      body = (
        <>
          {title("notifications")}
          {["application_accepted", "application_received", "job_expired", "new_review"].map(
            (k) => (
              <View key={k} style={s.card}>
                <Text style={s.body}>{t(k)}</Text>
                {action("markRead")}
              </View>
            ),
          )}
        </>
      );
      break;
    case "reviews":
      body = (
        <>
          {title("review")}
          <Text style={s.heading}>★ 4.8 · {text("12 reviews", "12 மதிப்புரைகள்")}</Text>
          <Text style={s.body}>
            {text(
              "Punctual and thoughtful. Would work together again.",
              "நேரம் தவறாமல் கவனத்துடன் வேலை செய்தார். மீண்டும் இணைந்து வேலை செய்வேன்.",
            )}
          </Text>
          {choices(["1", "2", "3", "4", "5"])}
          {field("reviewBody", "", true)}
          {action("submit")}
        </>
      );
      break;
    case "safety":
      body = (
        <>
          {title("reportUser")}
          {field("reason")}
          {field("reportDetail", "", true)}
          {action("submit")}
          {action("block", undefined, true)}
          {action("unblock", undefined, true)}
        </>
      );
      break;
    case "settings":
      body = (
        <>
          <Text style={s.title}>{text("Settings", "அமைப்புகள்")}</Text>
          <Text style={s.heading}>{t("chooseLanguage")}</Text>
          <Button title="English" secondary onPress={() => setLanguage("en")} />
          <Button title="தமிழ்" secondary onPress={() => setLanguage("ta")} />
          {action("enablePush")}
          <Text style={s.body}>{t("notificationPrivacy")}</Text>
          {action("privacyPolicy", undefined, true)}
          {action("logout", "login", true)}
          {action("deleteAccount", undefined, true)}
          <Text style={s.body}>{t("deleteWarning")}</Text>
        </>
      );
      break;
  }
  return (
    <>
      {body}
      <Modal visible={locationPreview} onRequestClose={() => setLocationPreview(false)}>
        <View style={{ flex: 1 }}>
          <Button title={t("close")} secondary onPress={() => setLocationPreview(false)} />
          <PreviewMap
            initialPicking
            onLocationDone={() => setLocationPreview(false)}
            radius={radius}
            setRadius={setRadius}
            t={t}
            onApply={() => {}}
          />
        </View>
      </Modal>
      {!!notice && (
        <Text accessibilityLiveRegion="polite" style={s.notice}>
          {notice}
        </Text>
      )}
    </>
  );
}
