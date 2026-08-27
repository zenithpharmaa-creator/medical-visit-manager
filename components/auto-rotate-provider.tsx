import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect, type PropsWithChildren } from "react";
import { Platform } from "react-native";

export function AutoRotateProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    if (Platform.OS === "web") return;
    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.DEFAULT).catch(() => undefined);
    return () => {
      void ScreenOrientation.unlockAsync().catch(() => undefined);
    };
  }, []);

  return children;
}
