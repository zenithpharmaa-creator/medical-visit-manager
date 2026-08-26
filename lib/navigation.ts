import { router } from "expo-router";

/**
 * Returns to the route that opened the current screen.
 * The fallback is used only when the screen has no previous route in the stack.
 */
export function goBackToPreviousScreen() {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace("/(tabs)");
}
