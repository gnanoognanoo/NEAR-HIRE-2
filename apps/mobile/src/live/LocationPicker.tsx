import { NeoModal as Modal, NeoBottomSheetSurface, neoCompact } from "./ui";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, ScrollView, Text, View } from "react-native";
import { Button, Field, styles as s, colors } from "./ui";
import { locationService, type Place } from "./services";
import { boundedLocation, coordinates, locationErrorKey, type Position } from "./location-logic";
import { locationStatus } from "./location-acquisition";
import CurrentLocationControl from "./CurrentLocationControl";
import LocationPin from "./LocationPin";
import { mergeReverseLocation, resolveLocationSuggestion } from "./location-selection";
export default function LocationPicker({
  t,
  onSelect,
  initial,
}: {
  t: (key: string) => string;
  onSelect: (p: Position) => void;
  initial?: Position | null;
}) {
  const [sheet, setSheet] = useState(false);
  const [diagnostics, setDiagnostics] = useState(false);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [point, setPoint] = useState<Position | null>(initial || null);
  const [lat, setLat] = useState(initial ? String(initial.latitude) : "");
  const [lng, setLng] = useState(initial ? String(initial.longitude) : "");
  const [locality, setLocality] = useState(initial?.locality || "");
  const [address, setAddress] = useState(initial?.formatted_address || "");
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [retry, setRetry] = useState(0);
  const [searchMode, setSearchMode] = useState<"search" | "geocode">("search");
  const revision = useRef(0);
  const cache = useRef(new Map<string, { time: number; data: Place[] }>());
  useEffect(() => {
    let alive = true;
    const id = setTimeout(
      async () => {
        if (query.trim().length < 3) {
          setPlaces([]);
          setSearched(false);
          setSearching(false);
          return;
        }
        const value = query.trim();
        const key = `${searchMode}:${value}`;
        setSearching(true);
        setError("");
        try {
          const hit = cache.current.get(key);
          const data =
            hit && Date.now() - hit.time < 300000
              ? hit.data
              : await locationService[searchMode](value);
          if (alive) {
            setPlaces(data);
            setSearched(true);
            if (cache.current.size > 30) cache.current.clear();
            cache.current.set(key, { time: Date.now(), data });
          }
        } catch (e) {
          if (alive) {
            setError(locationErrorKey(e));
            setPlaces([]);
            setSearched(false);
          }
        } finally {
          if (alive) setSearching(false);
        }
      },
      searchMode === "geocode" ? 0 : 400,
    );
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [query, retry, searchMode]);
  function geocode() {
    if (query.trim().length < 3 || busy || searching) return;
    setSearchMode("geocode");
    setRetry((v) => v + 1);
  }
  async function select(p: Position, reverse = true) {
    const rev = ++revision.current;
    setPoint({ ...p, source: p.source || "manual" });
    setLat(String(p.latitude));
    setLng(String(p.longitude));
    setLocality(p.locality || "");
    setAddress(p.formatted_address || "");
    setError("");
    setBusy(reverse);
    if (!reverse) return;
    setBusy(true);
    try {
      const place = await boundedLocation(locationService.reverse(p.latitude, p.longitude), 5000);
      if (rev === revision.current) {
        setPoint(mergeReverseLocation(p, place));
        setLocality(place.locality || "");
        setAddress(place.formatted_address || "");
      }
    } catch (e) {
      if (rev === revision.current) setError(locationErrorKey(e));
    } finally {
      if (rev === revision.current) setBusy(false);
    }
  }
  async function gps() {
    setBusy(true);
    setError("");
    try {
      await select(await locationService.gps());
    } catch (e) {
      setError(locationErrorKey(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <LocationPin
        fill
        zoom={point ? 15 : 4}
        position={point || { latitude: 20.5937, longitude: 78.9629 }}
        onMove={(p) => void select(p)}
        t={t}
      />
      <View
        style={{
          position: "absolute",
          top: 10,
          left: 10,
          right: 10,
          backgroundColor: colors.surface,
          borderRadius: 20,
          ...neoCompact,
          padding: 12,
          maxHeight: "45%",
        }}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
          {(error === "locationPermanent" || error === "gpsDisabled") && Platform.OS !== "web" && (
            <Button
              title={t("openSettings")}
              secondary
              onPress={() => {
                if (error === "gpsDisabled" && Platform.OS === "android")
                  void Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS").catch(() =>
                    Linking.openSettings(),
                  );
                else void Linking.openSettings();
              }}
            />
          )}
          <Field
            label={t("manual")}
            value={query}
            maxLength={500}
            returnKeyType="search"
            onSubmitEditing={geocode}
            onChange={(value) => {
              setQuery(value);
              setSearchMode("search");
              setPlaces([]);
              setSearched(false);
            }}
          />
          <Button
            title={t("searchAddress")}
            secondary
            disabled={query.trim().length < 3 || busy || searching}
            onPress={geocode}
          />
          {(busy || searching) && (
            <>
              <ActivityIndicator color={colors.accent} />
              <Text style={s.body}>{t("locationLoading")}</Text>
            </>
          )}
          {!!error && (
            <>
              <Text accessibilityRole="alert" style={s.body}>
                {t(error)}
              </Text>
              <Button
                title={t("retry")}
                secondary
                disabled={busy || searching}
                onPress={() => {
                  if (query.length >= 3) setRetry((v) => v + 1);
                  else if (point) void select(point);
                  else void gps();
                }}
              />
            </>
          )}
          {searched && !searching && !places.length && <Text style={s.body}>{t("noPlaces")}</Text>}
          {places.map((p) => (
            <Button
              key={p.id}
              title={p.label}
              secondary
              disabled={busy}
              onPress={() => {
                const request = ++revision.current;
                setBusy(true);
                resolveLocationSuggestion(p, locationService.resolve)
                  .then((place) =>
                    request === revision.current ? select(place, false) : undefined,
                  )
                  .catch((e) => {
                    if (request === revision.current) setError(locationErrorKey(e));
                  })
                  .finally(() => {
                    if (request === revision.current) setBusy(false);
                  });
              }}
            />
          ))}
          <CurrentLocationControl
            t={t}
            onLocated={(p) => void select(p)}
            onManual={() => {
              setSheet(true);
              setDiagnostics(true);
            }}
          />
        </ScrollView>
      </View>
      <View
        style={{
          position: "absolute",
          bottom: 34,
          left: 10,
          right: 10,
          backgroundColor: colors.surface,
          padding: 12,
          borderRadius: 20,
          ...neoCompact,
          gap: 8,
        }}
      >
        {point && <Text style={s.body}>{locationStatus(point, t)}</Text>}
        <Text style={s.body}>{t("movePin")}</Text>
        <Button
          title={t("neoManualCoordinates")}
          secondary
          onPress={() => {
            setSheet(true);
            setDiagnostics(true);
          }}
        />
        <Button title={t("confirmLocation")} disabled={!point} onPress={() => setSheet(true)} />
      </View>
      <Modal visible={sheet} transparent onRequestClose={() => setSheet(false)}>
        <View
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(37,50,71,0.32)" }}
        >
          <NeoBottomSheetSurface>
            <ScrollView
              style={{ maxHeight: "85%" }}
              contentContainerStyle={s.content}
              keyboardShouldPersistTaps="handled"
            >
              <Button title={t("close")} secondary onPress={() => setSheet(false)} />
              <Button
                title={t("neoManualCoordinates")}
                secondary
                onPress={() => setDiagnostics(!diagnostics)}
              />
              {diagnostics && (
                <>
                  <Text style={s.body}>{t("manualCoordinates")}</Text>
                  <View style={s.row}>
                    <Field label={t("latitude")} value={lat} onChange={setLat} />
                    <Field label={t("longitude")} value={lng} onChange={setLng} />
                  </View>
                  <Button
                    title={t("useCoordinates")}
                    secondary
                    disabled={busy}
                    onPress={() => {
                      try {
                        void select({ ...coordinates(lat, lng), source: "manual" });
                      } catch (e) {
                        setError(locationErrorKey(e));
                      }
                    }}
                  />
                </>
              )}
              <Field label={t("locality")} value={locality} onChange={setLocality} />
              <Field label={t("privateAddress")} value={address} onChange={setAddress} />
              <Text style={s.body}>{t("privateLocationNote")}</Text>
              <Button
                title={t("confirmLocation")}
                disabled={!point || busy || locality.trim().length < 2}
                onPress={() => {
                  if (point)
                    onSelect({
                      ...point,
                      locality: locality.trim(),
                      formatted_address: address.trim(),
                      label: locality.trim(),
                    });
                }}
              />
            </ScrollView>
          </NeoBottomSheetSurface>
        </View>
      </Modal>
    </View>
  );
}
