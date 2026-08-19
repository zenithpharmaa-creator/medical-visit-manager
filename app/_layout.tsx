import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import "../global.css";
import { LocationConsentGate } from "@/components/location-consent-gate";
import { LocalLoginScreen } from "@/components/local-login-screen";
import { ThemeProvider } from "@/lib/theme-provider";
import { VisitProvider } from "@/lib/visit-store";
import { AccountSessionProvider, useAccountSession } from "@/lib/account-session";

function AppNavigation() {
  const { session, loading } = useAccountSession();
  if (loading) return null;
  if (!session) return <LocalLoginScreen />;
  return <Stack screenOptions={{ headerShown: false }}><Stack.Screen name="(tabs)" /></Stack>;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <VisitProvider>
        <AccountSessionProvider>
          <LocationConsentGate>
            <StatusBar style="dark" />
            <AppNavigation />
          </LocationConsentGate>
        </AccountSessionProvider>
      </VisitProvider>
    </ThemeProvider>
  );
}
