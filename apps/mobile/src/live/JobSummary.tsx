import React from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { NeoSurface, NeoStatusBadge, styles as s, colors } from "./ui";
// Public fields only: exact address and private coordinates never enter this presentation.
export default function JobSummary({
  job,
  t,
  distance,
}: {
  job: any;
  t: (key: string) => string;
  distance?: number;
}) {
  return (
    <View style={{ gap: 24 }}>
      <View style={s.row}>
        <NeoStatusBadge label={t(job.kind)} />
        {(job.is_urgent || job.isUrgent) && (
          <NeoStatusBadge label={t("postingUrgent")} status="urgent" />
        )}
        {job.status && <NeoStatusBadge label={t(job.status)} status={job.status} />}
      </View>
      <Text style={s.title}>{job.title}</Text>
      <NeoSurface inset compact>
        <Text style={s.label}>{t("amount")}</Text>
        <Text style={[s.title, { color: colors.accent, fontSize: 32, lineHeight: 44 }]}>
          ₹{job.pay} <Text style={[s.body, { fontSize: 16 }]}>/ {t(job.pay_unit)}</Text>
        </Text>
      </NeoSurface>
      <View style={{ gap: 12 }}>
        <View style={s.row}>
          <Feather name="map-pin" size={17} color={colors.accent} />
          <Text style={s.label}>
            {job.locality}
            {distance != null ? ` · ${t("approximate")} ${distance / 1000} km` : ""}
          </Text>
        </View>
        {job.employment_type && <Text style={s.body}>{t(job.employment_type)}</Text>}
        <Text style={s.body}>{t(job.category)}</Text>
      </View>
      <Text style={s.body}>{job.description}</Text>
      <View style={s.row}>
        {(job.start_date || job.start_time) && (
          <NeoStatusBadge label={[job.start_date, job.start_time].filter(Boolean).join(" ")} />
        )}
      </View>
      {job.schedule && (
        <View style={{ gap: 8 }}>
          <Text style={s.label}>{t("schedule")}</Text>
          <Text style={s.body}>{job.schedule}</Text>
        </View>
      )}
      {job.workers_required != null && (
        <Text style={s.body}>
          {t("workers")}: {job.workers_required}
        </Text>
      )}
      {!!job.required_languages?.length && (
        <View style={{ gap: 8 }}>
          <Text style={s.label}>{t("languages")}</Text>
          <View style={s.row}>
            {job.required_languages.map((l: string, i: number) => (
              <NeoStatusBadge key={i} label={l === "ta" ? "தமிழ்" : l === "en" ? "English" : l} />
            ))}
          </View>
        </View>
      )}
      {!!job.required_skills?.length && (
        <View style={{ gap: 8 }}>
          <Text style={s.label}>{t("skills")}</Text>
          <View style={s.row}>
            {job.required_skills.map((v: string, i: number) => (
              <NeoStatusBadge key={i} label={v} />
            ))}
          </View>
        </View>
      )}
      {job.expires_at && (
        <Text style={s.body}>
          {Math.max(0, Math.ceil((Date.parse(job.expires_at) - Date.now()) / 60000))}{" "}
          {t("minutesLeft")}
        </Text>
      )}
      {job.employer_rating != null && <Text style={s.body}>★ {job.employer_rating}</Text>}
      <Text style={[s.body, { fontSize: 13, lineHeight: 22 }]}>{t("privacy")}</Text>
    </View>
  );
}
