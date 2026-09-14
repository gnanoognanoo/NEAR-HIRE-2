import type { CreditSummary } from "./credit-model";
import { validateRadiusMetres } from "./radius-logic";
import { coordinates } from "./location-logic";
import { createPhoneAuth, completeLogout } from "./auth-operations";
import { deviceLocation } from "./device-location";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { backend, edge, rpc, storage } from "./client";

let loggingOut = false;
let deviceQueue: Promise<unknown> = Promise.resolve();
const DEVICE_KEY = "nearhire.push-token";
function registerToken(token: string) {
  if (loggingOut) return Promise.resolve();
  deviceQueue = deviceQueue
    .catch(() => {})
    .then(async () => {
      await rpc("register_device", { p_token: token, p_platform: "android" });
      await storage.setItem(DEVICE_KEY, token);
    });
  return deviceQueue;
}
export const authService = {
  ...createPhoneAuth(() => backend().auth),
  async logout() {
    loggingOut = true;
    try {
      await deviceQueue.catch(() => {});
      let token = await storage.getItem(DEVICE_KEY);
      if (!token && Platform.OS === "android") {
        const permission = await Notifications.getPermissionsAsync();
        if (permission.status === "granted")
          token = (await Notifications.getDevicePushTokenAsync()).data;
      }
      await completeLogout({
        unregister: async () => {
          if (token) await rpc("unregister_device", { p_token: token });
        },
        signOut: () => backend().auth.signOut({ scope: "local" }),
        clear: () => storage.removeItem(DEVICE_KEY),
      });
    } finally {
      loggingOut = false;
    }
  },
  async remove() {
    await edge("delete-account", { confirmation: "DELETE" });
    await backend().auth.signOut();
  },
};
export const profileService = {
  async get() {
    const { data, error } = await backend().from("profiles").select("*").single();
    if (error) throw error;
    return data;
  },
  save: (p: Record<string, unknown>) => rpc("save_profile", { p }),
  preferences: (p: Record<string, unknown>) => rpc("save_preferences", { p }),
  async getPreferences() {
    const { data, error } = await backend().from("worker_profiles").select("*").single();
    if (error) throw error;
    return data;
  },
};
export const jobService = {
  nearby: (lat: number, lng: number, radius: number, filter: Record<string, unknown>, offset = 0) =>
    rpc<any[]>("nearby_jobs", {
      p_lat: lat,
      p_lng: lng,
      p_radius: validateRadiusMetres(radius),
      p_filter: filter,
      p_offset: offset,
    }),
  create: (p: Record<string, unknown>, requestId: string) =>
    rpc<string>("create_job", { p, p_request_id: requestId }),
  publish: (id: string) => rpc("publish_job", { p_job_id: id }),
  repost: (id: string, requestId: string) =>
    rpc("repost_job", { p_job_id: id, p_request_id: requestId }),
  transition: (id: string, status: string) =>
    rpc("transition_job", { p_job_id: id, p_status: status }),
  activity: (mode: string, offset = 0) =>
    rpc<any[]>("my_activity", { p_mode: mode, p_offset: offset }),
  save: (id: string) => rpc("toggle_saved", { p_job_id: id }),
};
export const applicationService = {
  apply: (id: string) => rpc("apply_job", { p_job_id: id }),
  decide: (id: string, status: string) =>
    rpc("decide_application", { p_application_id: id, p_status: status }),
  complete: (id: string) => rpc("confirm_completion", { p_application_id: id }),
  contact: (id: string) => rpc("private_contact", { p_application_id: id }),
};
export const reviewService = {
  submit: (id: string, stars: number, body: string) =>
    rpc("submit_review", { p_application_id: id, p_stars: stars, p_body: body }),
};
export const reportService = {
  action: (action: string, target: string, reason = "", detail = "") =>
    rpc("safety_action", {
      p_action: action,
      p_target: target,
      p_reason: reason,
      p_detail: detail,
    }),
};
export type Place = {
  id: string;
  label: string;
  latitude?: number;
  longitude?: number;
  locality?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  formatted_address?: string;
};
export const locationService = {
  gps: deviceLocation,
  search: (query: string) => edge<Place[]>("location", { action: "search", query }),
  resolve: (id: string) => edge<Place>("location", { action: "resolve", id }),
  reverse: (latitude: number, longitude: number) =>
    edge<Place>("location", { action: "reverse", ...coordinates(latitude, longitude) }),
  alerts: (latitude: number, longitude: number, enabled: boolean) =>
    rpc("set_worker_location", { p_lat: latitude, p_lng: longitude, p_enabled: enabled }),
};
export const notificationService = {
  async list(offset = 0) {
    const { data, error } = await backend()
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + 19);
    if (error) throw error;
    return data;
  },
  read: (id: string) => rpc("read_notification", { p_id: id }),
  async enable() {
    if (Platform.OS !== "android") throw new Error("ANDROID_REQUIRED");
    await Notifications.setNotificationChannelAsync("default", {
      name: "NearHire",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted") throw new Error("NOTIFICATION_PERMISSION_DENIED");
    const token = await Notifications.getDevicePushTokenAsync();
    await registerToken(token.data);
  },
  subscribeRefresh() {
    return Notifications.addPushTokenListener((token) => {
      if (Platform.OS === "android") registerToken(token.data).catch(() => {});
    });
  },
};
export const creditService = {
  summary: () => rpc<CreditSummary>("credit_summary"),
  async history(offset = 0) {
    await rpc("credit_summary");
    const { data, error } = await backend()
      .from("credit_transactions")
      .select("id,delta,reason,created_at,metadata,expires_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + 29);
    if (error) throw error;
    return data;
  },
  async balance() {
    return (await rpc<CreditSummary>("credit_summary")).balance;
  },
  async packages() {
    const { data, error } = await backend()
      .from("credit_packages")
      .select("*")
      .eq("active", true)
      .order("sort_order");
    if (error) throw error;
    return data;
  },
};
