import * as Location from "expo-location";
import { boundedLocation, coordinates } from "./location-logic";
export async function needsLocationExplanation() {
  return (await Location.getForegroundPermissionsAsync()).status === "undetermined";
}
export async function deviceLocation() {
  let permission = await Location.getForegroundPermissionsAsync();
  if (permission.status !== "granted" && permission.canAskAgain)
    permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== "granted")
    throw new Error(
      permission.canAskAgain ? "LOCATION_PERMISSION_DENIED" : "LOCATION_PERMISSION_PERMANENT",
    );
  if (!(await Location.hasServicesEnabledAsync())) throw new Error("GPS_DISABLED");
  const p = await boundedLocation(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
  );
  return coordinates(p.coords.latitude, p.coords.longitude);
}
