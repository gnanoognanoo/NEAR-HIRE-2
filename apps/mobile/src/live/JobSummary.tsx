import React from "react";
import { Text, View } from "react-native";
import { styles as s } from "./ui";

// Public fields only: never render exact_address or the job's private coordinates.
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
    <View style={{ gap: 12 }}>
      <Text style={s.title}>{job.title}</Text>
      <Text style={s.heading}>
        ₹{job.pay} / {t(job.pay_unit)}
      </Text>
      <Text style={s.body}>
        {t(job.kind)} · {job.category}
      </Text>
      <Text style={s.body}>
        {job.locality}
        {distance != null ? ` · ${t("approximate")} ${distance / 1000} km` : ""}
      </Text>
      {job.employment_type && <Text style={s.body}>{t(job.employment_type)}</Text>}
      <Text style={s.body}>{job.description}</Text>
      {job.schedule && (
        <Text style={s.body}>
          {t("schedule")}: {job.schedule}
        </Text>
      )}
      {job.workers_required != null && (
        <Text style={s.body}>
          {t("workers")}: {job.workers_required}
        </Text>
      )}
      {!!job.required_languages?.length && (
        <Text style={s.body}>
          {t("languages")}:{" "}
          {job.required_languages
            .map((l: string) => (l === "ta" ? "தமிழ்" : l === "en" ? "English" : l))
            .join(" · ")}
        </Text>
      )}
      {!!job.required_skills?.length && (
        <Text style={s.body}>
          {t("skills")}: {job.required_skills.join(" · ")}
        </Text>
      )}
      {job.expires_at && (
        <Text style={s.body}>
          {Math.max(0, Math.ceil((Date.parse(job.expires_at) - Date.now()) / 60000))}{" "}
          {t("minutesLeft")}
        </Text>
      )}
      {job.employer_rating != null && <Text style={s.body}>★ {job.employer_rating}</Text>}
      <Text style={s.body}>{t("privacy")}</Text>
    </View>
  );
}
