import { router, usePathname } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

type NavigationContextValue = {
  goBack: () => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);
let globalGoBack: (() => void) | null = null;

/**
 * Keeps the last route opened by the user so tab-to-tab navigation can return
 * to the actual source screen even when the tab navigator has no native stack entry.
 */
export function NavigationHistoryProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const currentPathRef = useRef<string | null>(null);
  const historyRef = useRef<string[]>([]);

  useEffect(() => {
    if (!pathname) return;
    const previousPath = currentPathRef.current;
    if (previousPath && previousPath !== pathname) {
      const history = historyRef.current;
      if (history[history.length - 1] !== previousPath) history.push(previousPath);
      if (history.length > 30) history.splice(0, history.length - 30);
    }
    currentPathRef.current = pathname;
  }, [pathname]);

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

  const value = useMemo(() => ({ goBack }), [goBack]);
  globalGoBack = goBack;
  useEffect(() => () => {
    if (globalGoBack === goBack) globalGoBack = null;
  }, [goBack]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
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
