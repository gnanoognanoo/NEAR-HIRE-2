import * as Location from "expo-location";
import {
  createLocator,
  MAX_CACHE_AGE,
  MAX_CACHE_ACCURACY,
  type DeviceFix,
} from "./location-acquisition";
async function permission() {
  const p = await Location.getForegroundPermissionsAsync();
  return { ...p, approximate: p.android?.accuracy === "coarse" || p.ios?.accuracy === "reduced" };
}
export async function needsLocationExplanation() {
  return (await permission()).status === "undetermined";
}
export const deviceLocation = createLocator({
  permission,
  requestPermission: async () => {
    await Location.requestForegroundPermissionsAsync();
    return permission();
  },
  services: Location.hasServicesEnabledAsync,
  fresh: (approximate) => {
    let stopped = false;
    let subscription: Location.LocationSubscription | undefined;
    const promise = new Promise<DeviceFix>((resolve, reject) => {
      void Location.watchPositionAsync(
        {
          accuracy: approximate ? Location.Accuracy.Balanced : Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 0,
          mayShowUserSettingsDialog: false,
        },
        resolve,
        () => reject(new Error("LOCATION_UNAVAILABLE")),
      ).then(
        (s) => {
          if (stopped) s.remove();
          else subscription = s;
        },
        () => reject(new Error("LOCATION_UNAVAILABLE")),
      );
    });
    return {
      promise,
      cancel: () => {
        stopped = true;
        subscription?.remove();
        subscription = undefined;
      },
    };
  },
  cached: () =>
    Location.getLastKnownPositionAsync({
      maxAge: MAX_CACHE_AGE,
      requiredAccuracy: MAX_CACHE_ACCURACY,
    }),
});
