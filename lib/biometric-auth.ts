import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

import type { Session } from "@/lib/account-session";

const BIOMETRIC_KEY = "medical_visit_biometric_session";

export type BiometricKind = "face" | "fingerprint" | "none";
export type BiometricStatus = { kind: BiometricKind; hasHardware: boolean; isEnrolled: boolean; available: boolean };

export async function getBiometricKind(): Promise<BiometricKind> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "face";
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "fingerprint";
  return "none";
}

export async function getBiometricStatus(): Promise<BiometricStatus> {
  const [kind, hasHardware, isEnrolled] = await Promise.all([
    getBiometricKind(),
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return { kind, hasHardware, isEnrolled, available: hasHardware && isEnrolled && kind !== "none" };
}

export async function canUseBiometrics() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

export async function authenticateBiometric(promptMessage: string) {
  if (!(await canUseBiometrics())) return { success: false as const, error: "not_available" };
  return LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: "إلغاء",
    fallbackLabel: "استخدام رمز المرور",
    disableDeviceFallback: false,
  });
}

export async function saveBiometricSession(session: Session) {
  await AsyncStorage.setItem(BIOMETRIC_KEY, JSON.stringify(session));
}

export async function getBiometricSession(): Promise<Session | null> {
  const value = await AsyncStorage.getItem(BIOMETRIC_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as Session;
  } catch {
    await AsyncStorage.removeItem(BIOMETRIC_KEY);
    return null;
  }
}

export async function clearBiometricSession() {
  await AsyncStorage.removeItem(BIOMETRIC_KEY);
}
