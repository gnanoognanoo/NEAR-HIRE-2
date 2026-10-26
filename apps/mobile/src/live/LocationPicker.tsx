import { NeoModal as Modal, NeoBottomSheetSurface, neoCompact } from "./ui";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, ScrollView, Text, View } from "react-native";
import { Button, Field, styles as s, colors } from "./ui";
import { locationService, type Place } from "./services";
import { boundedLocation, coordinates, locationErrorKey, type Position } from "./location-logic";
import { locationStatus } from "./location-acquisition";
import CurrentLocationControl from "./CurrentLocationControl";
import LocationPin from "./LocationPin";
import {
  confirmedLocation,
  manualCoordinatesApplied,
  optionalReverseLocation,
  resolveLocationSuggestion,
} from "./location-selection";
import {
  addressProviderUnavailable,
  locationCapabilities,
  NO_ADDRESS_PROVIDER,
} from "./location-provider-state";
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
  const [reversePending, setReversePending] = useState(false);
  const [capabilities, setCapabilities] = useState(NO_ADDRESS_PROVIDER);
  const [capabilitiesAttempt, setCapabilitiesAttempt] = useState(0);
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [retry, setRetry] = useState(0);
  const [searchMode, setSearchMode] = useState<"search" | "geocode">("search");
  const revision = useRef(0);
  const detailsEdited = useRef(false);
  const cache = useRef(new Map<string, { time: number; data: Place[] }>());
  useEffect(
    () => () => {
      ++revision.current;
    },
    [],
  );
  useEffect(() => {
    let alive = true;
    setCapabilitiesLoading(true);
    setCapabilities(NO_ADDRESS_PROVIDER);
    boundedLocation(locationService.capabilities(), 5000)
      .then((data) => {
        if (alive) setCapabilities(locationCapabilities(data));
      })
      .catch(() => {
        if (alive) setCapabilities(NO_ADDRESS_PROVIDER);
      })
      .finally(() => {
        if (alive) setCapabilitiesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [capabilitiesAttempt]);
  useEffect(() => {
    if (!capabilities.search) {
      cache.current.clear();
      setPlaces([]);
      setSearched(false);
      setSearching(false);
      return;
    }
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
            if (addressProviderUnavailable(e)) {
              setCapabilities(NO_ADDRESS_PROVIDER);
              setError("");
            } else setError(locationErrorKey(e));
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
  }, [query, retry, searchMode, capabilities.search]);
  function geocode() {
    if (!capabilities.search || query.trim().length < 3 || busy || searching) return;
    setSearchMode("geocode");
    setRetry((v) => v + 1);
  }
  function select(p: Position, reverse = true) {
    const rev = ++revision.current;
    const selected = {
      ...p,
      ...coordinates(p.latitude, p.longitude),
      source: p.source || "manual",
    };
    detailsEdited.current = false;
    setPoint(selected);
    setLat(String(selected.latitude));
    setLng(String(selected.longitude));
    setLocality(p.locality || "");
    setAddress(p.formatted_address || "");
    setError("");
    setBusy(false);
    setReversePending(reverse && capabilities.reverseGeocoding);
    // Coordinates become usable immediately. Address enrichment never gates confirmation.
    void optionalReverseLocation(
      selected,
      reverse && capabilities.reverseGeocoding,
      locationService.reverse,
    )
      .then((result) => {
        if (rev !== revision.current) return;
        setPoint(result.point);
        if (result.error) {
          if (addressProviderUnavailable(result.error)) setCapabilities(NO_ADDRESS_PROVIDER);
        } else if (!detailsEdited.current) {
          setLocality(result.point.locality || "");
          setAddress(result.point.formatted_address || "");
        }
      })
      .finally(() => {
        if (rev === revision.current) setReversePending(false);
      });
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
          <CurrentLocationControl
            t={t}
            onLocated={(p) => void select(p)}
            onManual={() => {
              setSheet(true);
              setDiagnostics(true);
            }}
          />
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
          {capabilities.search ? (
            <>
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
            </>
          ) : (
            <>
              <Text style={s.body}>
                {t(capabilitiesLoading ? "locationSearchChecking" : "locationSearchOff")}
              </Text>
              <Button
                title={t("retryAddressSearch")}
                secondary
                disabled={capabilitiesLoading}
                onPress={() => setCapabilitiesAttempt((v) => v + 1)}
              />
            </>
          )}
          {(busy || searching || reversePending) && (
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
                    if (request === revision.current) {
                      if (addressProviderUnavailable(e)) setCapabilities(NO_ADDRESS_PROVIDER);
                      else setError(locationErrorKey(e));
                    }
                  })
                  .finally(() => {
                    if (request === revision.current) setBusy(false);
                  });
              }}
            />
          ))}
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
              <Field
                label={t("locality")}
                value={locality}
                maxLength={120}
                onChange={(value) => {
                  detailsEdited.current = true;
                  setLocality(value);
                }}
              />
              <Field
                label={t("privateAddress")}
                value={address}
                maxLength={500}
                onChange={(value) => {
                  detailsEdited.current = true;
                  setAddress(value);
                }}
              />
              <Text style={s.body}>{t("privateLocationNote")}</Text>
              {point && !manualCoordinatesApplied(point, lat, lng) && (
                <Text accessibilityRole="alert" style={s.body}>
                  {t("locationCoordinatesApply")}
                </Text>
              )}
              {!!error && (
                <Text accessibilityRole="alert" style={s.body}>
                  {t(error)}
                </Text>
              )}
              <Button
                title={t("confirmLocation")}
                disabled={
                  !point ||
                  busy ||
                  locality.trim().length < 2 ||
                  !manualCoordinatesApplied(point, lat, lng)
                }
                onPress={() => {
                  try {
                    const selected = confirmedLocation(point, locality, address, {
                      latitude: lat,
                      longitude: lng,
                    });
                    ++revision.current;
                    setReversePending(false);
                    onSelect(selected);
                  } catch (e) {
                    setError(locationErrorKey(e));
                  }
                }}
              />
            </ScrollView>
          </NeoBottomSheetSurface>
        </View>
      </Modal>
    </View>
  );
}
