import { Feather } from "@expo/vector-icons";
import { colors } from "./ui";
import React from "react";
import { Pressable, View } from "react-native";
import { markerColor } from "./map-presentation";
export default function JobMapMarker({
  worker = false,
  isUrgent = false,
  isSelected = false,
  label,
  onPress,
}: {
  worker?: boolean;
  isUrgent?: boolean;
  isSelected?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={{ width: 48, height: 52, alignItems: "center", justifyContent: "center" }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 18,
          borderBottomLeftRadius: worker ? 18 : 0,
          backgroundColor: worker ? colors.accent : markerColor({ isUrgent }),
          borderWidth: 2,
          borderColor: "white",
          transform: [{ rotate: worker ? "0deg" : "-45deg" }, { scale: isSelected ? 1.15 : 1 }],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {worker ? (
          <Feather name="user" color="white" size={20} />
        ) : (
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: "white" }} />
        )}
      </View>
    </Pressable>
  );
}
