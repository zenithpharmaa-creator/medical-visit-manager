import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import "../global.css";
import { LocationConsentGate } from "@/components/location-consent-gate";
import { LocalLoginScreen } from "@/components/local-login-screen";
import { ThemeProvider } from "@/lib/theme-provider";
import { VisitProvider } from "@/lib/visit-store";
import { AccountSessionProvider, SessionGate } from "@/lib/account-session";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <VisitProvider>
        <AccountSessionProvider>
          <LocationConsentGate>
            <StatusBar style="dark" />
            <SessionGate>
              <LocalLoginScreen />
            </SessionGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </LocationConsentGate>
        </AccountSessionProvider>
      </VisitProvider>
    </ThemeProvider>
  );
}
