import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { createAccountPasswordStorage, type WebSecretStore } from "@/lib/account-password-storage";

function getBrowserStorage(): WebSecretStore | null {
  if (Platform.OS !== "web") return null;
  try {
    return typeof globalThis.localStorage !== "undefined" ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

function getStorage() {
  return createAccountPasswordStorage(Platform.OS, SecureStore, getBrowserStorage());
}

export function getAccountPassword(key: string): Promise<string | null> {
  return getStorage().get(key);
}

export function setAccountPassword(key: string, value: string): Promise<void> {
  return getStorage().set(key, value);
}

export function removeAccountPassword(key: string): Promise<void> {
  return getStorage().remove(key);
}
