import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import { Platform, type ViewStyle } from "react-native";

export function HapticTab({ style: tabStyle, accessibilityState, ...props }: BottomTabBarButtonProps) {
  const isActive = accessibilityState?.selected === true;

  return (
    <PlatformPressable
      {...props}
      accessibilityState={accessibilityState}
      style={[
        tabStyle,
        isActive && ({
          borderRadius: 14,
          shadowColor: "#1257A6",
          shadowOpacity: Platform.OS === "web" ? 0.16 : 0.24,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 2 },
          elevation: Platform.OS === "android" ? 4 : 0,
        } satisfies ViewStyle),
      ]}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
