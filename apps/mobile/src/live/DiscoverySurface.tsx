import CurrentLocationControl from "./CurrentLocationControl";
import React, { useState, useEffect } from "react";
import { Modal, Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import JobMap, { type MapProps } from "./JobMap";
import DistanceControl from "./DistanceControl";
import { Button, Choice, Field, colors, styles as s } from "./ui";
import { JOB_MARKER_COLORS, MAX_MAP_MARKERS, mapCountText } from "./map-presentation";
export default function DiscoverySurface({
  position,
  jobs,
  radius,
  onRadius,
  t,
  query,
  onQuery,
  kind,
  onKind,
  locality,
  onLocation,
  onLocated,
  onViewJob,
  filters,
  listContent,
  hasMore = false,
  loading = false,
  error = false,
  onRetry,
}: {
  position: MapProps["position"];
  jobs: any[];
  radius: number;
  onRadius: (r: number) => void;
  t: (key: string) => string;
  query: string;
  onQuery: (s: string) => void;
  kind: string;
  onKind: (s: string) => void;
  locality: string;
  onLocation: () => void;
  onLocated: (p: { latitude: number; longitude: number }) => void;
  onViewJob: (job: any) => void;
  filters?: React.ReactNode;
  listContent?: React.ReactNode;
  hasMore?: boolean;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}) {
  const [sheet, setSheet] = useState(false),
    [list, setList] = useState(false),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [recenter, setRecenter] = useState(0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const current = jobs.filter((item) => Date.parse(item.job.expires_at) > now);
  const visible = current.slice(0, MAX_MAP_MARKERS);
  const selected = visible.find((item) => item.job.id === selectedId);
  const icon = (
    name: React.ComponentProps<typeof Feather>["name"],
    label: string,
    action: () => void,
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={action}
      style={m.icon}
    >
      <Feather name={name} size={20} color={colors.accent} />
    </Pressable>
  );
  return (
    <View
      testID="map-discovery-surface"
      style={{ flex: 1, minHeight: 0, backgroundColor: colors.white }}
    >
      {!list && (
        <View style={StyleSheet.absoluteFill}>
          <JobMap
            fill
            position={position}
            jobs={visible}
            selectedId={selectedId}
            recenterKey={recenter}
            onSelect={(job) => setSelectedId(job.id)}
            unavailable={t("mapConfigurationMissing")}
            t={t}
          />
        </View>
      )}
      <View
        pointerEvents="box-none"
        style={
          list
            ? { padding: 10, gap: 6 }
            : { position: "absolute", top: 10, left: 10, right: 10, gap: 6 }
        }
      >
        <View testID="find-compact-panel" style={m.panel}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("openJobFilters")}
              onPress={() => setSheet(true)}
              style={{ flex: 1, paddingVertical: 8, minHeight: 44, justifyContent: "center" }}
            >
              <Text style={[s.label, { fontWeight: "600" }]}>
                {mapCountText(visible.length, radius, t)}
              </Text>
            </Pressable>
            {icon("sliders", t("filters"), () => setSheet(true))}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("refreshLocation")}
              onPress={onLocation}
              style={{ flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              <Feather name="map-pin" size={13} color={colors.accent} />
              <Text numberOfLines={1} style={[s.body, { fontSize: 12, flex: 1 }]}>
                {locality}
              </Text>
            </Pressable>
            {icon(list ? "map" : "list", t(list ? "map" : "list"), () => setList(!list))}
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {["", "business", "residential"].map((k) => (
            <Choice key={k} title={t(k || "all")} selected={kind === k} onPress={() => onKind(k)} />
          ))}
        </ScrollView>
        {(loading || error) && (
          <View style={m.panel}>
            <Text style={s.body}>{t(error ? "genericError" : "wait")}</Text>
            {error && onRetry && <Button title={t("retry")} onPress={onRetry} />}
          </View>
        )}
      </View>
      {list ? (
        <ScrollView contentContainerStyle={s.content}>
          {listContent ||
            current.map((item) => (
              <View key={item.job.id} style={s.card}>
                <Text style={s.heading}>{item.job.title}</Text>
                {item.job.isUrgent === true && (
                  <Text style={{ color: JOB_MARKER_COLORS.urgent, fontWeight: "600" }}>
                    {t("urgentHiring")}
                  </Text>
                )}
                <Text style={s.body}>
                  {item.distance_m / 1000} km · {t(item.job.employment_type || "temporary")}
                </Text>
                <Text style={s.body}>
                  ₹{item.job.pay} / {t(item.job.pay_unit)} · {item.job.locality}
                </Text>
                <Text style={s.body}>{t(item.job.kind || "business")}</Text>
                {item.job.created_at && (
                  <Text style={s.body}>
                    {t("posted")}: {new Date(item.job.created_at).toLocaleDateString()}
                  </Text>
                )}
                <Text style={s.body}>
                  {Math.max(0, Math.ceil((Date.parse(item.job.expires_at) - now) / 60000))}{" "}
                  {t("minutesLeft")}
                </Text>
                <Button title={t("viewJob")} onPress={() => onViewJob(item.job)} />
              </View>
            ))}
          {!current.length && <Text style={s.body}>{t("empty")}</Text>}
        </ScrollView>
      ) : (
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", bottom: 34, left: 10, right: 10, gap: 8 }}
        >
          {selected && (
            <View style={m.panel}>
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <Text style={[s.heading, { fontSize: 17, flex: 1 }]} numberOfLines={1}>
                  {selected.job.title}
                </Text>
                {icon("x", t("close"), () => setSelectedId(null))}
              </View>
              {selected.job.isUrgent === true && (
                <Text style={{ color: JOB_MARKER_COLORS.urgent, fontWeight: "600" }}>
                  {t("urgentHiring")}
                </Text>
              )}
              <Text style={s.body}>
                ₹{selected.job.pay} / {t(selected.job.pay_unit)} · {selected.distance_m / 1000}{" "}
                {t("distanceKm")}
              </Text>
              <Text style={s.body}>
                {selected.job.locality} · {t(selected.job.employment_type || "temporary")}
              </Text>
              <Text style={[s.body, { fontSize: 12 }]}>
                {Math.max(0, Math.ceil((Date.parse(selected.job.expires_at) - now) / 60000))}{" "}
                {t("minutesLeft")}
              </Text>
              <Button title={t("viewJob")} onPress={() => onViewJob(selected.job)} />
            </View>
          )}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
            }}
          >
            <View style={[m.panel, { padding: 8, flexDirection: "row", gap: 9, flexShrink: 1 }]}>
              <Text style={{ color: JOB_MARKER_COLORS.normal, fontSize: 12 }}>
                ● {t("normalJob")}
              </Text>
              <Text style={{ color: JOB_MARKER_COLORS.urgent, fontSize: 12 }}>
                ● {t("urgentHiring")}
              </Text>
            </View>
            <CurrentLocationControl
              t={t}
              onManual={onLocation}
              onLocated={(p) => {
                onLocated(p);
                setRecenter((v) => v + 1);
              }}
            />
          </View>
        </View>
      )}
      <Modal
        visible={sheet}
        transparent
        animationType="slide"
        onRequestClose={() => setSheet(false)}
      >
        <View
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(39,34,49,0.25)" }}
        >
          <SafeAreaView
            style={{
              maxHeight: "85%",
              backgroundColor: colors.white,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
            }}
          >
            <ScrollView contentContainerStyle={s.content}>
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <Text style={s.heading}>{t("filters")}</Text>
                {icon("x", t("close"), () => setSheet(false))}
              </View>
              <Field label={t("search")} value={query} onChange={onQuery} />
              <DistanceControl metres={radius} onChange={onRadius} t={t} />
              {filters}
              {(hasMore || current.length > MAX_MAP_MARKERS) && (
                <Text style={s.body}>{t("loadedMapResults")}</Text>
              )}
              <Button title={t("continue")} onPress={() => setSheet(false)} />
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
const m = StyleSheet.create({
  panel: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.line,
  },
  icon: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: colors.white,
  },
});
