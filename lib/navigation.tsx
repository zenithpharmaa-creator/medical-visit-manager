import { router, usePathname } from "expo-router";
import { ActivityIndicator, Animated, StyleSheet, Text, View } from "react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type NavigationContextValue = {
  goBack: () => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);
let globalGoBack: (() => void) | null = null;
let globalNavigate: ((href: string) => void) | null = null;

/**
 * Keeps the last route opened by the user so tab-to-tab navigation can return
 * to the actual source screen even when the tab navigator has no native stack entry.
 */
export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const currentPathRef = useRef<string | null>(null);
  const historyRef = useRef<string[]>([]);
  const navigationRequestRef = useRef(false);
  const navigationStartedAtRef = useRef(0);
  const navigationFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  const finishNavigation = useCallback(() => {
    if (navigationFallbackTimerRef.current) {
      clearTimeout(navigationFallbackTimerRef.current);
      navigationFallbackTimerRef.current = null;
    }
    navigationRequestRef.current = false;
    setIsNavigating(false);
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const previousPath = currentPathRef.current;
    if (previousPath && previousPath !== pathname) {
      const history = historyRef.current;
      if (history[history.length - 1] !== previousPath) history.push(previousPath);
      if (history.length > 30) history.splice(0, history.length - 30);
      if (navigationRequestRef.current) {
        const remaining = Math.max(0, 420 - (Date.now() - navigationStartedAtRef.current));
        const timer = setTimeout(finishNavigation, remaining);
        currentPathRef.current = pathname;
        return () => clearTimeout(timer);
      }
    }
    currentPathRef.current = pathname;
  }, [finishNavigation, pathname]);

  const navigate = useCallback((href: string) => {
    if (navigationRequestRef.current) return;
    navigationRequestRef.current = true;
    navigationStartedAtRef.current = Date.now();
    setIsNavigating(true);
    navigationFallbackTimerRef.current = setTimeout(finishNavigation, 10000);
    try {
      router.push(href as never);
    } catch {
      finishNavigation();
    }
  }, [finishNavigation]);

  const goBack = useCallback(() => {
    const previousPath = historyRef.current.pop();
    if (previousPath && previousPath !== currentPathRef.current) {
      currentPathRef.current = previousPath;
      router.replace(previousPath as never);
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)" as never);
  }, []);

  useEffect(() => {
    if (!isNavigating) {
      progress.stopAnimation();
      progress.setValue(0);
      return undefined;
    }
    const animation = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 950, useNativeDriver: true }),
    );
    animation.start();
    return () => animation.stop();
  }, [isNavigating, progress]);

  const value = useMemo(() => ({ goBack }), [goBack]);
  globalGoBack = goBack;
  globalNavigate = navigate;
  useEffect(() => () => {
    if (globalGoBack === goBack) globalGoBack = null;
    if (globalNavigate === navigate) globalNavigate = null;
    finishNavigation();
  }, [finishNavigation, goBack, navigate]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
      {isNavigating ? (
        <View pointerEvents="auto" style={styles.loadingOverlay} accessibilityRole="progressbar" accessibilityLabel="جاري فتح الشاشة، يرجى الانتظار">
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color="#1565C0" />
            <Text style={styles.loadingTitle}>جاري فتح الشاشة</Text>
            <Text style={styles.loadingSubtitle}>يرجى الانتظار حتى تكتمل عملية الفتح</Text>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressSegment, { transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-150, 300] }) }] }]} />
            </View>
          </View>
        </View>
      ) : null}
    </NavigationContext.Provider>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.18)",
  },
  loadingCard: {
    width: "82%",
    maxWidth: 360,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 20,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D7E5F5",
    shadowColor: "#102A43",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  loadingTitle: {
    marginTop: 10,
    color: "#102A43",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  loadingSubtitle: {
    marginTop: 6,
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
  },
  progressTrack: {
    width: "100%",
    height: 7,
    marginTop: 16,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#E6EEF8",
  },
  progressSegment: {
    width: "42%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#1565C0",
  },
});

export function navigateWithLoading(href: string) {
  if (globalNavigate) {
    globalNavigate(href);
    return;
  }
  router.push(href as never);
}

export function goBackToPreviousScreen() {
  if (globalGoBack) {
    globalGoBack();
    return;
  }
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace("/(tabs)" as never);
}

export function useBackNavigation() {
  const value = useContext(NavigationContext);
  if (!value) throw new Error("useBackNavigation must be used inside NavigationHistoryProvider");
  return value.goBack;
}
