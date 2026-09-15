import "react-native-url-polyfill/auto";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient, processLock } from "@supabase/supabase-js";
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
// Native tokens belong in the OS keychain. Web preview sessions are tab-scoped.
export const storage = {
  async getItem(k: string) {
    if (Platform.OS === "web")
      return typeof sessionStorage === "undefined" ? null : sessionStorage.getItem(k);
    return SecureStore.getItemAsync(k);
  },
  async setItem(k: string, v: string) {
    if (Platform.OS === "web") {
      sessionStorage.setItem(k, v);
      return;
    }
    await SecureStore.setItemAsync(k, v, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async removeItem(k: string) {
    if (Platform.OS === "web") {
      sessionStorage.removeItem(k);
      return;
    }
    await SecureStore.deleteItemAsync(k);
  },
};
export const db = configured
  ? createClient(url!, key!, {
      auth: {
        lock: processLock,
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
      global: {
        fetch: async (input, init) =>
          fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(20000) }),
      },
    })
  : null;
if (Platform.OS !== "web" && db) {
  if (AppState.currentState === "active") db.auth.startAutoRefresh();
  else db.auth.stopAutoRefresh();
  AppState.addEventListener("change", (s) => {
    if (s === "active") db.auth.startAutoRefresh();
    else db.auth.stopAutoRefresh();
  });
}
export function backend() {
  if (!db) throw new Error("SERVICE_NOT_CONFIGURED");
  return db;
}
export async function rpc<T = any>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await backend().rpc(name, args);
  if (error) throw error;
  return data as T;
}
export async function edge<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await backend().functions.invoke(name, { body: args });
  if (error) {
    let code = "REQUEST_FAILED";
    try {
      code = (await error.context.json()).error || code;
    } catch {}
    throw new Error(code);
  }
  return data as T;
}
