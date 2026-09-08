import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Text, View } from "react-native";
import { Button, Field, styles as s, colors } from "./ui";
import { locationService, type Place } from "./services";
import { coordinates, locationErrorKey, type Position } from "./location-logic";
import LocationPin from "./LocationPin";
export default function LocationPicker({
  t,
  onSelect,
  initial,
}: {
  t: (key: string) => string;
  onSelect: (p: Position) => void;
  initial?: Position | null;
}) {
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
  const revision = useRef(0);
  const cache = useRef(new Map<string, { time: number; data: Place[] }>());
  useEffect(() => {
    let alive = true;
    const id = setTimeout(async () => {
      if (query.trim().length < 3) {
        setPlaces([]);
        setSearched(false);
        setSearching(false);
        return;
      }
      const key = query.trim();
      setSearching(true);
      setError("");
      try {
        const hit = cache.current.get(key);
        const data =
          hit && Date.now() - hit.time < 300000 ? hit.data : await locationService.search(key);
        if (alive) {
          setPlaces(data);
          setSearched(true);
          if (cache.current.size > 30) cache.current.clear();
          cache.current.set(key, { time: Date.now(), data });
        }
      } catch (e) {
        if (alive) setError(locationErrorKey(e));
      } finally {
        if (alive) setSearching(false);
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [query, retry]);
  async function select(p: Position, reverse = true) {
    const rev = ++revision.current;
    setPoint(p);
    setLat(String(p.latitude));
    setLng(String(p.longitude));
    setLocality(p.locality || "");
    setAddress(p.formatted_address || "");
    setError("");
    if (!reverse) return;
    setBusy(true);
    try {
      const place = await locationService.reverse(p.latitude, p.longitude);
      if (rev === revision.current) {
        setPoint({ ...place, ...coordinates(p.latitude, p.longitude) });
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
    <>
      <Text style={s.title}>{t("permissionTitle")}</Text>
      <Text style={s.body}>{t("locationExplain")}</Text>
      <Button title={t("gps")} disabled={busy} onPress={() => void gps()} />
      {error === "locationPermanent" && (
        <Button title={t("openSettings")} secondary onPress={() => void Linking.openSettings()} />
      )}
      <Field label={t("manual")} value={query} onChange={setQuery} />
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
            setBusy(true);
            locationService
              .resolve(p.id)
              .then((place) =>
                select({ ...place, ...coordinates(place.latitude, place.longitude) }, false),
              )
              .catch((e) => setError(locationErrorKey(e)))
              .finally(() => setBusy(false));
          }}
        />
      ))}
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
            void select(coordinates(lat, lng));
          } catch (e) {
            setError(locationErrorKey(e));
          }
        }}
      />
      {point && <LocationPin position={point} onMove={(p) => void select(p)} t={t} />}
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
    </>
  );
}
