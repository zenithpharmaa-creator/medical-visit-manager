import { getAccountPassword, setAccountPassword } from "@/lib/account-password-storage-runtime";
import { validateRepresentativePassword } from "@/lib/representative-auth-validation";

const MANAGER_PASSWORD_KEY = "medical_visit_manager_password";
export const DEFAULT_ACCOUNT_PASSWORD = "123";

export async function saveManagerPassword(password: string) {
  const validation = validateRepresentativePassword(password);
  if (!validation.valid) throw new Error(validation.message);
  await setAccountPassword(MANAGER_PASSWORD_KEY, password);
}

export async function getManagerPassword() {
  return (await getAccountPassword(MANAGER_PASSWORD_KEY)) ?? DEFAULT_ACCOUNT_PASSWORD;
}

export async function verifyManagerPassword(password: string) {
  const saved = await getManagerPassword();
  return Boolean(saved && password === saved);
}
