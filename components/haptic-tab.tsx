import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import { Platform, type ViewStyle } from "react-native";
import { usePathname } from "expo-router";

export function HapticTab({ style: tabStyle, accessibilityState, ...props }: BottomTabBarButtonProps) {
  const pathname = usePathname();
  const label = String(props.accessibilityLabel ?? "");
  const isSubscreenActive = (label.includes("الإدارة") && /(entities|shared-locations|settings|management|representative|device-activation|sync-history|missing-coordinates|override-reports|rep-location|tasks|plan-approvals)/.test(pathname))
    || (label.includes("الزيارات") && /(record|visits|map)/.test(pathname))
    || (label.includes("الخطة") && /(weekly)/.test(pathname));
  const isActive = accessibilityState?.selected === true || isSubscreenActive;

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
