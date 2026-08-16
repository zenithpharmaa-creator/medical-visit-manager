import * as SecureStore from "expo-secure-store";
import { DEFAULT_ACCOUNT_PASSWORD } from "./manager-auth";
import { validateRepresentativePassword } from "./representative-auth-validation";

export { validateRepresentativePassword } from "./representative-auth-validation";

function keyForRepresentative(id: string) {
  return `medical_visit_rep_password_${id}`;
}

export async function saveRepresentativePassword(id: string, password: string) {
  const validation = validateRepresentativePassword(password);
  if (!validation.valid) throw new Error(validation.message);
  if (!password.trim()) return;
  await SecureStore.setItemAsync(keyForRepresentative(id), password);
}

export async function getRepresentativePassword(id: string) {
  return (await SecureStore.getItemAsync(keyForRepresentative(id))) ?? DEFAULT_ACCOUNT_PASSWORD;
}

export async function deleteRepresentativePassword(id: string) {
  await SecureStore.deleteItemAsync(keyForRepresentative(id));
}
