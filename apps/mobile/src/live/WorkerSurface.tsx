import { Feather } from "@expo/vector-icons";
import CurrentLocationControl from "./CurrentLocationControl";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import JobMap from "./JobMap";
import DistanceControl from "./DistanceControl";
import type { Position } from "./location-logic";
import { Button, Choice, Field, styles as s, colors } from "./ui";
export type PublicWorker = {
  worker_id: string;
  name: string;
  locality: string;
  skills: string[];
  categories: string[];
  employment_types: string[];
  rating: number | null;
  distance_m: number;
  approx_lat: number;
  approx_lng: number;
};
export default function WorkerSurface({
  workers,
  position,
  radius,
  onRadius,
  t,
  onLocation,
  onLocated,
  onPost,
  loading = false,
  error = false,
  onRetry,
  onMore,
  query,
  onQuery,
}: {
  workers: PublicWorker[];
  position: Position | null;
  radius: number;
  onRadius: (r: number) => void;
  t: (k: string) => string;
  onLocation: () => void;
  onLocated: (p: { latitude: number; longitude: number }) => void;
  onPost: () => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onMore?: () => void;
  query: string;
  onQuery: (v: string) => void;
}) {
  const [profile, setProfile] = useState<PublicWorker | null>(null);
  const [list, setList] = useState(false),
    [filters, setFilters] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [recenter, setRecenter] = useState(0);
  const visible = workers.slice(0, 100),
    worker = visible.find((w) => w.worker_id === selected);
  const card = (w: PublicWorker) => (
    <View key={w.worker_id} style={s.card}>
      <Text style={s.heading}>{w.name}</Text>
      <Text style={s.body}>{w.skills.join(" · ")}</Text>
      <Text style={s.body}>
        {w.locality} · {t("approximate")} {w.distance_m / 1000} km
      </Text>
      <Text style={s.body}>
        {t("availableForWork")}
        {w.rating != null ? ` · ★ ${w.rating}` : ""}
      </Text>
      {!!w.employment_types.length && (
        <Text style={s.body}>{w.employment_types.map(t).join(" · ")}</Text>
      )}
      <Button title={t("viewWorkerProfile")} secondary onPress={() => setProfile(w)} />
    </View>
  );
  return (
    <View testID="worker-discovery" style={{ flex: 1, minHeight: 0 }}>
      {!list && position && (
        <View style={StyleSheet.absoluteFill}>
          <JobMap
            fill
            markerKind="worker"
            position={position}
            recenterKey={recenter}
            selectedId={selected}
            jobs={visible.map((w) => ({
              job: { id: w.worker_id, title: w.name },
              approx_lat: w.approx_lat,
              approx_lng: w.approx_lng,
            }))}
            onSelect={(w) => setSelected(w.id)}
            t={t}
            unavailable={t("mapNotConfigured")}
          />
        </View>
      )}
      <View
        style={
          list
            ? { padding: 10, gap: 8 }
            : { position: "absolute", top: 10, left: 10, right: 10, gap: 8 }
        }
      >
        <View
          testID="post-compact-panel"
          style={[s.card, { paddingHorizontal: 12, paddingVertical: 6, gap: 2 }]}
        >
          <Text style={[s.heading, { fontSize: 16, lineHeight: 22 }]}>{t("nearbyWorkers")}</Text>
          <Text numberOfLines={1} style={[s.body, { fontSize: 13, lineHeight: 18 }]}>
            {position?.label || t("selectLocation")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("filters")}
            onPress={() => setFilters(true)}
            style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <Text style={[s.body, { fontSize: 14, flex: 1 }]}>
              {t("workersWithin")
                .replace("{count}", String(visible.length))
                .replace("{radius}", String(radius / 1000))}
            </Text>
            <Feather name="sliders" size={19} color={colors.accent} />
          </Pressable>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <Pressable
              accessibilityRole="button"
              onPress={onPost}
              style={{
                minHeight: 44,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: colors.accent,
                justifyContent: "center",
                flexShrink: 1,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: "white" }}>
                {t("postJobCompact")}
              </Text>
            </Pressable>
            <Choice title={t("map")} selected={!list} onPress={() => setList(false)} />
            <Choice title={t("list")} selected={list} onPress={() => setList(true)} />
          </View>
        </View>
        {(loading || error) && (
          <View style={s.card}>
            <Text style={s.body}>{t(error ? "workerDiscoveryError" : "wait")}</Text>
            {error && onRetry && <Button title={t("retry")} onPress={onRetry} />}
          </View>
        )}
      </View>
      {list ? (
        <ScrollView contentContainerStyle={s.content}>
          {workers.map(card)}
          {!workers.length && <Text style={s.body}>{t("noWorkers")}</Text>}
          {onMore && <Button title={t("loadMore")} onPress={onMore} />}
        </ScrollView>
      ) : (
        <View style={{ position: "absolute", bottom: 34, left: 10, right: 10, gap: 8 }}>
          {worker && (
            <View>
              {card(worker)}
              <Button title={t("close")} secondary onPress={() => setSelected(null)} />
            </View>
          )}
          <CurrentLocationControl
            t={t}
            onManual={onLocation}
            onLocated={(p) => {
              onLocated(p);
              setRecenter((v) => v + 1);
            }}
          />
        </View>
      )}
      <Modal visible={!!profile} onRequestClose={() => setProfile(null)}>
        <ScrollView contentContainerStyle={s.content}>
          <Button title={t("close")} secondary onPress={() => setProfile(null)} />
          {profile && (
            <>
              <Feather name="user" size={56} color={colors.accent} />
              <Text style={s.title}>{profile.name}</Text>
              <Text style={s.body}>
                {profile.rating != null ? `★ ${profile.rating}` : t("notShared")}
              </Text>
              <Text style={s.body}>{profile.skills.join(" · ")}</Text>
              <Text style={s.body}>
                {profile.locality} · {t("approximate")} {profile.distance_m / 1000} km
              </Text>
              <Text style={s.body}>{t("availableForWork")}</Text>
              <Text style={s.body}>{profile.employment_types.map(t).join(" · ")}</Text>
              {["experience", "languages", "amount", "completedJobs"].map((k) => (
                <Text key={k} style={s.body}>
                  {t(k)}: {t("notShared")}
                </Text>
              ))}
              <Text style={s.body}>{t("workerPrivacy")}</Text>
            </>
          )}
        </ScrollView>
      </Modal>
      <Modal visible={filters} transparent onRequestClose={() => setFilters(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.2)" }}>
          <ScrollView
            style={{ maxHeight: "85%", backgroundColor: colors.white }}
            contentContainerStyle={s.content}
          >
            <Text style={s.heading}>{t("filters")}</Text>
            <Field label={t("searchWorkers")} value={query} onChange={onQuery} />
            <DistanceControl metres={radius} onChange={onRadius} t={t} />
            <Button
              title={t("refreshLocation")}
              secondary
              onPress={() => {
                setFilters(false);
                onLocation();
              }}
            />
            <Text style={s.body}>{t("workerPrivacy")}</Text>
            <Button title={t("continue")} onPress={() => setFilters(false)} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
