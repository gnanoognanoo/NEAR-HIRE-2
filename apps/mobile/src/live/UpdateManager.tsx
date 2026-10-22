import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from "expo-updates";
import { createUpdateController, criticalActivity, shouldAutoCheck, type UpdateResult } from "./update-logic";
import { Button, NeoFeedback, styles as s } from "./ui";

const UpdateContext = createContext<{
  result: UpdateResult;
  checkedAt: string;
  pending: boolean;
  busy: boolean;
  nativeError: boolean;
  check: () => Promise<void>;
  restart: () => Promise<void>;
} | null>(null);
const LAST_CHECK = "nearhire.ota.last-check";

export function UpdateProvider({ children }: { children: React.ReactNode }) {
  const native = Updates.useUpdates();
  const current = useRef(native);
  current.current = native;
  const [result, setResult] = useState<UpdateResult>("otaNotChecked");
  const [checkedAt, setCheckedAt] = useState("");
  const lastAutoCheck = useRef(0);
  const checking = useRef(false);
  const controller = useRef<ReturnType<typeof createUpdateController> | null>(null);
  if (!controller.current)
    controller.current = createUpdateController({
      enabled: () => Platform.OS !== "web" && !__DEV__ && Updates.isEnabled,
      check: Updates.checkForUpdateAsync,
      fetch: Updates.fetchUpdateAsync,
      reload: () => Updates.reloadAsync(),
      pending: () => current.current.isUpdatePending,
      gate: criticalActivity,
      result: (value) => {
        setResult(value);
        if (["otaReady", "otaCurrent", "otaFailed"].includes(value)) {
          const time = new Date().toISOString();
          setCheckedAt(time);
          void AsyncStorage.setItem(LAST_CHECK, JSON.stringify({ result: value, time })).catch(
            () => {},
          );
        }
      },
    });
  useEffect(() => {
    let alive = true;
    void AsyncStorage.getItem(LAST_CHECK)
      .then((raw) => {
        if (!alive || !raw || checking.current) return;
        try {
          const saved = JSON.parse(raw);
          if (typeof saved.time === "string") setCheckedAt(saved.time);
        } catch {
          /* Only a timestamp is restored; readiness always comes from native state. */
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const check = () => {
      const n = current.current;
      if (!shouldAutoCheck({ development: __DEV__, web: Platform.OS === "web", enabled: Updates.isEnabled,
        channel: Updates.channel, active: AppState.currentState === "active",
        busy: checking.current || n.isStartupProcedureRunning || n.isChecking || n.isDownloading || n.isRestarting,
        now: Date.now(), lastCheck: lastAutoCheck.current })) return;
      lastAutoCheck.current = Date.now();
      checking.current = true;
      void controller.current!.check().finally(() => { checking.current = false; });
    };
    check();
    const timer = setInterval(check, 60 * 1000);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => { clearInterval(timer); listener.remove(); };
  }, [native.isStartupProcedureRunning]);
  const busy =
    native.isStartupProcedureRunning ||
    native.isChecking ||
    native.isDownloading ||
    native.isRestarting ||
    result === "otaChecking" ||
    result === "otaDownloading";
  return (
    <UpdateContext.Provider
      value={{
        result,
        checkedAt,
        busy,
        pending: native.isUpdatePending || result === "otaReady" || result === "otaBusy",
        nativeError: !!(native.checkError || native.downloadError),
        check: async () => {
          if (!busy) {
            checking.current = true;
            try { await controller.current!.check(); } finally { checking.current = false; }
          }
        },
        restart: () => controller.current!.restart(),
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
}
export const useNearHireUpdates = () => {
  const value = useContext(UpdateContext);
  if (!value) throw new Error("UPDATE_PROVIDER_REQUIRED");
  return value;
};

export function UpdateNotice({ t }: { t: (key: string) => string }) {
  const updates = useNearHireUpdates();
  if (!updates.pending) return null;
  return (
    <View style={{ padding: 12, gap: 8 }}>
      <Text style={s.body}>{t("otaReady")}</Text>
      {updates.result === "otaBusy" && <NeoFeedback tone="error" message={t("otaBusy")} />}
      <Button
        title={t("otaRestart")}
        secondary
        disabled={updates.busy}
        onPress={() => void updates.restart()}
      />
    </View>
  );
}
