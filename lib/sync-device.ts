import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const DEVICE_ID_KEY = "medical_visit_sync_device_id";
const DEVICE_TOKEN_KEY = "medical_visit_sync_device_token";
const DEVICE_REPRESENTATIVE_KEY = "medical_visit_sync_representative_id";

const randomSegment = () => Math.random().toString(36).slice(2, 10);

export type SyncDeviceIdentity = {
  deviceId: string;
  deviceLabel: string;
  representativeId: string;
};

async function secureSet(key: string, value: string) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function secureGet(key: string) {
  if (Platform.OS === "web") return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function secureDelete(key: string) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function getOrCreateSyncDeviceId() {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;

  const deviceId = `mv-${Platform.OS}-${Date.now().toString(36)}-${randomSegment()}-${randomSegment()}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export async function saveActivatedDevice(input: { representativeId: string; deviceToken: string }) {
  await secureSet(DEVICE_TOKEN_KEY, input.deviceToken);
  await secureSet(DEVICE_REPRESENTATIVE_KEY, input.representativeId);
}

export async function getActivatedDevice() {
  const [deviceId, deviceToken, representativeId] = await Promise.all([
    getOrCreateSyncDeviceId(),
    secureGet(DEVICE_TOKEN_KEY),
    secureGet(DEVICE_REPRESENTATIVE_KEY),
  ]);

  if (!deviceToken || !representativeId) return null;
  return { deviceId, deviceToken, representativeId };
}

export async function clearActivatedDevice() {
  await Promise.all([
    secureDelete(DEVICE_TOKEN_KEY),
    secureDelete(DEVICE_REPRESENTATIVE_KEY),
  ]);
}

export function getSyncDeviceLabel() {
  return Platform.OS === "web" ? "متصفح الويب" : `جهاز ${Platform.OS === "android" ? "Android" : "iOS"}`;
}
