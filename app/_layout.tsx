import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View } from "react-native";

import "../global.css";
import { LocationConsentGate } from "@/components/location-consent-gate";
import { LocalLoginScreen } from "@/components/local-login-screen";
import { ThemeProvider } from "@/lib/theme-provider";
import { VisitProvider } from "@/lib/visit-store";
import { AccountSessionProvider, useAccountSession } from "@/lib/account-session";

function AppNavigation() {
  const { session, loading } = useAccountSession();
  if (loading) return <View className="flex-1 bg-background items-center justify-center"><ActivityIndicator size="large" color="#1565C0" /><Text className="text-sm text-muted mt-3">جارٍ تجهيز التطبيق...</Text></View>;
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
