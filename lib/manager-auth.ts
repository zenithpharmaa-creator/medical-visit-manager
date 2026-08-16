import * as SecureStore from "expo-secure-store";
import { validateRepresentativePassword } from "@/lib/representative-auth-validation";

const MANAGER_PASSWORD_KEY = "medical_visit_manager_password";

export async function saveManagerPassword(password: string) {
  const validation = validateRepresentativePassword(password);
  if (!validation.valid) throw new Error(validation.message);
  await SecureStore.setItemAsync(MANAGER_PASSWORD_KEY, password);
}

export async function getManagerPassword() {
  return SecureStore.getItemAsync(MANAGER_PASSWORD_KEY);
}

export async function verifyManagerPassword(password: string) {
  const saved = await getManagerPassword();
  return Boolean(saved && password === saved);
}
