import JobSummary from "../live/JobSummary";
import DiscoverySurface from "../live/DiscoverySurface";
// DEV presentation data only. Positions are approximate, never private addresses.
import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import LocationPin from "../live/LocationPin";
import { Button, Field, styles as s } from "../live/ui";
export const previewJobs = [
  {
    id: "preview-bakery",
    titleKey: "bakeryHelper",
    pay: 700,
    unit: "day",
    distance: 1.2,
    lat: 13.089,
    lng: 80.218,
  },
  {
    id: "preview-electrician",
    titleKey: "electrician",
    pay: 600,
    unit: "job",
    distance: 1.8,
    lat: 13.078,
    lng: 80.204,
  },
  {
    id: "preview-cashier",
    titleKey: "shopCashier",
    pay: 12000,
    unit: "month",
    distance: 2.5,
    lat: 13.101,
    lng: 80.22,
  },
];
export function PreviewJobCard({
  item,
  t,
  onView,
}: {
  item: (typeof previewJobs)[number];
  t: (key: string) => string;
  onView: () => void;
}) {
  return (
    <View style={s.card}>
      <Text style={s.heading}>{t(item.titleKey)}</Text>
      <Text style={s.heading}>
        ₹{item.pay.toLocaleString("en-IN")} / {t(item.unit)}
      </Text>
      <Text style={s.body}>
        {t("annaNagar")} · {t("approximate")}: {item.distance} km
      </Text>
      <Text style={s.body}>
        {t("part_time")} · {t("expiresPreview")}
      </Text>
      <Button title={t("viewJob")} secondary onPress={onView} />
    </View>
  );
}
export default function PreviewMap({
  radius,
  setRadius,
  t,
  onApply,
  onLocationDone,
  initialPicking = false,
}: {
  onLocationDone?: () => void;
  initialPicking?: boolean;
  radius: number;
  setRadius: (n: number) => void;
  t: (key: string) => string;
  onApply: (job?: (typeof previewJobs)[number]) => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [detail, setDetail] = useState<(typeof previewJobs)[number] | null>(null);
  const [point, setPoint] = useState({ latitude: 13.085, longitude: 80.21 });
  const [moving, setMoving] = useState(initialPicking);
  const [locality, setLocality] = useState("");
  const [moved, setMoved] = useState(false);
  const [expiry] = useState(() => new Date(Date.now() + 18 * 3600000).toISOString());
  const jobs = previewJobs.filter(
    (j) =>
      j.distance * 1000 <= radius &&
      (!kind ||
        (kind === "residential"
          ? j.id === "preview-electrician"
          : j.id !== "preview-electrician")) &&
      (!query || t(j.titleKey).toLowerCase().includes(query.toLowerCase())),
  );
  if (detail)
    return (
      <ScrollView contentContainerStyle={s.content}>
        <JobSummary
          t={t}
          distance={detail.distance * 1000}
          job={{
            title: t(detail.titleKey),
            pay: detail.pay,
            pay_unit: detail.unit,
            kind: detail.id === "preview-electrician" ? "residential" : "business",
            category: t(detail.titleKey),
            locality: t("annaNagar"),
            description: t("previewJobDescription"),
            schedule: t("previewSchedule"),
            workers_required: 1,
            required_languages: ["en", "ta"],
            expires_at: expiry,
          }}
        />
        <Button title={t("apply")} onPress={() => onApply(detail)} />
        <Button title={t("back")} secondary onPress={() => setDetail(null)} />
      </ScrollView>
    );
  if (moving)
    return (
      <View style={{ flex: 1 }}>
        <LocationPin
          fill
          position={point}
          t={t}
          onMove={(p) => {
            setPoint(p);
            setMoved(true);
          }}
        />
        <View
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            right: 10,
            backgroundColor: "white",
            padding: 10,
            borderRadius: 12,
          }}
        >
          <Text style={s.body}>{t("movePin")}</Text>
          <Button
            title={t("back")}
            secondary
            onPress={() => {
              if (initialPicking) onLocationDone?.();
              else setMoving(false);
            }}
          />
        </View>
        <View
          style={{
            position: "absolute",
            bottom: 34,
            left: 10,
            right: 10,
            backgroundColor: "white",
            padding: 12,
            borderRadius: 12,
            gap: 8,
          }}
        >
          <Field label={t("locality")} value={locality} onChange={setLocality} />
          <Button
            title={t("confirmLocation")}
            disabled={!moved || locality.trim().length < 2}
            onPress={() => setMoving(false)}
          />
        </View>
      </View>
    );
  return (
    <DiscoverySurface
      position={point}
      jobs={jobs.map((j) => ({
        job: {
          ...j,
          title: t(j.titleKey),
          pay_unit: j.unit,
          locality: locality || t("annaNagar"),
          employment_type: "part_time",
          kind: j.id === "preview-electrician" ? "residential" : "business",
          created_at: new Date(Date.now() - 3600000).toISOString(),
          expires_at: expiry,
          isUrgent: j.id === "preview-bakery",
        },
        distance_m: j.distance * 1000,
        approx_lat: j.lat,
        approx_lng: j.lng,
      }))}
      radius={radius}
      onRadius={setRadius}
      t={t}
      query={query}
      onQuery={setQuery}
      kind={kind}
      onKind={setKind}
      locality={locality || t("annaNagar")}
      onLocation={() => setMoving(true)}
      onLocated={(p) => {
        setPoint(p);
        setLocality(t("currentLocation"));
      }}
      onViewJob={(j) => setDetail(j)}
    />
  );
}
