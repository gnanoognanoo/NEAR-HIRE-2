import { Linking, Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { backend, storage } from "./client";
import { callbackCode, assertLinkedUser, beginGoogle, type PendingOAuth } from "./oauth-logic";
const PENDING = "nearhire.oauth.pending";
let active = false;
let completing: Promise<void> | null = null;
const redirect = () =>
  Platform.OS === "web" ? window.location.origin + "/" : "nearhire://auth/callback";

export async function clearPendingOAuth() {
  await storage.removeItem(PENDING);
}
async function finish(url: string) {
  if (completing) return completing;
  completing = (async () => {
    const raw = await storage.getItem(PENDING);
    const pending: PendingOAuth | null = raw ? JSON.parse(raw) : null;
    const code = callbackCode(url, pending);
    const { data, error } = await backend().auth.exchangeCodeForSession(code);
    if (error) throw error;
    try {
      assertLinkedUser(pending!.userId, data.session?.user.id);
    } catch (error) {
      await backend().auth.signOut({ scope: "local" });
      throw error;
    }
  })().finally(async () => {
    await clearPendingOAuth();
    completing = null;
  });
  return completing;
}
// Invoked before session restoration, including a cold-start native callback.
export async function resumeGoogleAuth() {
  const url = Platform.OS === "web" ? window.location.href : await Linking.getInitialURL();
  if (!url) return;
  const parsed = new URL(url);
  if (!parsed.searchParams.has("code") && !parsed.searchParams.has("error")) return;
  if (Platform.OS === "web") window.history.replaceState(null, "", window.location.pathname);
  await finish(url);
}
export async function googleAuth(link = false) {
  if (active) return;
  active = true;
  try {
    // signInWithOAuth constructs a URL locally. Check provider readiness first so a
    // disabled provider doesn't navigate users to a raw Supabase error response.
    const settings = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "" },
      signal: AbortSignal.timeout(15000),
    });
    if (!settings.ok || !(await settings.json()).external?.google)
      throw new Error("SERVICE_NOT_CONFIGURED");
    const redirectTo = redirect();
    const url = await beginGoogle(backend().auth, link, redirectTo, (pending) =>
      storage.setItem(PENDING, JSON.stringify(pending)),
    );
    if (Platform.OS === "web") {
      window.location.assign(url);
      return;
    }
    const response = await WebBrowser.openAuthSessionAsync(url, redirectTo);
    if (response.type !== "success") throw new Error("OAUTH_CANCELLED");
    await finish(response.url);
  } catch (error) {
    await clearPendingOAuth();
    throw error;
  } finally {
    active = false;
  }
}
