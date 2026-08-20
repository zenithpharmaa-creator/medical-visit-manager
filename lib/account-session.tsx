import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { authenticateBiometric, clearBiometricSession, getBiometricSession, saveBiometricSession } from "@/lib/biometric-auth";
import { getRepresentativePassword } from "@/lib/representative-auth";
import { verifyManagerPassword } from "@/lib/manager-auth";
import { useVisitStore } from "@/lib/visit-store";

export type Session = { role: "manager" | "representative"; representativeId?: string; impersonatedByManager?: boolean };
type AccountSessionValue = {
  session: Session | null;
  loading: boolean;
  biometricEnabled: boolean;
  loginManager: (password: string, representativeId?: string, rememberMe?: boolean) => Promise<boolean>;
  loginRepresentative: (id: string, password: string, rememberMe?: boolean) => Promise<boolean>;
  loginWithBiometric: () => Promise<boolean>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
  logout: () => Promise<void>;
};
const SESSION_KEY = "medical_visit_active_session";
const AccountSessionContext = createContext<AccountSessionValue | null>(null);

export function AccountSessionProvider({ children }: { children: ReactNode }) {
  const { data } = useVisitStore();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(SESSION_KEY), getBiometricSession()]).then(([value, biometricSession]) => {
      if (value) setSession(JSON.parse(value) as Session);
      setBiometricEnabled(Boolean(biometricSession));
    }).finally(() => setLoading(false));
  }, []);

  const persist = async (next: Session | null, rememberMe = true) => {
    if (next && rememberMe) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else await AsyncStorage.removeItem(SESSION_KEY);
    setSession(next);
  };

  const value = useMemo<AccountSessionValue>(() => ({
    session,
    loading,
    biometricEnabled,
    loginManager: async (password, representativeId, rememberMe = false) => {
      if (!(await verifyManagerPassword(password))) return false;
      await persist(representativeId ? { role: "representative", representativeId, impersonatedByManager: true } : { role: "manager" }, rememberMe);
      return true;
    },
    loginRepresentative: async (id, password, rememberMe = false) => {
      const representative = data.representatives.find((item) => item.id === id);
      const saved = representative ? await getRepresentativePassword(id) : null;
      if (!representative || !saved || saved !== password) return false;
      await persist({ role: "representative", representativeId: id }, rememberMe);
      return true;
    },
    loginWithBiometric: async () => {
      const storedSession = await getBiometricSession();
      if (!storedSession) return false;
      const result = await authenticateBiometric("سجّل الدخول بالبصمة أو التعرف على الوجه");
      if (!result.success) return false;
      await persist(storedSession, true);
      return true;
    },
    enableBiometric: async () => {
      if (!session) return false;
      const result = await authenticateBiometric("تأكيد تفعيل الدخول بالبصمة أو الوجه");
      if (!result.success) return false;
      await saveBiometricSession(session);
      setBiometricEnabled(true);
      return true;
    },
    disableBiometric: async () => {
      await clearBiometricSession();
      setBiometricEnabled(false);
    },
    logout: async () => {
      await AsyncStorage.removeItem(SESSION_KEY);
      setSession(null);
    },
  }), [biometricEnabled, data.representatives, loading, session]);
  return <AccountSessionContext.Provider value={value}>{children}</AccountSessionContext.Provider>;
}

export function useAccountSession() { const value = useContext(AccountSessionContext); if (!value) throw new Error("useAccountSession must be used inside AccountSessionProvider"); return value; }

export function SessionGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAccountSession();
  const router = useRouter();
  useEffect(() => { if (session) router.replace("/(tabs)"); }, [router, session]);
  if (loading || session) return null;
  return <>{children}</>;
}
