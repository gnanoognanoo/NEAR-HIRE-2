import { parsePhoneNumberFromString } from "libphonenumber-js";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { backend, edge, rpc } from "./client";
export const authService = {
  async send(phone: string) {
    const number = parsePhoneNumberFromString(phone, "IN");
    if (!number?.isValid()) throw new Error("INVALID_PHONE");
    const { error } = await backend().auth.signInWithOtp({ phone: number.number });
    if (error) throw error;
    return number.number;
  },
  async verify(phone: string, token: string) {
    if (!/^\d{6}$/.test(token)) throw new Error("INVALID_OTP");
    const { error } = await backend().auth.verifyOtp({ phone, token, type: "sms" });
    if (error) throw error;
  },
  async logout() {
    const { error } = await backend().auth.signOut();
    if (error) throw error;
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
      p_radius: radius,
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
export type Place = { id: string; label: string; latitude?: number; longitude?: number };
export const locationService = {
  async gps() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") throw new Error("LOCATION_PERMISSION_DENIED");
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: p.coords.latitude, longitude: p.coords.longitude };
  },
  search: (query: string) => edge<Place[]>("location", { action: "search", query }),
  resolve: (id: string) => edge<Place>("location", { action: "resolve", id }),
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
    await rpc("register_device", { p_token: token.data, p_platform: "android" });
  },
  subscribeRefresh() {
    return Notifications.addPushTokenListener((token) => {
      if (Platform.OS === "android")
        rpc("register_device", { p_token: token.data, p_platform: "android" }).catch(() => {});
    });
  },
};
export const creditService = {
  async balance() {
    const { data, error } = await backend().from("job_credits").select("balance").single();
    if (error) throw error;
    return data.balance as number;
  },
  async packages() {
    const { data, error } = await backend().from("credit_packages").select("*").eq("active", true);
    if (error) throw error;
    return data;
  },
};
