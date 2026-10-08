import React, { useEffect, useState, useRef } from "react";
import {
  Text,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { storage } from "./client";
import { postingFlow, postingErrorKey, postingDraftKey, restorePostingDraft } from "./posting-flow";
import { jobSchema } from "../../../../packages/core/validation";
import { jobService, creditService } from "./services";
import { creditBalanceKey } from "./credit-query";
import { PublishCost, PublishConfirmation } from "./JobCreditBalance";
import JobSummary from "./JobSummary";
import { Button, Choice, Field, styles as s, colors } from "./ui";
import type { Position } from "./location-logic";
export default function PostWork({
  openCredits,
  t,
  userId,
  active,
  onRestorePosition,
  position,
  chooseLocation,
  categories,
  language,
  onDone,
}: {
  t: (key: string) => string;
  userId: string;
  active: boolean;
  onRestorePosition: (p: Position) => void;
  position: Position | null;
  chooseLocation: () => void;
  categories: any[];
  language: "en" | "ta";
  onDone: (published: boolean) => void;
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
    is_urgent: false,
    languages_text: "ta",
    skills_text: "",
  });
  const [typeChosen, setTypeChosen] = useState(false);
  const [requestId, setRequestId] = useState(() => Crypto.randomUUID());
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitBusy = useRef(false);
  const skipMerge = useRef(false);
  const writes = useRef(Promise.resolve());
  const flow = useRef(postingFlow(jobService)).current;
  const record = useRef<any>(null);
  const mounted = useRef(true);
  const persist = (value: any) => {
    const next = writes.current
      .catch(() => {})
      .then(() => storage.setItem(postingDraftKey(userId), JSON.stringify(value)));
    writes.current = next;
    return next;
  };
  useEffect(() => {
    let cancelled = false;
    storage
      .getItem(postingDraftKey(userId))
      .then((raw) => {
        if (cancelled) return;
        const saved = restorePostingDraft(raw, userId);
        if (saved) {
          skipMerge.current = true;
          setP(saved.fields);
          setRequestId(saved.requestId);
          setTypeChosen(!!saved.typeChosen);
          if (saved.position) onRestorePosition(saved.position);
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setError("postingStorageError");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!loaded) return;
    const r = { version: 1, owner: userId, requestId, fields: p, typeChosen, position };
    record.current = r;
    void persist(r).catch(() => setError("postingStorageError"));
  }, [p, typeChosen, position, requestId, loaded, userId]);

  const [issues, setIssues] = useState<{ path: string; key: string }[]>([]);
  useEffect(() => {
    if (skipMerge.current && loaded) {
      skipMerge.current = false;
      return;
    }
    if (position && loaded)
      setP((old: any) => ({
        ...old,
        locality: position.locality || old.locality,
        city: position.city || old.city,
        district: position.district || old.district,
        state: position.state || old.state,
        country: position.country || old.country || "IN",
        exact_address: position.formatted_address || "",
      }));
  }, [position, loaded]);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const creditQuery = useQuery({
    queryKey: creditBalanceKey,
    queryFn: creditService.summary,
    select: (summary) => summary.balance,
    refetchInterval: 15000,
  });
  const update = (k: string, v: any) => setP((old: any) => ({ ...old, [k]: v }));
  const parse = () => {
    const parsed = jobSchema.safeParse({
      ...p,
      required_languages: (p.languages_text || "ta")
        .split(",")
        .map((v: string) => v.trim())
        .filter(Boolean),
      required_skills: (p.skills_text || "")
        .split(",")
        .map((v: string) => v.trim())
        .filter(Boolean),
      latitude: position?.latitude,
      longitude: position?.longitude,
    });
    setIssues(
      parsed.success
        ? []
        : parsed.error.issues.map((i) => ({
            path: String(i.path[0]),
            key:
              (
                {
                  title: "postingTitleError",
                  description: "postingDescriptionError",
                  schedule: "postingScheduleError",
                  locality: "postingLocalityError",
                  pay: "postingPayError",
                  workers_required: "postingWorkersError",
                  start_date: "postingDateError",
                  start_time: "postingTimeError",
                  latitude: "postingLocationError",
                  longitude: "postingLocationError",
                  category: "postingCategoryError",
                } as Record<string, string>
              )[String(i.path[0])] || "postingFieldError",
          })),
    );
    return parsed;
  };
  const submit = async (publish: boolean) => {
    if (submitBusy.current) return;
    const parsed = parse();
    if (!parsed.success) return;
    submitBusy.current = true;
    setBusy(true);
    setError("");
    try {
      await flow.submit(parsed.data, requestId, publish, () =>
        persist({ ...record.current, fields: p, position, requestId }),
      );
      if (publish) {
        await writes.current.catch(() => {});
        await storage.removeItem(postingDraftKey(userId));
        setP({
          kind: p.kind,
          pay_unit: "day",
          workers_required: "1",
          pay: "",
          title: "",
          description: "",
          schedule: "",
          locality: "",
          exact_address: "",
          employment_type: "temporary",
          is_urgent: false,
          languages_text: "ta",
          skills_text: "",
        });
        setRequestId(Crypto.randomUUID());
        setTypeChosen(false);
        setConfirmPublish(false);
      }
      onDone(publish);
    } catch (e) {
      if (mounted.current) {
        const key = postingErrorKey(e);
        setError(key);
        if (key === "creditsError") openCredits();
      }
    } finally {
      submitBusy.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  if (!loaded)
    return (
      <Text accessibilityRole="alert" style={s.body}>
        {t(error || "loading")}
      </Text>
    );
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
    <KeyboardAvoidingView
      enabled={active}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ gap: 20 }}
    >
      <View pointerEvents={busy ? "none" : "auto"} style={{ gap: 20 }}>
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
          ["exact_address", "postingAddress"],
          ["city", "city"],
          ["district", "district"],
          ["state", "state"],
          ["start_date", "postingDateLabel"],
          ["start_time", "postingTimeLabel"],
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
              multiline={["description", "instructions", "exact_address"].includes(key)}
              maxLength={
                (
                  {
                    title: 120,
                    business_name: 120,
                    description: 3000,
                    pay: 12,
                    workers_required: 3,
                    schedule: 200,
                    locality: 120,
                    exact_address: 500,
                    city: 120,
                    district: 120,
                    state: 120,
                    start_date: 10,
                    start_time: 5,
                    benefits: 1000,
                    instructions: 1000,
                  } as Record<string, number>
                )[key]
              }
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
          value={p.languages_text}
          onChange={(v) => update("languages_text", v)}
        />
        <Field
          label={t("skills")}
          value={p.skills_text}
          onChange={(v) => update("skills_text", v)}
        />
        <Choice
          title={t("postingUrgent")}
          selected={p.is_urgent}
          onPress={() => update("is_urgent", !p.is_urgent)}
        />
        <Button
          title={t(position ? "refreshLocation" : "gps")}
          secondary
          onPress={chooseLocation}
        />
        {position && (
          <Text style={s.body}>
            {t("locationSelected")}: {position.label} · {t("privateLocationNote")}
          </Text>
        )}
        {issues.map((i, n) => (
          <Text key={n} accessibilityRole="alert" style={s.body}>
            {t(
              (
                {
                  title: "title",
                  description: "description",
                  category: "category",
                  schedule: "schedule",
                  locality: "locality",
                  start_date: "postingDateLabel",
                  start_time: "postingTimeLabel",
                  latitude: "gps",
                  longitude: "gps",
                  exact_address: "postingAddress",
                  pay: "amount",
                  workers_required: "workers",
                  business_name: "businessName",
                  city: "city",
                  district: "district",
                  state: "state",
                  country: "locality",
                  required_languages: "languages",
                  required_skills: "skills",
                  experience_years: "experience",
                  benefits: "benefits",
                  instructions: "instructions",
                  pay_unit: "amount",
                  employment_type: "business",
                } as Record<string, string>
              )[i.path] || "validation",
            )}
            : {t(i.key)}
          </Text>
        ))}
        {!!error && (
          <Text accessibilityRole="alert" style={s.body}>
            {t(error)}
          </Text>
        )}
        {busy && <ActivityIndicator accessibilityLabel={t("loading")} color={colors.accent} />}
        <Button title={t("draft")} disabled={busy} secondary onPress={() => submit(false)} />
        <Button
          title={t("publish")}
          disabled={busy}
          onPress={() => {
            if (parse().success) {
              Keyboard.dismiss();
              setConfirmPublish(true);
              if (creditQuery.data === 0) openCredits();
            }
          }}
        />
        {creditQuery.isError && (
          <Button
            title={t("retry")}
            secondary
            onPress={() => {
              void creditQuery.refetch();
            }}
          />
        )}
        <PublishCost
          balance={creditQuery.isError ? null : (creditQuery.data ?? null)}
          t={t}
          onOpen={openCredits}
        />
        {confirmPublish && (
          <View style={{ gap: 12 }}>
            <Text style={s.heading}>{t("jobSummary")}</Text>
            <JobSummary
              job={{
                ...p,
                required_languages: p.languages_text.split(",").filter(Boolean),
                required_skills: p.skills_text.split(",").filter(Boolean),
              }}
              t={t}
            />
            <PublishConfirmation
              balance={creditQuery.isError ? null : (creditQuery.data ?? null)}
              t={t}
              busy={busy}
              onCancel={() => setConfirmPublish(false)}
              onConfirm={() => {
                void submit(true);
              }}
            />
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
