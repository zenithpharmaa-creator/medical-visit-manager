import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import "../global.css";
import { LocationConsentGate } from "@/components/location-consent-gate";
import { ThemeProvider } from "@/lib/theme-provider";
import { VisitProvider } from "@/lib/visit-store";

export default function RootLayout() {
  return (
    <ThemeProvider>
      <VisitProvider>
        <LocationConsentGate>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
          </Stack>
        </LocationConsentGate>
      </VisitProvider>
    </ThemeProvider>
  );
}
